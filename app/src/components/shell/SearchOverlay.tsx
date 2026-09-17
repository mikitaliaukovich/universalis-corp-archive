import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { content, type Entity } from '../../lib/content'
import { plainText, stripSecrets } from '../../lib/markdown'
import { hrefFor } from '../../lib/routes'
import { useLocked, useSettings } from '../../lib/settings'
import { useUi } from '../../lib/ui'
import { sfx } from '../../lib/sound'
import { Modal } from './Modal'
import { EntityThumb } from '../ui/EntityThumb'

interface Hit {
  entity: Entity
  score: number
  snippet: string
}

export function SearchOverlay() {
  const { l, t, settings } = useSettings()
  const locked = useLocked()
  const { setOverlay } = useUi()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)

  const index = useMemo(
    () =>
      content.entities.map((e) => {
        const aliases = e.kind === 'term' ? (e.aliases[settings.lang] ?? []).join(' ') : ''
        return {
          entity: e,
          name: l(e.name).toLowerCase(),
          alias: aliases.toLowerCase(),
          summary: l(e.summary),
          // anything classified is left out so search can't leak spoilers
          body: plainText(stripSecrets(e.body[settings.lang] ?? ''), (id) => {
            const target = content.byId.get(id)
            return target ? l(target.name) : id
          }),
        }
      }),
    [settings.lang, l],
  )

  const hits = useMemo<Hit[]>(() => {
    const query = q.trim().toLowerCase()
    if (query.length < 2) return []
    const out: Hit[] = []
    for (const row of index) {
      if (locked(row.entity)) continue
      let score = 0
      let snippet = row.summary
      if (row.name.startsWith(query)) score = 100
      else if (row.name.includes(query)) score = 70
      else if (row.alias.includes(query)) score = 60
      else if (row.summary.toLowerCase().includes(query)) score = 40
      else {
        const at = row.body.toLowerCase().indexOf(query)
        if (at >= 0) {
          score = 20
          snippet = '…' + row.body.slice(Math.max(0, at - 50), at + 90) + '…'
        }
      }
      if (score) out.push({ entity: row.entity, score, snippet })
    }
    return out.sort((a, b) => b.score - a.score).slice(0, 30)
  }, [q, index, locked])

  const go = (h: Hit) => {
    sfx.select()
    setOverlay(null)
    navigate(hrefFor(h.entity))
  }

  return (
    <Modal title={t('search.title')} code="QRY" onClose={() => setOverlay(null)} wide>
      <label className="prompt">
        <span className="prompt__sign">&gt;</span>
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setSel(0)
            sfx.click()
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') setSel((s) => Math.min(s + 1, hits.length - 1))
            else if (e.key === 'ArrowUp') setSel((s) => Math.max(s - 1, 0))
            else if (e.key === 'Enter' && hits[sel]) go(hits[sel])
            else return
            e.preventDefault()
          }}
          placeholder={t('search.placeholder')}
          aria-label={t('search.title')}
          spellCheck={false}
          autoComplete="off"
        />
      </label>
      <p className="muted small">
        {q.trim().length < 2 ? t('search.hint') : t('search.found', { n: hits.length })}
      </p>
      <ul className="results">
        {hits.map((h, i) => (
          <li key={h.entity.id}>
            <button
              type="button"
              className={`result ${i === sel ? 'is-selected' : ''}`}
              onMouseEnter={() => setSel(i)}
              onClick={() => go(h)}
            >
              <EntityThumb entity={h.entity} size="sm" />
              <span className="result__text">
                <span className="result__kind">{t(`kind.${h.entity.kind}`)}</span>
                <strong>{l(h.entity.name)}</strong>
                <span className="result__snippet">{h.snippet}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
