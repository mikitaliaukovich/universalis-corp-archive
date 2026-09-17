import { Link } from 'react-router'
import type { ReactNode } from 'react'
import { content, type Entity } from '../../lib/content'
import { hrefFor } from '../../lib/routes'
import { useLocked, useSettings } from '../../lib/settings'
import { sfx } from '../../lib/sound'
import { EntityThumb } from './EntityThumb'
import { LockIcon } from './ListMenu'
import { Redacted } from './Redacted'

/** Shown instead of an entity the reader has not reached yet. */
export function LockedNotice({ entity }: { entity: Entity }) {
  const { t, declassify } = useSettings()
  return (
    <div className="locked-notice">
      <LockIcon />
      <h3>{t('locked.title')}</h3>
      <p>{t('locked.body', { ch: entity.firstChapter })}</p>
      <div className="bars" aria-hidden="true">
        {[86, 64, 92, 40, 72].map((w, i) => (
          <span key={i} style={{ width: `${w}%` }} />
        ))}
      </div>
      <button
        type="button"
        className="key-btn key-btn--danger"
        onClick={() => {
          sfx.select()
          declassify(entity.id)
        }}
      >
        {t('locked.override')}
      </button>
    </div>
  )
}

/** Name that respects spoiler locks. */
export function EntityName({ entity }: { entity: Entity }) {
  const { l } = useSettings()
  const locked = useLocked()
  return locked(entity) ? <Redacted ch={entity.firstChapter}>{l(entity.name)}</Redacted> : <>{l(entity.name)}</>
}

/** Vertical list of linked entities with thumbnails. */
export function EntityList({ ids, note }: { ids: string[]; note?: (e: Entity) => ReactNode }) {
  const { l, t } = useSettings()
  const locked = useLocked()
  const entities = ids.map((id) => content.byId.get(id)).filter((e): e is Entity => !!e)
  if (!entities.length) return <p className="muted small">{t('common.none')}</p>
  return (
    <ul className="entitylist">
      {entities.map((e) => {
        const isLocked = locked(e)
        return (
          <li key={e.id}>
            <Link to={hrefFor(e)} className={`entitylist__item ${isLocked ? 'is-locked' : ''}`} onClick={() => sfx.blip()}>
              {isLocked ? <span className="thumb thumb--sm thumb--locked"><LockIcon /></span> : <EntityThumb entity={e} size="sm" />}
              <span className="entitylist__text">
                <span className="entitylist__name">{isLocked ? <span className="redacted redacted--static">{l(e.name)}</span> : l(e.name)}</span>
                {!isLocked && note && <span className="entitylist__note">{note(e)}</span>}
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

export function FactTable({ rows }: { rows: [ReactNode, ReactNode][] }) {
  return (
    <dl className="facts">
      {rows
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v], i) => (
          <div className="facts__row" key={i}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
    </dl>
  )
}

export function Backlinks({ id }: { id: string }) {
  const ids = [...(content.backlinks.get(id) ?? [])].sort((a, b) => {
    const ea = content.byId.get(a)!
    const eb = content.byId.get(b)!
    return ea.kind.localeCompare(eb.kind) || ea.firstChapter - eb.firstChapter
  })
  const { t } = useSettings()
  return <EntityList ids={ids} note={(e) => t(`kind.${e.kind}`)} />
}

export function SubHead({ children, code }: { children: ReactNode; code?: string }) {
  return (
    <h3 className="subhead">
      <span>{children}</span>
      {code && <span className="subhead__code">{code}</span>}
    </h3>
  )
}

export function ChapterRef({ n }: { n: number }) {
  const { l } = useSettings()
  const c = content.chapters.find((x) => x.number === n)
  if (!c) return <>—</>
  return (
    <Link to={hrefFor(c)} className="wikilink">
      {String(n).padStart(2, '0')} · {l(c.name)}
    </Link>
  )
}
