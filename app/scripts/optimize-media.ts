/**
 * npm run optimize-media — creates web-sized "<name>.web.webp" copies next to large images
 * in /content/media. The site shows the optimized copy automatically and keeps the
 * original for the lightbox "Original" link. Re-run after adding or replacing images.
 */
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const MEDIA = fileURLToPath(new URL('../content/media', import.meta.url))
const MAX_WIDTH = 1600
const MIN_BYTES = 250_000

function walk(dir: string, out: string[] = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

let made = 0
for (const file of walk(MEDIA)) {
  if (!/\.(png|jpe?g|webp)$/i.test(file) || file.endsWith('.web.webp')) continue
  const src = statSync(file)
  if (src.size < MIN_BYTES) continue
  const target = file.replace(/\.[^.]+$/, '.web.webp')
  try {
    if (statSync(target).mtimeMs >= src.mtimeMs) continue
  } catch {
    /* not generated yet */
  }
  await sharp(file).resize({ width: MAX_WIDTH, withoutEnlargement: true }).webp({ quality: 84 }).toFile(target)
  const kb = (n: number) => `${Math.round(n / 1024)} KB`
  console.log(`${file.slice(MEDIA.length + 1)}: ${kb(src.size)} → ${kb(statSync(target).size)}`)
  made++
}
console.log(made ? `✓ ${made} image(s) optimized` : '✓ all images already optimized')
