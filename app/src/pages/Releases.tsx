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

const formatOf = (r: Release) => content.taxonomy.releaseFormats.find((f) => f.id === r.format)
/** position on the timeline, 01-based */
const numberOf = (r: Release) => String(content.releases.indexOf(r) + 1).padStart(2, '0')

export function Releases({ section, id }: { section: Section; id?: string }) {
  const { l, t } = useSettings()
  const locked = useLocked()
  const release = id ? content.releases.find((r) => r.id === id) : undefined
  if (id && !release) return <NotFound />

  const items = content.releases.map((r) => ({
    id: r.id,
    href: `/${section.path}/${r.id}`,
    prefix: numberOf(r),
    label: locked(r) ? <span className="redacted redacted--static">{l(r.name)}</span> : l(r.name),
    suffix: formatOf(r)?.code,
    locked: locked(r),
    dim: r.status === 'concept',
  }))

  return (
    <div className={`layout3 ${release ? 'has-selection' : ''}`}>
      <Panel title={l(section.label)} code={section.code} className="layout3__left">
        <ListMenu items={items} activeId={release?.id} primary empty={t('common.none')} />
        <StatusLegend />
      </Panel>

      <Panel
        key={release?.id ?? 'index'}
        title={release ? t('releases.file', { n: numberOf(release) }) : t('releases.index')}
        code={release ? formatOf(release)?.code : 'T-LINE'}
        className="layout3__center"
      >
        {release ? locked(release) ? <LockedNotice entity={release} /> : <ReleaseFile key={release.id} release={release} section={section} /> : <ReleaseTimeline />}
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
            <FormatStats />
          </>
        )}
      </Panel>
    </div>
  )
}

function StatusLegend() {
  const { l, t } = useSettings()
  return (
    <div className="legend">
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
  const idx = content.releases.indexOf(release)
  const prev = content.releases[idx - 1]
  const next = content.releases[idx + 1]

  return (
    <article className="casefile">
      <header className="casefile__head">
        <div className="casefile__num">{numberOf(release)}</div>
        <div className="casefile__titles">
          <span className="casefile__kicker">
            <span className="realm-tag">{format?.code}</span> {l(format?.label)}
          </span>
          <h1 className="casefile__title">
            <TypewriterText key={settings.lang} text={l(release.name)} speed={30} />
          </h1>
        </div>
        {status?.stamp && <Stamp text={l(status.stamp)} tone={release.status === 'released' ? 'fg' : 'danger'} seed={release.id} />}
      </header>

      <FactTable
        rows={[
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

function ReleaseTimeline() {
  const { l, t } = useSettings()
  const locked = useLocked()
  return (
    <ol className="timeline timeline--releases">
      {content.releases.map((r, i) => {
        const isLocked = locked(r)
        const format = formatOf(r)
        const status = content.taxonomy.releaseStatuses[r.status]
        return (
          <motion.li
            key={r.id}
            className={`timeline__item ${r.status === 'concept' ? 'is-outline' : ''}`}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <span className={`timeline__node release-node release-node--${r.status}`} aria-hidden="true" />
            <Link to={hrefFor(r)} className="timeline__card release-card">
              <EntityThumb entity={r} />
              <span className="release-card__text">
                <span className="timeline__meta">
                  <span className="timeline__num">{numberOf(r)}</span>
                  <span className="realm-tag">{format?.code}</span>
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
