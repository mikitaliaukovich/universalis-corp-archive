/**
 * npm run check — validates everything under /content:
 * schemas, both translations, cross-reference ids, image files, i18n key parity.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildContent, WIKI_LINK } from '../src/lib/contentCore'

const root = fileURLToPath(new URL('..', import.meta.url))
const contentDir = join(root, 'content')

function walk(dir: string, out: string[] = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

const files: Record<string, string> = {}
const media: Record<string, string> = {}
for (const abs of walk(contentDir)) {
  const key = '/' + relative(root, abs).split(sep).join('/')
  if (/\.(ya?ml|md)$/i.test(abs)) files[key] = readFileSync(abs, 'utf8')
  else if (key.startsWith('/content/media/')) media[key] = key
}

let content
try {
  content = buildContent(files, media)
} catch (e) {
  console.error('\x1b[31m' + (e as Error).message + '\x1b[0m')
  process.exit(1)
}

const errors = [...content.errors]

// wiki links inside site.yaml (home screen)
for (const m of files['/content/site.yaml'].matchAll(WIKI_LINK))
  if (!content.byId.has(m[1])) errors.push(`site.yaml: link to unknown id "${m[1]}"`)

// unused media (warning only)
const used = new Set(content.entities.flatMap((e) => e.images.flatMap((i) => [i.url, i.original])))
const unused = Object.keys(media).filter((m) => !used.has(m) && !m.endsWith('.web.webp'))

console.log(
  `content: ${content.chapters.length} chapters, ${content.characters.length} characters, ${content.terms.length} terms, ${Object.keys(media).length} images`,
)
for (const u of unused) console.warn(`\x1b[33mwarning: unused image ${u}\x1b[0m`)
if (errors.length) {
  for (const e of errors) console.error(`\x1b[31m✗ ${e}\x1b[0m`)
  console.error(`\n${errors.length} problem(s) found.`)
  process.exit(1)
}
console.log('\x1b[32m✓ content is valid\x1b[0m')
