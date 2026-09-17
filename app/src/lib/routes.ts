import { content, type Entity } from './content'

const VIEW_FOR_KIND = { chapter: 'chronicle', character: 'personnel', term: 'glossary' } as const

export function sectionForKind(kind: Entity['kind']) {
  return content.site.sections.find((s) => s.view === VIEW_FOR_KIND[kind])
}

export function hrefFor(e: Entity) {
  const s = sectionForKind(e.kind)
  return s ? `/${s.path}/${e.id}` : '/'
}

export function isTypingTarget(t: EventTarget | null) {
  const el = t as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
}

/** Stable pseudo-random from a string (for redaction bar widths, stamp tilt…). */
export function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (h >>> 0) / 4294967295
}
