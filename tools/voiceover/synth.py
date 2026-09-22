"""Chunk text to what Silero can swallow, then synthesise and stitch it."""

from __future__ import annotations

import hashlib
import re
import struct
import wave
from dataclasses import dataclass
from pathlib import Path

from extract import Block, is_speakable, normalise

# The model raises "couldn't generate your text" somewhere past 1000 characters.
# Measured on v5_5_ru: 1000 ok, 1200 fails. Stay clear of the cliff.
MAX_CHARS = 850

SENTENCE_END = re.compile(r"(?<=[.!?…])[\"»']?\s+(?=[«\"'—\w])", re.UNICODE)
CLAUSE_END = re.compile(r"(?<=[,;:—])\s+", re.UNICODE)


@dataclass
class Chunk:
    text: str
    pause_after: float  # seconds of silence to append


def _split_long(text: str, limit: int) -> list[str]:
    """Break a single over-long sentence on the least-bad boundary."""
    for splitter in (CLAUSE_END, re.compile(r"\s+")):
        parts = splitter.split(text)
        if len(parts) == 1:
            continue
        out, buf = [], ""
        for part in parts:
            candidate = f"{buf} {part}".strip()
            if len(candidate) <= limit:
                buf = candidate
            else:
                if buf:
                    out.append(buf)
                buf = part
        if buf:
            out.append(buf)
        if all(len(p) <= limit for p in out):
            return out
    # Nothing to split on: hard-cut. Vanishingly rare in prose.
    return [text[i : i + limit] for i in range(0, len(text), limit)]


def chunk_blocks(
    blocks: list[Block],
    max_chars: int = MAX_CHARS,
    para_pause: float = 0.35,
    heading_pause: float = 1.0,
) -> list[Chunk]:
    """Pack sentences into model-sized chunks without splitting sentences."""
    chunks: list[Chunk] = []

    for block in blocks:
        text = normalise(block.text)
        if not is_speakable(text):
            continue
        gap = heading_pause if block.kind == "heading" else para_pause

        pieces: list[str] = []
        for sentence in SENTENCE_END.split(text):
            sentence = sentence.strip()
            if not sentence:
                continue
            pieces.extend(
                _split_long(sentence, max_chars) if len(sentence) > max_chars else [sentence]
            )

        buf = ""
        for piece in pieces:
            candidate = f"{buf} {piece}".strip()
            if len(candidate) <= max_chars:
                buf = candidate
                continue
            if buf:
                chunks.append(Chunk(buf, 0.0))
            buf = piece
        if buf and is_speakable(buf):
            chunks.append(Chunk(buf, gap))

    return chunks


class Narrator:
    """Wraps the Silero package so the model is loaded exactly once."""

    def __init__(self, model_path: Path, speaker: str, sample_rate: int = 48000,
                 threads: int | None = None):
        import torch

        if threads:
            torch.set_num_threads(threads)
        self.torch = torch
        self.sample_rate = sample_rate
        self.speaker = speaker
        self.model = torch.package.PackageImporter(str(model_path)).load_pickle(
            "tts_models", "model"
        )
        self.model.to(torch.device("cpu"))

        available = list(getattr(self.model, "speakers", []))
        if available and speaker not in available:
            raise SystemExit(
                f"Unknown speaker {speaker!r}. This model offers: {', '.join(available)}"
            )

    def say(self, text: str):
        return self.model.apply_tts(
            text=text,
            speaker=self.speaker,
            sample_rate=self.sample_rate,
            put_accent=True,
            put_yo=True,
        )

    def silence(self, seconds: float):
        return self.torch.zeros(int(seconds * self.sample_rate))


def write_wav(path: Path, samples, sample_rate: int, peak_db: float | None = -1.0) -> float:
    """Write float samples as 16-bit PCM. Returns duration in seconds.

    Silero occasionally pushes samples to full scale, which clips once quantised.
    Scaling the whole file to a fixed peak keeps chapters at a matching level too.
    """
    import torch

    if peak_db is not None:
        peak = samples.abs().max().item()
        if peak > 0:
            samples = samples * (10 ** (peak_db / 20) / peak)
    clipped = samples.clamp(-1.0, 1.0)
    pcm = (clipped * 32767.0).to(dtype=torch.int16).numpy().tobytes()
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(sample_rate)
        out.writeframes(pcm)
    return len(clipped) / sample_rate


def cache_key(text: str, speaker: str, sample_rate: int, model: str) -> str:
    payload = f"{model}|{speaker}|{sample_rate}|{text}".encode("utf-8")
    return hashlib.sha256(payload).hexdigest()[:16]
