# Voiceover — reading the manuscript aloud, locally

A command-line tool that turns the manuscript into Russian narration on your own
machine. No account, no API key, no upload: the text of an unpublished novel
never leaves the laptop.

This is the *review loop* — hearing a chapter back to catch what the eye skips.
Recording a finished audiobook and playing it on the site are a later step; see
[Where this goes next](#where-this-goes-next).

```bash
cd tools/voiceover
python -m venv .venv && source .venv/bin/activate
pip install --index-url https://download.pytorch.org/whl/cpu torch
pip install numpy python-docx

python voiceover.py ../../Искупление.md --heading-level 1
```

First run downloads the voice model (~140 MB) to `~/.cache/silero` once. Output
lands in `audio/`: one WAV per chapter, plus a `manifest.json`.

## Getting the text out of Google Docs

**File → Download → Markdown (.md)** is the best export. Headings survive, so
chapters split automatically, and the file is a readable diff in git.

`.docx` works too (`pip install python-docx`) and keeps Word heading styles.
`.txt` and `.fb2` are also accepted. Save the export to the repo root as
`Искупление.md` — `.gitignore` already keeps it out of the repository.

For chapter splitting to work, chapter titles must be real headings in the
document, not bold paragraphs. If they are not, use `--split hint`, which looks
for lines like "Глава 7", or `--split none` to voice the whole file as one piece.

## Everyday use

```bash
# What would it produce? Costs nothing, synthesises nothing.
python voiceover.py ../../Искупление.md --heading-level 1 --dry-run

# Just the chapter you rewrote last night, in a female voice
python voiceover.py ../../Искупление.md --chapters 7 --speaker xenia

# The whole book as one mp3 for the phone
python voiceover.py ../../Искупление.md --single --mp3
```

Re-running is cheap. Every chunk of audio is cached by the hash of its text, so
after editing chapter 7 only chapter 7 is synthesised again — the rest is copied
from `audio/.cache`. Delete that folder to reclaim the space.

| Option | What it does |
|---|---|
| `--speaker` | `eugene`, `aidar` (male), `xenia`, `baya`, `kseniya` (female) |
| `--heading-level N` | only headings this deep start a chapter (`1` = H1 only) |
| `--split` | `heading` · `hint` (looks for "Глава N") · `none` |
| `--chapters 1-3,7` | synthesise a subset |
| `--single` | one file instead of one per chapter |
| `--mp3 --bitrate 96k` | convert with ffmpeg (WAV is kept if ffmpeg is missing) |
| `--rate` | 48000 · 24000 · 8000 Hz |
| `--para-pause` / `--heading-pause` | silence between paragraphs / after a title |
| `--peak-db` | output level, default −1 dBFS; `0` disables normalisation |
| `--content ../../app/content` | read `[[mari]]` as "Мари" when voicing lore files |
| `--dry-run` | chapter list, chunk count, estimated duration |

## What it does to the text

Speech synthesis is sensitive to punctuation, and a manuscript is full of markup
that should not be pronounced. Before synthesis the tool:

- drops images, link targets, code fences, horizontal rules and `:::` directives;
- unwraps the archive's own syntax — `[[mari|Мари]]` and `:redact[…]` become
  their visible text;
- normalises typography: `–` → `—`, curly quotes → `«»`, `…` → `...`, nbsp → space;
- expands abbreviations that would otherwise be spelled out letter by letter
  (`т. е.` → `то есть`);
- splits into chunks of at most 850 characters **on sentence boundaries**, never
  mid-sentence, because the model fails above ~1000 characters;
- skips fragments with no pronounceable content, which otherwise crash the model;
- normalises each file to −1 dBFS so chapters play back at a matching level.

## Why this model

The hard requirement was Russian, running locally. That narrows the field a lot —
most of the well-known open models treat Russian as an afterthought or omit it.

| Option | Russian | Runs on a laptop CPU | Licence | Verdict |
|---|---|---|---|---|
| **Silero v5 `v5_5_ru`** | native, 5 voices, automatic stress | yes, 23× realtime | CC BY-NC-SA 4.0 | **chosen** |
| Piper (`irina`, `ruslan`, `dmitri`, `denis`) | 4 community voices | yes, very fast | MIT | flatter prosody; good fallback, commercially usable |
| XTTS-v2 (Coqui) | yes, voice cloning | slow without a GPU | non-commercial; project discontinued | cloning, but unmaintained |
| Chatterbox Multilingual | yes, among 20+ languages, cloning | GPU really wanted | MIT | best candidate for a *cloned narrator voice* later |
| F5-TTS Russian fine-tunes | yes, cloning | GPU | varies by checkpoint | promising, less predictable |
| Kokoro | no Russian | — | Apache-2.0 | ruled out |

Silero wins for this job on three counts: it is Russian-first rather than
multilingual-and-therefore-mediocre, it places word stress automatically (the
thing that makes most Russian TTS sound wrong), and it is fast enough on a plain
CPU that voicing a chapter is not a chore you avoid.

### Measured here

On 4 CPU cores, no GPU, `v5_5_ru` at 48 kHz:

- **23× faster than realtime** sustained over 14 000 characters
- 140 MB model, ~1 GB of RAM while running
- a 500 000-character novel ≈ **9 hours of audio in roughly 25 minutes**

Long enough for a coffee, short enough to do after every revision.

## The licence, and why it matters later

**Silero's models are CC BY-NC-SA 4.0 — non-commercial.** Reading your own draft
back to yourself is plainly fine. Publishing that audio on a site promoting a
novel you intend to sell is not clearly fine, and "not clearly fine" is a bad
place to be with your own book.

So when the audiobook becomes something listeners hear rather than something you
review, one of these has to happen first:

1. **Licence Silero commercially** — they sell one; this keeps the voices as they are.
2. **Switch to Piper** (MIT) for anything published, keeping Silero for drafting.
3. **Record a human narrator**, or clone a voice with a model whose licence and
   training data permit it, and use this tool only to rough out timings.

Nothing in the pipeline depends on Silero specifically — `Narrator` in
`synth.py` is the only place that touches it, so swapping engines is a small,
contained change rather than a rewrite.

## Known rough edges

- **Homographs.** `за́мок` and `замо́к` are spelled identically, and the model
  guesses from context — sometimes wrongly. Force it with a `+` before the
  stressed vowel: `з+амок`. The same trick fixes invented names the model has
  never seen.
- **Latin words** are read with a Russian accent. `BMW` and `Lucky Strike` come
  out understandable but not English. Transliterate in the source if it grates.
- **Emotion is flat.** This is a competent reading, not a performance — right for
  catching a clumsy sentence, wrong for a finished audiobook.
- **No per-character voices.** Everything is one narrator. Dialogue-aware casting
  would mean detecting speakers and running several voices; worth it only if the
  published audiobook goes that way.

## Where this goes next

Recording and playback are out of scope, but the tool already emits the piece
that connects them. `manifest.json` carries, for every chapter, its file,
duration, and a list of **cues** — each synthesised fragment with its start and
end time:

```json
{ "number": 7, "title": "Глава 7", "file": "07-….wav", "duration": 2411.5,
  "cues": [ { "start": 1.94, "end": 11.57, "text": "Коридор пах бумагой…" } ] }
```

That is exactly what a player on the site needs to highlight the sentence being
read, let a reader click a paragraph to jump to it, or resume where they stopped.
Building that means adding an audio player to `app/`, deciding where the audio
files live (they are far too large for the git repository — object storage or a
CDN), and gating them by the same chapter clearance the archive already uses for
spoilers.
