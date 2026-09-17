import { buildContent } from './contentCore'

const files = import.meta.glob('/content/**/*.{yaml,yml,md}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const media = import.meta.glob('/content/media/**/*.{png,jpg,jpeg,webp,gif,svg,avif}', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>

export const content = buildContent(files, media)

if (content.errors.length) {
  console.warn(`[content] ${content.errors.length} problem(s):\n` + content.errors.join('\n'))
}

export * from './contentCore'
