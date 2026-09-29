import type { CSSProperties } from 'react'
import { Link } from 'react-router'
import { motion } from 'motion/react'
import { content, type Release, type Site } from '../lib/content'
import { useLocked, useSettings } from '../lib/settings'
import { hrefFor } from '../lib/routes'
import { Markdown } from '../lib/markdown'
import { Panel } from '../components/ui/Panel'
import { ListMenu } from '../components/ui/ListMenu'
import { Stamp } from '../components/ui/Stamp'
import { PhotoPrint } from '../components/ui/PhotoPrint'
import { TypewriterText } from '../components/ui/TypewriterText'
import { EntityThumb } from '../components/ui/EntityThumb'
import { Backlinks, EntityList, EntityName, FactTable, LockedNotice, SubHead } from '../components/ui/EntityBits'
import { NotFound } from './NotFound'

type Section = Site['sections'][number]

const lines = content.taxonomy.releaseLines
const lineOf = (r: Release) => lines.find((x) => x.id === r.line)
const formatOf = (r: Release) => content.taxonomy.releaseFormats.find((f) => f.id === r.format)
const inLine = (r: Release) => content.releases.filter((x) => x.line === r.line)
/** position within its story line, 01-based */
const numberOf = (r: Release) => String(inLine(r).indexOf(r) + 1).padStart(2, '0')
/** releases grouped by story line, in timeline order within each */
const byLine = lines.flatMap((x) => content.releases.filter((r) => r.line === x.id))

export function Releases({ section, id }: { section: Section; id?: string }) {
  const { l, t } = useSettings()
  const locked = useLocked()
  const release = id ? content.releases.find((r) => r.id === id) : undefined
  if (id && !release) return <NotFound />

  const items = byLine.map((r) => ({
    id: r.id,
    href: `/${section.path}/${r.id}`,
    group: r.line,
    prefix: numberOf(r),
    label: locked(r) ? <span className="redacted redacted--static">{l(r.name)}</span> : l(r.name),
    suffix: formatOf(r)?.code,
    locked: locked(r),
    dim: r.status === 'concept',
  }))

  return (
    <div className={`layout3 ${release ? 'has-selection' : ''}`}>
      <Panel title={l(section.label)} code={section.code} className="layout3__left">
        <ListMenu
          items={items}
          activeId={release?.id}
          primary
          empty={t('common.none')}
          groupLabel={(g) => l(lines.find((x) => x.id === g)?.label)}
        />
        <Legend />
      </Panel>

      <Panel
        key={release?.id ?? 'index'}
        title={release ? t('releases.file', { n: `${lineOf(release)?.code}-${numberOf(release)}` }) : t('releases.index')}
        code={release ? formatOf(release)?.code : 'T-LINE'}
        className="layout3__center"
      >
        {release ? locked(release) ? <LockedNotice entity={release} /> : <ReleaseFile key={release.id} release={release} section={section} /> : <ReleaseGraph />}
      </Panel>

      <Panel title={t('releases.materials')} code="IMG" className="layout3__right">
        {release && !locked(release) ? (
          <>
            {release.images.length > 0 && <PhotoPrint images={release.images} stack />}
            <SubHead code="REL">{t('releases.related')}</SubHead>
            <EntityList ids={release.related} note={(e) => t(`kind.${e.kind}`)} />
            <SubHead code="←">{t('common.mentionedIn')}</SubHead>
            <Backlinks id={release.id} />
          </>
        ) : (
          <>
            <p className="muted">{l(section.description)}</p>
            <LineNotes />
            <FormatStats />
          </>
        )}
      </Panel>
    </div>
  )
}

function Legend() {
  const { l, t } = useSettings()
  return (
    <div className="legend">
      <SubHead>{t('releases.lines')}</SubHead>
      <ul>
        {lines.map((x, i) => (
          <li key={x.id}>
            <span className={`rgraph__sample ${i ? 'is-branch' : ''}`} aria-hidden="true" /> {l(x.label)}
          </li>
        ))}
      </ul>
      <SubHead>{t('releases.statuses')}</SubHead>
      <ul>
        {Object.entries(content.taxonomy.releaseStatuses).map(([id, s]) => (
          <li key={id}>
            <span className={`release-node release-node--${id}`} aria-hidden="true" /> {l(s.label)}
          </li>
        ))}
      </ul>
    </div>
  )
}

function ReleaseFile({ release, section }: { release: Release; section: Section }) {
  const { l, t, settings } = useSettings()
  const status = content.taxonomy.releaseStatuses[release.status]
  const format = formatOf(release)
  const line = lineOf(release)
  const siblings = inLine(release)
  const idx = siblings.indexOf(release)
  const prev = siblings[idx - 1]
  const next = siblings[idx + 1]

  return (
    <article className="casefile">
      <header className="casefile__head">
        <div className="casefile__num">{numberOf(release)}</div>
        <div className="casefile__titles">
          <span className="casefile__kicker">
            <span className="realm-tag">{line?.code}</span> {l(line?.label)}
          </span>
          <h1 className="casefile__title">
            <TypewriterText key={settings.lang} text={l(release.name)} speed={30} />
          </h1>
        </div>
        {status?.stamp && <Stamp text={l(status.stamp)} tone={release.status === 'released' ? 'fg' : 'danger'} seed={release.id} />}
      </header>

      <FactTable
        rows={[
          [t('releases.line'), l(line?.label)],
          [t('releases.format'), l(format?.label)],
          [t('releases.date'), release.date ? l(release.date) : t('releases.tba')],
          [t('releases.status'), l(status?.label)],
          ...release.facts.map((f) => [l(f.label), l(f.value)] as [string, string]),
        ]}
      />

      {l(release.summary) && <p className="lead">{l(release.summary)}</p>}

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Markdown>{release.body[settings.lang] ?? ''}</Markdown>
      </motion.div>

      {release.links.length > 0 && (
        <>
          <SubHead code="URL">{t('releases.links')}</SubHead>
          <div className="release-links">
            {release.links.map((link) => (
              <a key={link.url} className="key-btn" href={link.url} target="_blank" rel="noopener noreferrer">
                {l(link.label)} ↗
              </a>
            ))}
          </div>
        </>
      )}

      <nav className="casefile__nav">
        {prev ? (
          <Link className="key-btn" to={`/${section.path}/${prev.id}`}>
            ◀ {numberOf(prev)} · <EntityName entity={prev} />
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link className="key-btn" to={`/${section.path}/${next.id}`}>
            {numberOf(next)} · <EntityName entity={next} /> ▶
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </article>
  )
}

/* ------------------------------------------------------------ branch graph */

/** horizontal distance between lanes, and from the graph's left edge to the first lane (px) */
const LANE = 40
const PAD = 12
/** vertical position of a release's point within its row (px) — keep in sync with .rgraph__node */
const NODE_Y = 36

interface Lane {
  first: number
  last: number
  /** rows the rail must reach so a branch can split off it */
  reach: number
  parent?: number
}

/**
 * One row per release, in timeline order; one lane per story line that has releases.
 * A lane's rail runs from its first to its last point; a branching line curves out of its parent's rail.
 */
function layoutLanes() {
  const rows = content.releases
  const used = lines.filter((x) => rows.some((r) => r.line === x.id))
  const laneOf = new Map(used.map((x, i) => [x.id, i]))
  const lanes: Lane[] = used.map((x) => {
    const idx = rows.flatMap((r, i) => (r.line === x.id ? [i] : []))
    const parent = x.branchFrom != null ? laneOf.get(x.branchFrom) : undefined
    return { first: idx[0], last: idx[idx.length - 1], reach: idx[idx.length - 1], parent }
  })
  for (const lane of lanes) {
    const p = lane.parent != null ? lanes[lane.parent] : undefined
    if (p && p.first < lane.first) p.reach = Math.max(p.reach, lane.first)
    else lane.parent = undefined
  }
  return { rows, lanes, laneOf }
}

const laneX = (i: number) => PAD + i * LANE

function ReleaseGraph() {
  const { l, t } = useSettings()
  const locked = useLocked()
  const { rows, lanes, laneOf } = layoutLanes()
  const width = laneX(lanes.length - 1) + PAD

  return (
    <ol className="rgraph" style={{ '--graph-w': `${width}px`, '--node-y': `${NODE_Y}px` } as CSSProperties}>
      {rows.map((r, row) => {
        const lane = laneOf.get(r.line) ?? 0
        const line = lineOf(r)
        const format = formatOf(r)
        const status = content.taxonomy.releaseStatuses[r.status]
        const isLocked = locked(r)
        return (
          <motion.li
            key={r.id}
            className={`rgraph__row ${r.status === 'concept' ? 'is-outline' : ''}`}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: row * 0.06 }}
          >
            <span className="rgraph__lanes" aria-hidden="true">
              {lanes.map((ln, i) => {
                const branch = i ? 'is-branch' : ''
                const top = row > ln.first && (row <= ln.last || row < ln.reach)
                const bottom = row >= ln.first && row < ln.reach
                return (
                  <span key={i}>
                    {top && <span className={`rgraph__rail rgraph__rail--top ${branch}`} style={{ left: laneX(i) }} />}
                    {bottom && <span className={`rgraph__rail rgraph__rail--bottom ${branch}`} style={{ left: laneX(i) }} />}
                    {row === ln.first && ln.parent != null && (
                      <svg className={`rgraph__fork ${branch}`} width={width} height={NODE_Y}>
                        <path
                          d={`M ${laneX(ln.parent)} 0 C ${laneX(ln.parent)} ${NODE_Y * 0.7}, ${laneX(i)} ${NODE_Y * 0.3}, ${laneX(i)} ${NODE_Y}`}
                        />
                      </svg>
                    )}
                  </span>
                )
              })}
              <span className="rgraph__tick" style={{ left: laneX(lane) }} />
              <span className={`rgraph__node release-node release-node--${r.status}`} style={{ left: laneX(lane) }} />
            </span>
            <Link to={hrefFor(r)} className="timeline__card rgraph__card release-card">
              <EntityThumb entity={r} />
              <span className="release-card__text">
                <span className="timeline__meta">
                  <span className="realm-tag" title={l(line?.label)}>
                    {line?.code}·{numberOf(r)}
                  </span>
                  <span className="realm-tag" title={l(format?.label)}>
                    {format?.code}
                  </span>
                  <span>{r.date ? l(r.date) : t('releases.tba')}</span>
                  <span className="muted">{l(status?.label)}</span>
                </span>
                <strong className="timeline__title">
                  <EntityName entity={r} />
                </strong>
                {isLocked ? (
                  <span className="bars bars--inline" aria-hidden="true">
                    <span style={{ width: '90%' }} />
                    <span style={{ width: '60%' }} />
                  </span>
                ) : (
                  <span className="timeline__summary">{l(r.summary)}</span>
                )}
              </span>
            </Link>
          </motion.li>
        )
      })}
    </ol>
  )
}

function LineNotes() {
  const { l } = useSettings()
  return (
    <ul className="factions">
      {lines.map((x) => (
        <li key={x.id}>
          <SubHead code={String(content.releases.filter((r) => r.line === x.id).length).padStart(2, '0')}>{l(x.label)}</SubHead>
          {l(x.description) && <p className="small">{l(x.description)}</p>}
        </li>
      ))}
    </ul>
  )
}

function FormatStats() {
  const { l, t } = useSettings()
  const total = Math.max(1, content.releases.length)
  return (
    <>
      <SubHead>{t('releases.formats')}</SubHead>
      <ul className="catstats">
        {content.taxonomy.releaseFormats.map((f) => {
          const n = content.releases.filter((r) => r.format === f.id).length
          return (
            <li key={f.id}>
              <span className="catstats__item">
                <span className="catstats__code">{f.code}</span>
                <span className="catstats__label">{l(f.label)}</span>
                <span className="catstats__n">{String(n).padStart(2, '0')}</span>
                <span className="catstats__bar" style={{ width: `${(n / total) * 100}%` }} />
              </span>
            </li>
          )
        })}
      </ul>
    </>
  )
}
