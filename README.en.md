<div align="center">

[Русский](README.md) · **English**

```
   ╔══════════════════════════════════════════════════════════════╗
   ║                                                              ║
   ║        Ψ   U N I V E R S A L I S                             ║
   ║            TERMINAL OTK-7 · PURIFICATION DEPT. · 1979        ║
   ║                                                              ║
   ║        > MOUNTING ARCHIVE OF FATES ....... ∞ VOLUMES         ║
   ║        > PAGER NETWORK .... SIGNAL FROM PURGATORY WEAK       ║
   ║        > EVERY SNEEZE IS RECORDED.                           ║
   ║                                                              ║
   ║        ACCESS GRANTED █                                      ║
   ║                                                              ║
   ╚══════════════════════════════════════════════════════════════╝
```

# Искупление · Redemption

**The official artbook, lore archive and glossary of the novel _«Искупление»_ (_Redemption_) by Mikita Liaukovich**

### [▶ Open the Archive](https://mikitaliaukovich.github.io/universalis-corp-archive/)

</div>

---

## The book

> *«And only darkness and the silence…»*

Mari Doberstein is thirty-six, a lawyer from Kraków, and the author of her own undoing. One night she drives through the wall of a parking garage and takes her husband and son with her.

She wakes on a hospital couch in an endless black void. Across the silence comes the clatter of a typewriter.

Purgatory, it turns out, is a **bureaucracy**. The Universalis Corporation is a secret concrete facility frozen somewhere around 1979. Its clerks stamp case files, runners sprint between cubicles, the fates of every living soul are computed by hand, and the Angels of Death answer to pagers. Mari has violated seven points of the Charter. A demoted ferryman of souls offers her a way out: seven assignments, seven souls, and Paradise for the family she killed.

Nobody reads the fine print. That was always her problem.

**«Искупление»** (*Redemption*) is a novel in progress, written in Russian, about guilt, atonement and the paperwork in between.

## The archive

This repository holds a companion to the book. It's a web app that looks and behaves like a reference terminal of the Universalis Corporation: amber phosphor, a curved picture tube, scanlines and a boot sequence. Pager messages arrive from Purgatory now and then.

| | Section | Inside |
|:-:|---|---|
| 📼 | **Chronicle** | A chapter-by-chapter chronology of events and the lore each chapter reveals |
| 🗂️ | **Personnel files** | Character dossiers, backstories, relations and the concept art that shaped them |
| 🗃️ | **Card index** | A glossary of departments, ranks, documents, places and the laws of the afterlife |

**Spoiler-safe by design.** On the first visit the terminal asks for your *clearance level*: the last chapter you've read. Everything beyond it arrives as black redaction bars stamped **TOP SECRET**. You can declassify them, if you dare.

**Bilingual.** Russian and English, switchable at any moment.

**Full-colour art on a monochrome screen.** The interface glows in a single phosphor colour, while character designs and moodboards "develop" into full colour like photographs clipped into a case file.

## For the curious

The app lives in [`app/`](app). All lore is plain Markdown and YAML in [`app/content/`](app/content), so the archive grows with the book and no code changes are needed.

```bash
cd app
npm install
npm run dev
```

The technical guide covers editing content, the markup extensions, themes and image handling: [`app/README.md`](app/README.md).

## Author

**Mikita Liaukovich**
Author of *Redemption* and keeper of this archive.

<div align="center">

---

<sub>© Mikita Liaukovich. The novel, its characters, lore texts and artwork are all rights reserved.</sub>

<sub>*Do not hold up the queue.*</sub>

</div>
