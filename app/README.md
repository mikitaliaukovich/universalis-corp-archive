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
| `site.yaml` | Title, header line, sections (menu, hotkeys, URLs), boot lines, password gate, header radio, newcomer tips, pager messages, Charter quotes, home screen, word lists for the games |
| `theme.yaml` | Phosphor palettes, fonts, default effects (scanlines, flicker, sound…) |
| `taxonomy.yaml` | Realms, chapter/character statuses and stamps, factions, glossary categories, release formats and statuses, image kinds |
| `i18n/<lang>.yaml` | Every interface string |
| `chapters/<id>/` | One chapter: `meta.yaml` + `ru.md` + `en.md` |
| `characters/<id>/` | One personnel file |
| `glossary/<id>/` | One glossary card (places live here too, category `places`) |
| `releases/<id>/` | One card on the release plan (book, series, film, game…) |
| `media/` | Images referenced from `meta.yaml` |

**Add an entry:** copy an existing folder, rename it (the folder name is the id: lowercase latin, digits, dashes), change `id` inside `meta.yaml`, edit the texts. It appears automatically. Run `npm run check` to catch typos in ids, missing translations or images.

**Add a language:** add it to `languages` in `site.yaml`, create `i18n/<lang>.yaml`, add `<lang>` values to the `{ ru, en }` fields and a `<lang>.md` per entry — the validator lists everything missing.

### Home screen

The home screen opens as a column of cards: one per section in `site.yaml` (its label, description, hotkey and record count over a phosphor-tinted picture from that section, chosen among records the reader's clearance allows), then search, clearance and settings. Readers can switch to the classic three-column layout (operator panel, menu, Charter quotes and `home.forces`) in Settings → Home screen; the intro text comes from `home.intro` in both.

### Password gate

`access` in `site.yaml` makes the boot sequence stop at a password prompt. Only its SHA-256 hash is stored — don't write the password itself into `content/`, every file there ships with the site. A device that entered the right password isn't asked again until the password changes.

```yaml
access:
  enabled: true        # false + redeploy = archive open to everyone
  passwordHash: "…"    # SHA-256 of the password
```

To change the password, run `npm run hash-password -- "new password"` and paste the printed line into `site.yaml`. This is a courtesy gate for sharing a preview, not real protection: the site is static, so all its content is still downloadable by anyone with the URL.

### Radio

`radio` in `site.yaml` puts a radio set in the header that plays a YouTube / YouTube Music playlist. Listeners see only the current track, play/pause, next and volume, never the track list. `M` toggles it.

```yaml
radio:
  enabled: true                  # false + redeploy removes the radio
  playlistId: "PLFh8MxUSUPVA"    # the part after list= in the playlist URL (music.youtube.com or youtube.com)
  shuffle: true                  # random start and order
  volume: 60                     # default volume; each listener's own setting is remembered
```

The playlist must be public or unlisted. Tracks whose owners forbid embedding are skipped automatically; after five unplayable tracks in a row the readout shows NO SIGNAL. The page contacts YouTube only after a visitor reaches for the radio, and then through `youtube-nocookie.com`. The player runs hidden, so only its sound is used.

### Release plan

The **Release plan** tab (hotkey `4`) shows the order in which the books, series, films and games come out, drawn as a branching line: the main story is the trunk and the side stories split off it. Each release is a point on its line; clicking its card opens the full description. Each entry is a folder in `releases/`.

```yaml
id: redemption
order: 1                     # position on the timeline across all lines (lowest first)
line: main                   # main | side  (taxonomy.yaml → releaseLines)
format: book                 # book | novella | series | movie | game  (taxonomy.yaml → releaseFormats)
status: production           # released | production | planned | concept  (taxonomy.yaml → releaseStatuses)
name: { ru: "…", en: "…" }
date: { ru: "Осень 2027", en: "Autumn 2027" }   # optional, free-form; left out = "to be announced"
summary: { ru: "…", en: "…" }                   # the text on the timeline card
facts:                       # any extra rows for the fact table: author, pages, platform, cast…
  - label: { ru: "Автор", en: "Author" }
    value: { ru: "…", en: "…" }
links:                       # optional buttons to outside pages: store, pre-order, trailer…
  - label: { ru: "Предзаказ", en: "Pre-order" }
    url: "https://…"
related: [mari, charon]      # characters, chapters, terms or other releases
images:
  - file: media/releases/redemption/cover.jpg
    kind: cover
```

The longer description goes into `ru.md` / `en.md`, with the same Markdown extensions as everywhere else. Story lines, formats and statuses are listed in `taxonomy.yaml`. The first line in `releaseLines` is the trunk. A line with `branchFrom: <line id>` splits off that line just above its own first release. Within a line, releases are numbered in `order`.

### Recreation

The **Recreation** tab (hotkey `5`) holds five games drawn in text characters on the terminal screen, so they follow the reader's phosphor colour and tube effects:

| Program | Game |
|---|---|
| Terminal access | Guess the password hidden in a memory dump; each wrong word reports how many letters are in place. Bracket pairs on one line remove a dud or restore the attempts |
| Pneumatic mail | Snake: lay the tube and pick up capsules |
| Redaction | Minesweeper: uncover the file and put a black bar over every secret |
| Archive shelving | Tetris, drawn like the 1984 original |
| The queue | Approve case files or return them for revision according to a directive that keeps changing |

Clicking the screen or pressing `ENTER` gives the keyboard to the game, and the archive's hotkeys stay quiet while it plays. `ESC` pauses it and gives the keyboard back. A second `ESC` returns to the list. On touch screens an on-screen pad appears. Records are kept per device.

The passwords of the terminal hack are single words of 5–8 letters taken from the names of cards and personnel files open at the reader's clearance, topped up by `games.words` in `site.yaml`. The souls in the queue are named from `games.names` and `games.surnames`. All game texts are `games.*` strings in `i18n/<lang>.yaml`. The games themselves are code in `src/games/`. To add one, write a component that renders through `GameShell` and register it in `src/games/registry.ts`.

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
