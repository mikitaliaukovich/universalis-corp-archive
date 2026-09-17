import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkDirective from 'remark-directive'
import { visit } from 'unist-util-visit'
import type { ReactNode } from 'react'
import { WIKI_LINK } from './contentCore'
import { WikiLink } from '../components/ui/WikiLink'
import { Redacted, ClassifiedBlock } from '../components/ui/Redacted'

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Supported extensions:
 *   [[id]] / [[id|label]]          → cross-reference with hover card
 *   :redact[text]{ch=5}            → inline redaction, auto-declassified once chapter 5 is read
 *   :::classified{ch=9 title="…"}  → classified block
 */
function remarkLore() {
  return (tree: any) => {
    visit(tree, (node: any, index, parent: any) => {
      if (!node.type?.endsWith('Directive')) return
      if (node.name === 'redact' || node.name === 'classified' || node.name === 'link') {
        const data = (node.data ??= {})
        data.hName = node.name === 'link' ? 'lore-link' : node.type === 'textDirective' ? 'lore-redact' : 'lore-classified'
        data.hProperties = { ...node.attributes }
        return
      }
      // Unknown directive (e.g. "Note:this") — put the text back.
      if (node.type === 'textDirective' && parent && index != null) {
        parent.children.splice(index, 1, { type: 'text', value: ':' + node.name }, ...(node.children ?? []))
        return index
      }
    })
  }
}

/** Turn wiki links into directives before parsing so markdown never splits them. */
function preprocess(md: string) {
  return md.replace(WIKI_LINK, (_, id: string, label?: string) => `:link[${(label ?? '').replace(/[[\]]/g, '')}]{to=${id}}`)
}

const components = {
  'lore-link': ({ to, children }: { to: string; children?: ReactNode }) => <WikiLink id={to}>{children}</WikiLink>,
  'lore-redact': ({ ch, children }: { ch?: string; children?: ReactNode }) => (
    <Redacted ch={ch ? Number(ch) : undefined}>{children}</Redacted>
  ),
  'lore-classified': ({ ch, title, children }: { ch?: string; title?: string; children?: ReactNode }) => (
    <ClassifiedBlock ch={ch ? Number(ch) : undefined} title={title}>
      {children}
    </ClassifiedBlock>
  ),
  a: ({ href, children }: { href?: string; children?: ReactNode }) => (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
} as unknown as Components

export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={`md ${className ?? ''}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkDirective, remarkLore]} components={components}>
        {preprocess(children)}
      </ReactMarkdown>
    </div>
  )
}

/** Remove `:redact[…]{…}` (bracket-balanced) and `:::classified … :::` blocks. */
export function stripSecrets(md: string) {
  let out = md.replace(/^:::classified[^\n]*\n[\s\S]*?^:::\s*$/gm, ' ')
  let i: number
  while ((i = out.indexOf(':redact[')) >= 0) {
    let depth = 0
    let j = i + ':redact'.length
    for (; j < out.length; j++) {
      if (out[j] === '[') depth++
      else if (out[j] === ']' && --depth === 0) break
    }
    let end = j + 1
    if (out[end] === '{') end = out.indexOf('}', end) + 1 || end
    out = out.slice(0, i) + ' ' + out.slice(end)
  }
  return out
}

/** Strip markup for search & previews; `nameOf` resolves [[id]] links without a label. */
export function plainText(md: string, nameOf: (id: string) => string = (id) => id) {
  return md
    .replace(WIKI_LINK, (_, id, label) => label || nameOf(id))
    .replace(/^:::.*$/gm, '')
    .replace(/:\w+\[([^\]]*)\](\{[^}]*\})?/g, '$1')
    .replace(/[#*_>`~|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
