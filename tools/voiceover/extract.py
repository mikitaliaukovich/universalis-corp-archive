"""Read a manuscript and turn it into clean, chapter-split plain text.

Supports the formats a Google Docs export can produce (.md, .txt, .docx) plus
.fb2, which is what most Russian e-book tooling speaks.
"""

from __future__ import annotations

import html
import re
import unicodedata
import xml.etree.ElementTree as ET
import zipfile
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class Block:
    """One paragraph of speakable text."""

    text: str
    kind: str = "para"  # para | heading
    level: int = 0  # heading depth, 1 = top level


@dataclass
class Chapter:
    number: int
    title: str
    blocks: list[Block] = field(default_factory=list)

    @property
    def chars(self) -> int:
        return sum(len(b.text) for b in self.blocks)

    @property
    def slug(self) -> str:
        base = re.sub(r"[^\w\s-]", "", self.title.lower(), flags=re.UNICODE)
        base = re.sub(r"[\s_-]+", "-", base).strip("-")
        return f"{self.number:02d}-{base}"[:60] or f"{self.number:02d}"


# --- format readers -------------------------------------------------------

# The archive's own Markdown extensions (see app/README.md). The narrator
# should read the label, not the machinery around it.
WIKILINK = re.compile(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]")
REDACT = re.compile(r":redact\[([^\]]*)\](?:\{[^}]*\})?")
DIRECTIVE_FENCE = re.compile(r"^:::+\s*\w*(?:\{[^}]*\})?\s*$")

MD_IMAGE = re.compile(r"!\[[^\]]*\]\([^)]*\)")
MD_LINK = re.compile(r"\[([^\]]+)\]\([^)]*\)")
MD_HEADING = re.compile(r"^(#{1,6})\s+(.*)$")
MD_EMPHASIS = re.compile(r"(\*{1,3}|_{1,3})(?=\S)(.+?)(?<=\S)\1", re.DOTALL)
HTML_TAG = re.compile(r"<[^>]+>")


# id -> human name, so "[[mari]]" is read as "Мари" and not as a latin id.
ENTRY_NAMES: dict[str, str] = {}

def load_entry_names(content_dir: Path, lang: str = "ru") -> dict[str, str]:
    """Map entry ids to their display names from the archive's meta.yaml files."""
    pattern = re.compile(
        r"^name:\s*\{[^}]*?\b" + lang + r":\s*[\"']([^\"']+)[\"']", re.MULTILINE
    )
    names: dict[str, str] = {}
    for meta in content_dir.glob("*/*/meta.yaml"):
        match = pattern.search(meta.read_text(encoding="utf-8"))
        if match:
            names[meta.parent.name] = match.group(1)
    return names


def _wikilink_label(match: re.Match[str]) -> str:
    if match.group(2):
        return match.group(2)
    target = match.group(1).strip()
    return ENTRY_NAMES.get(target, target.replace("-", " "))


def _clean_markdown_inline(text: str) -> str:
    text = MD_IMAGE.sub("", text)
    text = WIKILINK.sub(_wikilink_label, text)
    text = REDACT.sub(r"\1", text)
    text = MD_LINK.sub(r"\1", text)
    text = MD_EMPHASIS.sub(r"\2", text)
    text = re.sub(r"`{1,3}([^`]*)`{1,3}", r"\1", text)
    text = HTML_TAG.sub("", text)
    return text


def read_markdown(path: Path) -> list[Block]:
    blocks: list[Block] = []
    buf: list[str] = []
    in_code = False

    def flush() -> None:
        if buf:
            joined = " ".join(s.strip() for s in buf).strip()
            if joined:
                blocks.append(Block(_clean_markdown_inline(joined)))
            buf.clear()

    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.rstrip()
        if line.strip().startswith("```"):
            flush()
            in_code = not in_code
            continue
        if in_code or DIRECTIVE_FENCE.match(line.strip()):
            continue
        if not line.strip():
            flush()
            continue
        heading = MD_HEADING.match(line)
        if heading:
            flush()
            title = _clean_markdown_inline(heading.group(2)).strip()
            if title:
                blocks.append(Block(title, kind="heading", level=len(heading.group(1))))
            continue
        # A horizontal rule is a scene break, not something to pronounce.
        if re.fullmatch(r"[-*_]{3,}", line.strip()):
            flush()
            continue
        buf.append(re.sub(r"^\s*(?:[-*+]|\d+[.)])\s+", "", line))
    flush()
    return blocks


def read_text(path: Path) -> list[Block]:
    blocks: list[Block] = []
    for para in re.split(r"\n\s*\n", path.read_text(encoding="utf-8")):
        cleaned = " ".join(para.split())
        if cleaned:
            blocks.append(Block(cleaned))
    return blocks


def read_docx(path: Path) -> list[Block]:
    try:
        import docx  # type: ignore
    except ImportError as exc:  # pragma: no cover - depends on optional extra
        raise SystemExit(
            "Reading .docx needs python-docx:  pip install python-docx"
        ) from exc

    blocks: list[Block] = []
    for para in docx.Document(str(path)).paragraphs:
        text = " ".join(para.text.split())
        if not text:
            continue
        style = (para.style.name or "").lower()
        if style.startswith(("heading", "title", "заголовок")):
            depth = re.search(r"\d+", style)
            blocks.append(Block(text, kind="heading", level=int(depth.group()) if depth else 1))
        else:
            blocks.append(Block(text))
    return blocks


FB2_NS = "{http://www.gribuser.ru/xml/fictionbook/2.0}"


def read_fb2(path: Path) -> list[Block]:
    data = path.read_bytes()
    if zipfile.is_zipfile(path):  # .fb2.zip
        with zipfile.ZipFile(path) as zf:
            name = next(n for n in zf.namelist() if n.lower().endswith(".fb2"))
            data = zf.read(name)
    root = ET.fromstring(data)
    body = root.find(f"{FB2_NS}body")
    if body is None:
        return []

    blocks: list[Block] = []

    def walk(node: ET.Element, in_title: bool = False) -> None:
        tag = node.tag.replace(FB2_NS, "")
        if tag in {"title", "subtitle"}:
            # Take the title whole; its inner <p>s are the same words again.
            text = " ".join("".join(node.itertext()).split())
            if text:
                blocks.append(Block(text, kind="heading", level=1 if tag == "title" else 2))
            return
        if tag == "p" and not in_title:
            text = " ".join("".join(node.itertext()).split())
            if text:
                blocks.append(Block(text))
            return
        for child in node:
            walk(child, in_title)

    walk(body)
    return blocks


READERS = {
    ".md": read_markdown,
    ".markdown": read_markdown,
    ".txt": read_text,
    ".docx": read_docx,
    ".fb2": read_fb2,
    ".zip": read_fb2,
}


def read_blocks(path: Path) -> list[Block]:
    reader = READERS.get(path.suffix.lower())
    if reader is None:
        raise SystemExit(
            f"Don't know how to read {path.suffix!r}. "
            f"Supported: {', '.join(sorted(READERS))}. "
            "From Google Docs use File > Download > Markdown (.md) or Word (.docx)."
        )
    return reader(path)


# --- chapter splitting ----------------------------------------------------

# "Глава 7", "ГЛАВА VII", "Chapter 7", "7." on a line of its own.
CHAPTER_HINT = re.compile(
    r"^\s*(?:глава|часть|chapter|part)\b|^\s*\d{1,3}\s*[.—-]?\s*$",
    re.IGNORECASE | re.UNICODE,
)


def split_chapters(
    blocks: list[Block], mode: str = "heading", max_level: int = 0
) -> list[Chapter]:
    """Group blocks into chapters.

    heading  - every heading starts a chapter (good for a Google Docs export
               that uses real heading styles)
    hint     - only headings that look like "Глава N" start one
    none     - one chapter for the whole manuscript

    max_level caps how deep a heading may be and still start a chapter, so a
    manuscript using H1 per chapter and H2 per scene splits only on chapters.
    0 means any depth.
    """
    if mode == "none":
        return [Chapter(1, "Манускрипт", list(blocks))]

    chapters: list[Chapter] = []
    current: Chapter | None = None
    for block in blocks:
        deep_enough = not max_level or not block.level or block.level <= max_level
        starts = (
            block.kind == "heading"
            and deep_enough
            and (mode == "heading" or bool(CHAPTER_HINT.match(block.text)))
        )
        if starts:
            current = Chapter(len(chapters) + 1, block.text)
            current.blocks.append(block)
            chapters.append(current)
            continue
        if current is None:
            current = Chapter(1, "Начало")
            chapters.append(current)
        current.blocks.append(block)

    kept = [c for c in chapters if any(b.kind == "para" for b in c.blocks)] or chapters
    for index, chapter in enumerate(kept, 1):
        chapter.number = index
    return kept


# --- normalisation for the synthesiser ------------------------------------

REPLACEMENTS = {
    " ": " ",   # nbsp
    " ": " ",
    "‑": "-",   # non-breaking hyphen
    "‒": "—",
    "–": "—",  # en dash -> em dash, read as a pause
    "―": "—",
    "“": "«", "”": "»", "„": "«", "‟": "»",
    "‘": "'", "’": "'",
    "…": "...",
    "﻿": "",
}

# Silero reads these as English letter names otherwise.
ABBREVIATIONS = {
    r"\bт\.\s*е\.": "то есть",
    r"\bт\.\s*д\.": "так далее",
    r"\bт\.\s*п\.": "тому подобное",
    r"\bи\.\s*о\.": "исполняющий обязанности",
    r"\bг\.\s*": "год ",
}

HAS_LETTER = re.compile(r"[^\W\d_]", re.UNICODE)


def normalise(text: str) -> str:
    text = unicodedata.normalize("NFKC", text)
    for src, dst in REPLACEMENTS.items():
        text = text.replace(src, dst)
    for pattern, dst in ABBREVIATIONS.items():
        text = re.sub(pattern, dst, text, flags=re.IGNORECASE)
    text = html.unescape(text)
    # A dash opening direct speech needs a space after it to be read as a pause.
    text = re.sub(r"^—(?=\S)", "— ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def is_speakable(text: str) -> bool:
    """Silero raises on input with no pronounceable content (e.g. '...')."""
    return bool(HAS_LETTER.search(text))
