/**
 * Pure content parsing & validation. Shared by the browser bundle (via import.meta.glob)
 * and by the Node validator script (via fs). Knows nothing about the world itself —
 * every name, label and list comes from /content.
 */
import { parse as parseYaml } from 'yaml'
import { z } from 'zod'

export const L10n = z.record(z.string(), z.string())
export type L10n = z.infer<typeof L10n>

const L10nList = z.record(z.string(), z.array(z.string()))

/* ------------------------------------------------------------------ config */

const Labeled = z.object({ label: L10n }).loose()

export const SiteSchema = z.object({
  languages: z.array(z.object({ id: z.string(), label: z.string() })).min(1),
  defaultLanguage: z.string(),
  detectBrowserLanguage: z.boolean().default(true),
  org: L10n,
  title: L10n,
  terminal: L10n,
  sections: z
    .array(
      z.object({
        id: z.string(),
        path: z.string(),
        view: z.enum(['chronicle', 'personnel', 'glossary']),
        hotkey: z.string().optional(),
        label: L10n,
        code: z.string().optional(),
        description: L10n.default({}),
      }),
    )
    .min(1),
  boot: z.object({ lines: L10nList, final: L10n }),
  clock: z.object({ label: L10n, ratio: z.number().positive().default(60) }),
  pager: z.object({
    enabled: z.boolean().default(true),
    firstDelaySeconds: z.number().default(25),
    intervalSeconds: z.tuple([z.number(), z.number()]).default([60, 140]),
    displaySeconds: z.number().default(9),
    messages: L10nList,
  }),
  quotes: L10nList,
  home: z.object({ intro: L10n, forcesTitle: L10n, forces: z.array(z.object({ id: z.string(), text: L10n })).default([]) }),
})
export type Site = z.infer<typeof SiteSchema>

export const TaxonomySchema = z.object({
  realms: z.record(z.string(), Labeled.extend({ code: z.string().default('') })),
  chapterStatuses: z.record(z.string(), Labeled.extend({ stamp: L10n.optional() })),
  characterStatuses: z.record(z.string(), Labeled.extend({ stamp: L10n })),
  factions: z.array(z.object({ id: z.string(), label: L10n, description: L10n.default({}) })),
  glossaryCategories: z.array(z.object({ id: z.string(), label: L10n, code: z.string().default('') })),
  clearance: z.record(z.string(), Labeled),
  imageKinds: z.record(z.string(), Labeled),
})
export type Taxonomy = z.infer<typeof TaxonomySchema>

const Palette = z.object({
  label: L10n,
  bg: z.string(),
  panel: z.string(),
  fg: z.string(),
  dim: z.string(),
  faint: z.string(),
  accent: z.string(),
  danger: z.string(),
  ink: z.string(),
})
export type Palette = z.infer<typeof Palette>

export const EffectsSchema = z.object({
  boot: z.boolean().default(true),
  scanlines: z.boolean().default(true),
  flicker: z.boolean().default(true),
  curvature: z.boolean().default(true),
  noise: z.boolean().default(true),
  glow: z.boolean().default(true),
  typewriter: z.boolean().default(true),
  pager: z.boolean().default(true),
  sound: z.boolean().default(false),
})
export type Effects = z.infer<typeof EffectsSchema>

export const ThemeSchema = z.object({
  defaultPalette: z.string(),
  palettes: z.record(z.string(), Palette),
  fonts: z.object({ ui: z.string(), heading: z.string(), typewriter: z.string() }),
  effects: EffectsSchema,
  crt: z
    .object({
      curvature: z.number().min(0).max(0.25).default(0.02),
      softness: z.number().min(0).max(2).default(0.4),
    })
    .default({ curvature: 0.02, softness: 0.4 }),
})
export type Theme = z.infer<typeof ThemeSchema>

export const I18nSchema = z.record(z.string(), z.string())

/* ---------------------------------------------------------------- entities */

const Id = z.string().regex(/^[a-z0-9-]+$/, 'ids must be lowercase latin, digits and dashes')

const ImageSchema = z.object({
  file: z.string(),
  kind: z.string().default('concept'),
  caption: L10n.default({}),
  /** crop used for thumbnails & dossier photo: focal point in % and zoom factor */
  focus: z
    .object({ x: z.number().min(0).max(100).default(50), y: z.number().min(0).max(100).default(0), zoom: z.number().min(1).default(1) })
    .optional(),
})

const BaseMeta = z.object({
  id: Id,
  name: L10n,
  summary: L10n.default({}),
  firstChapter: z.number().int().min(0).default(0),
  clearance: z.string().default('open'),
  order: z.number().default(100),
  tags: z.array(z.string()).default([]),
  images: z.array(ImageSchema).default([]),
})

export const CharacterMeta = BaseMeta.extend({
  status: z.string(),
  faction: z.string(),
  /** overrides the status stamp text, e.g. for grammatical gender */
  stamp: L10n.optional(),
  role: L10n.default({}),
  quote: L10n.optional(),
  reference: L10n.optional(),
  facts: z.array(z.object({ label: L10n, value: L10n })).default([]),
  relations: z.array(z.object({ id: Id, type: L10n })).default([]),
})

export const ChapterMeta = BaseMeta.extend({
  number: z.number().int().min(1),
  pov: z.string().optional(),
  realm: z.string(),
  status: z.string(),
  trial: L10n.optional(),
  setting: L10n.default({}),
  characters: z.array(Id).default([]),
  terms: z.array(Id).default([]),
})

export const TermMeta = BaseMeta.extend({
  category: z.string(),
  aliases: L10nList.default({}),
  related: z.array(Id).default([]),
})

export type Image = z.infer<typeof ImageSchema> & { url: string; original: string }
type Bodies = { body: L10n; kind: EntityKind }
export type Character = Omit<z.infer<typeof CharacterMeta>, 'images'> & Bodies & { kind: 'character'; images: Image[] }
export type Chapter = Omit<z.infer<typeof ChapterMeta>, 'images'> & Bodies & { kind: 'chapter'; images: Image[] }
export type Term = Omit<z.infer<typeof TermMeta>, 'images'> & Bodies & { kind: 'term'; images: Image[] }
export type Entity = Character | Chapter | Term
export type EntityKind = 'character' | 'chapter' | 'term'

const FOLDERS: Record<string, { kind: EntityKind; schema: z.ZodTypeAny }> = {
  characters: { kind: 'character', schema: CharacterMeta },
  chapters: { kind: 'chapter', schema: ChapterMeta },
  glossary: { kind: 'term', schema: TermMeta },
}

export interface Content {
  site: Site
  theme: Theme
  taxonomy: Taxonomy
  i18n: Record<string, Record<string, string>>
  entities: Entity[]
  byId: Map<string, Entity>
  chapters: Chapter[]
  characters: Character[]
  terms: Term[]
  /** id -> ids of entities that reference it */
  backlinks: Map<string, Set<string>>
  maxChapter: number
  errors: string[]
}

/** Matches [[id]] and [[id|label]] wiki links in markdown bodies. */
export const WIKI_LINK = /\[\[([a-z0-9-]+)(?:\|([^\]]*))?\]\]/g

function fmtZod(file: string, err: z.ZodError) {
  return err.issues.map((i) => `${file}: ${i.path.join('.') || '(root)'} — ${i.message}`)
}

/**
 * @param files map of '/content/...' path -> raw file text (yaml & md)
 * @param media map of '/content/media/...' path -> public url
 */
export function buildContent(files: Record<string, string>, media: Record<string, string>): Content {
  const errors: string[] = []

  function load<T extends z.ZodTypeAny>(path: string, schema: T): z.infer<T> | undefined {
    const raw = files[path]
    if (raw == null) {
      errors.push(`${path}: file is missing`)
      return undefined
    }
    let data: unknown
    try {
      data = parseYaml(raw)
    } catch (e) {
      errors.push(`${path}: YAML error — ${(e as Error).message}`)
      return undefined
    }
    const res = schema.safeParse(data)
    if (!res.success) {
      errors.push(...fmtZod(path, res.error))
      return undefined
    }
    return res.data
  }

  const site = load('/content/site.yaml', SiteSchema)
  const theme = load('/content/theme.yaml', ThemeSchema)
  const taxonomy = load('/content/taxonomy.yaml', TaxonomySchema)
  if (!site || !theme || !taxonomy) {
    throw new Error('Core configuration is invalid:\n' + errors.join('\n'))
  }
  const langs = site.languages.map((l) => l.id)

  const i18n: Record<string, Record<string, string>> = {}
  for (const lang of langs) i18n[lang] = load(`/content/i18n/${lang}.yaml`, I18nSchema) ?? {}

  const entities: Entity[] = []
  const metaPaths = Object.keys(files).filter((p) => /^\/content\/[^/]+\/[^/]+\/meta\.yaml$/.test(p))
  for (const path of metaPaths.sort()) {
    const [, , folder, dir] = path.split('/')
    const def = FOLDERS[folder]
    if (!def) continue
    const meta = load(path, def.schema) as z.infer<typeof BaseMeta> | undefined
    if (!meta) continue
    if (meta.id !== dir) errors.push(`${path}: id "${meta.id}" must match folder name "${dir}"`)
    const body: L10n = {}
    for (const lang of langs) {
      const md = files[`/content/${folder}/${dir}/${lang}.md`]
      if (md == null) errors.push(`/content/${folder}/${dir}/${lang}.md: missing translation`)
      body[lang] = md ?? ''
    }
    const images = meta.images.map((img) => {
      const key = '/content/' + img.file.replace(/^\/?(content\/)?/, '')
      const original = media[key]
      if (!original) errors.push(`${path}: image not found — ${img.file}`)
      // prefer the web-sized copy made by `npm run optimize-media`
      const optimized = media[key.replace(/\.[^.]+$/, '.web.webp')]
      return { ...img, url: optimized ?? original ?? '', original: original ?? '' }
    })
    entities.push({ ...(meta as object), kind: def.kind, body, images } as Entity)
  }

  const byId = new Map<string, Entity>()
  for (const e of entities) {
    if (byId.has(e.id)) errors.push(`duplicate id "${e.id}" (${e.kind} and ${byId.get(e.id)!.kind})`)
    byId.set(e.id, e)
  }

  const chapters = entities.filter((e): e is Chapter => e.kind === 'chapter').sort((a, b) => a.number - b.number)
  for (const c of chapters) c.firstChapter = c.number
  const characters = entities.filter((e): e is Character => e.kind === 'character').sort(byOrder)
  const terms = entities.filter((e): e is Term => e.kind === 'term').sort(byOrder)
  const maxChapter = chapters.reduce((m, c) => Math.max(m, c.number), 0)

  // ---- cross references & validation
  const backlinks = new Map<string, Set<string>>()
  const ref = (from: Entity, to: string, where: string) => {
    if (!byId.has(to)) {
      errors.push(`${from.kind} "${from.id}": ${where} references unknown id "${to}"`)
      return
    }
    if (to === from.id) return
    if (!backlinks.has(to)) backlinks.set(to, new Set())
    backlinks.get(to)!.add(from.id)
  }
  const factionIds = new Set(taxonomy.factions.map((f) => f.id))
  const categoryIds = new Set(taxonomy.glossaryCategories.map((c) => c.id))

  for (const e of entities) {
    for (const lang of langs) {
      if (!e.name[lang]) errors.push(`${e.kind} "${e.id}": name.${lang} is missing`)
      for (const m of e.body[lang].matchAll(WIKI_LINK)) ref(e, m[1], `${lang}.md`)
    }
    if (!taxonomy.clearance[e.clearance]) errors.push(`${e.kind} "${e.id}": unknown clearance "${e.clearance}"`)
    for (const img of e.images)
      if (!taxonomy.imageKinds[img.kind]) errors.push(`${e.kind} "${e.id}": unknown image kind "${img.kind}"`)
    if (e.firstChapter > maxChapter) errors.push(`${e.kind} "${e.id}": firstChapter ${e.firstChapter} > last chapter`)

    if (e.kind === 'character') {
      if (!taxonomy.characterStatuses[e.status]) errors.push(`character "${e.id}": unknown status "${e.status}"`)
      if (!factionIds.has(e.faction)) errors.push(`character "${e.id}": unknown faction "${e.faction}"`)
      e.relations.forEach((r) => ref(e, r.id, 'relations'))
    } else if (e.kind === 'chapter') {
      if (!taxonomy.realms[e.realm]) errors.push(`chapter "${e.id}": unknown realm "${e.realm}"`)
      if (!taxonomy.chapterStatuses[e.status]) errors.push(`chapter "${e.id}": unknown status "${e.status}"`)
      if (e.pov) ref(e, e.pov, 'pov')
      e.characters.forEach((id) => ref(e, id, 'characters'))
      e.terms.forEach((id) => ref(e, id, 'terms'))
    } else {
      if (!categoryIds.has(e.category)) errors.push(`term "${e.id}": unknown category "${e.category}"`)
      e.related.forEach((id) => ref(e, id, 'related'))
    }
  }
  for (const s of site.sections) for (const lang of langs) if (!s.label[lang]) errors.push(`site.yaml: section "${s.id}" label.${lang} missing`)
  if (!theme.palettes[theme.defaultPalette]) errors.push(`theme.yaml: defaultPalette "${theme.defaultPalette}" not defined`)

  // i18n key parity
  const [first, ...rest] = langs
  for (const lang of rest) {
    for (const k of Object.keys(i18n[first])) if (!(k in i18n[lang])) errors.push(`i18n/${lang}.yaml: missing key "${k}"`)
    for (const k of Object.keys(i18n[lang])) if (!(k in i18n[first])) errors.push(`i18n/${first}.yaml: missing key "${k}"`)
  }

  return { site, theme, taxonomy, i18n, entities, byId, chapters, characters, terms, backlinks, maxChapter, errors }
}

function byOrder(a: { order: number; id: string }, b: { order: number; id: string }) {
  return a.order - b.order || a.id.localeCompare(b.id)
}

/** Chapters in which a character/term is listed or linked. */
export function appearancesOf(content: Content, id: string): Chapter[] {
  return content.chapters.filter((c) => c.characters.includes(id) || c.terms.includes(id) || c.pov === id)
}
