import type { CSSProperties } from 'react'
import { content, type Entity, type Image } from '../../lib/content'
import { Silhouette } from './Silhouette'

const PREFERRED = ['cover', 'portrait', 'moodboard', 'concept', 'sheet', 'location', 'reference']

export function primaryImage(e: Entity) {
  for (const kind of PREFERRED) {
    const img = e.images.find((i) => i.kind === kind)
    if (img) return img
  }
  return e.images[0]
}

/** Style that applies an image's configured focal crop (object-fit: cover is set in CSS). */
export function focusStyle(img: Image): CSSProperties {
  const f = img.focus
  if (!f) return { objectPosition: '50% 0%' }
  return {
    objectPosition: `${f.x}% ${f.y}%`,
    transform: f.zoom > 1 ? `scale(${f.zoom})` : undefined,
    transformOrigin: `${f.x}% ${f.y}%`,
  }
}

/** Small thumbnail (full colour) or a hatched silhouette. */
export function EntityThumb({ entity, size = 'md' }: { entity: Entity; size?: 'sm' | 'md' }) {
  const img = primaryImage(entity)
  return (
    <span className={`thumb thumb--${size}`}>
      {img ? (
        <img src={img.url} alt="" loading="lazy" style={focusStyle(img)} />
      ) : entity.kind === 'character' ? (
        <Silhouette compact />
      ) : (
        <span className="thumb__glyph">{thumbGlyph(entity)}</span>
      )}
    </span>
  )
}

function thumbGlyph(e: Entity) {
  if (e.kind === 'chapter') return String(e.number).padStart(2, '0')
  if (e.kind === 'release') return content.taxonomy.releaseFormats.find((f) => f.id === e.format)?.code || '§'
  return '§'
}
