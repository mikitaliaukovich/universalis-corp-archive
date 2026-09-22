#!/usr/bin/env python3
"""Read a manuscript aloud in Russian, locally.

    python voiceover.py ../../Искупление.md --speaker eugene

Produces one WAV per chapter plus a manifest.json. Nothing leaves the machine.
See README.md for the whole story.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import extract  # noqa: E402
from extract import load_entry_names, read_blocks, split_chapters  # noqa: E402
from synth import Narrator, cache_key, chunk_blocks, write_wav  # noqa: E402

MODEL_URL = "https://models.silero.ai/models/tts/ru/{name}.pt"
DEFAULT_MODEL = "v5_5_ru"
# Measured on v5_5_ru at 48 kHz: ~15 characters of Russian prose per second.
CHARS_PER_SECOND = 15.0


def resolve_model(name: str, cache_dir: Path) -> Path:
    path = cache_dir / f"{name}.pt"
    if path.exists():
        return path
    cache_dir.mkdir(parents=True, exist_ok=True)
    url = MODEL_URL.format(name=name)
    print(f"Downloading {name} (~140 MB, once) from {url}")
    tmp = path.with_suffix(".part")
    try:
        with urllib.request.urlopen(url) as response, tmp.open("wb") as out:
            total = int(response.headers.get("content-length", 0))
            done = 0
            while block := response.read(1 << 20):
                out.write(block)
                done += len(block)
                if total:
                    print(f"\r  {done * 100 // total}%", end="", flush=True)
        print()
    except Exception:
        tmp.unlink(missing_ok=True)
        raise
    tmp.rename(path)
    return path


def fmt_duration(seconds: float) -> str:
    h, rem = divmod(int(seconds), 3600)
    m, s = divmod(rem, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"


def to_mp3(wav: Path, bitrate: str) -> Path | None:
    import shutil
    import subprocess

    if not shutil.which("ffmpeg"):
        return None
    mp3 = wav.with_suffix(".mp3")
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav),
         "-codec:a", "libmp3lame", "-b:a", bitrate, str(mp3)],
        check=True,
    )
    wav.unlink()
    return mp3


def parse_selection(spec: str, count: int) -> set[int]:
    wanted: set[int] = set()
    for part in spec.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            lo, hi = part.split("-", 1)
            wanted.update(range(int(lo), int(hi) + 1))
        else:
            wanted.add(int(part))
    return {n for n in wanted if 1 <= n <= count}


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Voice a Russian manuscript locally with Silero TTS.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("input", type=Path, help=".md, .txt, .docx or .fb2 manuscript")
    parser.add_argument("-o", "--out", type=Path, default=Path("audio"),
                        help="output directory")
    parser.add_argument("-s", "--speaker", default="eugene",
                        help="aidar, baya, kseniya, eugene or xenia")
    parser.add_argument("--model", default=DEFAULT_MODEL, help="Silero model name")
    parser.add_argument("--models-dir", type=Path, default=Path.home() / ".cache" / "silero",
                        help="where the downloaded model is kept")
    parser.add_argument("--rate", type=int, default=48000, choices=[8000, 24000, 48000],
                        help="sample rate in Hz")
    parser.add_argument("--split", default="heading", choices=["heading", "hint", "none"],
                        help="how to cut the text into chapters")
    parser.add_argument("--heading-level", type=int, default=0, metavar="N",
                        help="only headings this deep or shallower start a chapter "
                             "(1 = H1 only; 0 = any)")
    parser.add_argument("--chapters", help="only these chapters, e.g. 1-3,7")
    parser.add_argument("--para-pause", type=float, default=0.35,
                        help="silence between paragraphs, seconds")
    parser.add_argument("--heading-pause", type=float, default=1.0,
                        help="silence after a chapter title, seconds")
    parser.add_argument("--mp3", action="store_true", help="convert to mp3 (needs ffmpeg)")
    parser.add_argument("--bitrate", default="96k", help="mp3 bitrate")
    parser.add_argument("--threads", type=int, default=0,
                        help="CPU threads (0 = let torch decide)")
    parser.add_argument("--single", action="store_true",
                        help="one file for the whole manuscript")
    parser.add_argument("--no-cache", action="store_true",
                        help="re-synthesise even unchanged chunks")
    parser.add_argument("--peak-db", type=float, default=-1.0,
                        help="normalise each file to this peak in dBFS (use 0 to disable)")
    parser.add_argument("--content", type=Path,
                        help="archive content/ dir, so [[ids]] are read as names")
    parser.add_argument("-n", "--dry-run", action="store_true",
                        help="report chapters, chunks and estimated length, synthesise nothing")
    args = parser.parse_args()

    if not args.input.exists():
        parser.error(f"{args.input} not found")

    if args.content:
        extract.ENTRY_NAMES = load_entry_names(args.content)
        print(f"Resolved {len(extract.ENTRY_NAMES)} entry names from {args.content}")

    blocks = read_blocks(args.input)
    if not blocks:
        parser.error(f"No readable text found in {args.input}")
    chapters = split_chapters(blocks, args.split, args.heading_level)

    if args.chapters:
        keep = parse_selection(args.chapters, len(chapters))
        if not keep:
            parser.error(f"--chapters {args.chapters!r} selects nothing (1..{len(chapters)})")
        chapters = [c for c in chapters if c.number in keep]

    plans = [
        (c, chunk_blocks(c.blocks, para_pause=args.para_pause,
                         heading_pause=args.heading_pause))
        for c in chapters
    ]
    total_chars = sum(len(ch.text) for _, chunks in plans for ch in chunks)
    estimate = total_chars / CHARS_PER_SECOND

    print(f"{args.input.name}: {len(chapters)} chapter(s), "
          f"{sum(len(c) for _, c in plans)} chunks, {total_chars:,} characters")
    print(f"Estimated audio: ~{fmt_duration(estimate)}")

    if args.dry_run:
        for chapter, chunks in plans:
            chars = sum(len(c.text) for c in chunks)
            print(f"  {chapter.number:>3}. {chapter.title[:58]:<58} "
                  f"{len(chunks):>4} chunks  ~{fmt_duration(chars / CHARS_PER_SECOND)}")
        longest = max((c for _, chunks in plans for c in chunks),
                      key=lambda c: len(c.text), default=None)
        if longest:
            print(f"Longest chunk: {len(longest.text)} chars (model limit ~1000)")
        return 0

    model_path = resolve_model(args.model, args.models_dir)
    print(f"Loading {model_path.name} ...")
    narrator = Narrator(model_path, args.speaker, args.rate, args.threads or None)

    args.out.mkdir(parents=True, exist_ok=True)
    cache_dir = args.out / ".cache"
    if not args.no_cache:
        cache_dir.mkdir(exist_ok=True)

    import torch

    manifest = {
        "source": str(args.input),
        "model": args.model,
        "speaker": args.speaker,
        "sample_rate": args.rate,
        "chapters": [],
    }
    all_audio: list = []
    started = time.time()
    failures: list[str] = []

    for chapter, chunks in plans:
        print(f"[{chapter.number}/{len(plans)}] {chapter.title[:60]}", flush=True)
        pieces: list = []
        cursor = 0.0
        cues: list[dict] = []

        for index, chunk in enumerate(chunks, 1):
            key = cache_key(chunk.text, args.speaker, args.rate, args.model)
            cached = cache_dir / f"{key}.pt"
            audio = None
            if not args.no_cache and cached.exists():
                try:
                    audio = torch.load(cached)
                except Exception:
                    cached.unlink(missing_ok=True)
            if audio is None:
                try:
                    audio = narrator.say(chunk.text)
                except Exception as exc:
                    failures.append(f"ch{chapter.number} chunk{index}: {exc}")
                    print(f"    ! chunk {index} failed ({exc}); skipped")
                    continue
                if not args.no_cache:
                    torch.save(audio, cached)

            cues.append({
                "start": round(cursor, 3),
                "end": round(cursor + len(audio) / args.rate, 3),
                "text": chunk.text,
            })
            cursor += len(audio) / args.rate
            pieces.append(audio)
            if chunk.pause_after:
                gap = narrator.silence(chunk.pause_after)
                pieces.append(gap)
                cursor += len(gap) / args.rate
            print(f"\r    {index}/{len(chunks)} chunks", end="", flush=True)

        print()
        if not pieces:
            continue
        audio = torch.cat(pieces)

        if args.single:
            all_audio.append(audio)
            all_audio.append(narrator.silence(1.2))
            manifest["chapters"].append(
                {"number": chapter.number, "title": chapter.title,
                 "duration": round(len(audio) / args.rate, 3), "cues": cues}
            )
            continue

        wav = args.out / f"{chapter.slug}.wav"
        duration = write_wav(wav, audio, args.rate, args.peak_db or None)
        final = (to_mp3(wav, args.bitrate) if args.mp3 else None) or wav
        if args.mp3 and final.suffix == ".wav":
            print("    (ffmpeg not found, keeping WAV)")
        print(f"    -> {final.name}  {fmt_duration(duration)}")
        manifest["chapters"].append(
            {"number": chapter.number, "title": chapter.title, "file": final.name,
             "duration": round(duration, 3), "cues": cues}
        )

    if args.single and all_audio:
        wav = args.out / f"{args.input.stem}.wav"
        duration = write_wav(wav, torch.cat(all_audio), args.rate, args.peak_db or None)
        final = (to_mp3(wav, args.bitrate) if args.mp3 else None) or wav
        print(f"    -> {final.name}  {fmt_duration(duration)}")
        manifest["file"] = final.name
        manifest["duration"] = round(duration, 3)

    (args.out / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    elapsed = time.time() - started
    produced = sum(c.get("duration", 0) for c in manifest["chapters"])
    print(f"\nDone in {fmt_duration(elapsed)} for {fmt_duration(produced)} of audio"
          f"{f' ({produced / elapsed:.0f}x realtime)' if elapsed > 0 else ''}")
    print(f"Output: {args.out}")
    if failures:
        print(f"\n{len(failures)} chunk(s) failed:")
        for line in failures[:10]:
            print(f"  {line}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
