# Universalis Archive — «Искупление» / Redemption

A digital artbook, lore chronicle and glossary for the novel, styled as a 1979 terminal of the Universalis Corporation.

```bash
npm install
npm run dev      # http://localhost:5173
npm run check    # validate content
npm run build    # check + type-check + static build into dist/ (works from any folder / static host)
```

**Deployment:** pushes to `main` that touch `app/` are built and published to GitHub Pages by [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml), and served at [universaliscorp.com](https://universaliscorp.com). The build uses relative asset paths and hash routing, so it works both at a domain root and under `https://<user>.github.io/<repo>/` without extra configuration. The custom domain is set in Settings → Pages; a workflow-based deployment needs no `CNAME` file in `dist/`. Run `npm run optimize-media` before committing new images; the workflow does not generate the web-sized copies.

## Editing content — no code changes needed

Everything the site shows lives in [`content/`](content):

| Path | What it controls |
|---|---|
| `site.yaml` | Title, header line, sections (menu, hotkeys, URLs), boot lines, pager messages, Charter quotes, home screen |
| `theme.yaml` | Phosphor palettes, fonts, default effects (scanlines, flicker, sound…) |
| `taxonomy.yaml` | Realms, chapter/character statuses and stamps, factions, glossary categories, image kinds |
| `i18n/<lang>.yaml` | Every interface string |
| `chapters/<id>/` | One chapter: `meta.yaml` + `ru.md` + `en.md` |
| `characters/<id>/` | One personnel file |
| `glossary/<id>/` | One glossary card (places live here too, category `places`) |
| `media/` | Images referenced from `meta.yaml` |

**Add an entry:** copy an existing folder, rename it (the folder name is the id: lowercase latin, digits, dashes), change `id` inside `meta.yaml`, edit the texts. It appears automatically. Run `npm run check` to catch typos in ids, missing translations or images.

**Add a language:** add it to `languages` in `site.yaml`, create `i18n/<lang>.yaml`, add `<lang>` values to the `{ ru, en }` fields and a `<lang>.md` per entry — the validator lists everything missing.

### Markdown extensions

| Syntax | Result |
|---|---|
| `[[charon]]` / `[[pager\|the pager]]` | Cross-reference with hover preview (label defaults to the entry name) |
| `:redact[text]{ch=6}` | Inline redaction — auto-declassified once the reader has read chapter 6, otherwise click to reveal |
| `:redact[text]` | Always redacted until clicked |
| `:::classified{ch=9 title="…"}` … `:::` | Classified block |

### Spoilers

Every entry has `firstChapter`. Readers set their **clearance** (last chapter read) on first visit; entries from later chapters are locked in lists and search, and `ch=` redactions stay closed.

### Images

```yaml
images:
  - file: media/characters/mari/moodboard.png
    kind: moodboard            # portrait | moodboard | sheet | concept | reference | location
    caption: { ru: "…", en: "…" }
    focus: { x: 0, y: 0, zoom: 2.7 }   # optional crop for thumbnails & the dossier photo
```

The first `portrait` (else `moodboard`, `concept`…) becomes the dossier photo. The UI is monochrome; photographs always render in full colour.
