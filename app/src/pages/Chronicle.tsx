import { Link } from 'react-router'
import { motion } from 'motion/react'
import { content, type Chapter, type Site } from '../lib/content'
import { useLocked, useSettings } from '../lib/settings'
import { useUi } from '../lib/ui'
import { hrefFor } from '../lib/routes'
import { Markdown } from '../lib/markdown'
import { Panel } from '../components/ui/Panel'
import { ListMenu } from '../components/ui/ListMenu'
import { Stamp } from '../components/ui/Stamp'
import { TypewriterText } from '../components/ui/TypewriterText'
import { EntityList, EntityName, FactTable, LockedNotice, SubHead } from '../components/ui/EntityBits'
import { WikiLink } from '../components/ui/WikiLink'
import { NotFound } from './NotFound'

type Section = Site['sections'][number]

export function Chronicle({ section, id }: { section: Section; id?: string }) {
  const { l, t } = useSettings()
  const locked = useLocked()
  const chapter = id ? content.chapters.find((c) => c.id === id) : undefined
  if (id && !chapter) return <NotFound />

  const items = content.chapters.map((c) => ({
    id: c.id,
    href: `/${section.path}/${c.id}`,
    prefix: String(c.number).padStart(2, '0'),
    label: locked(c) ? <span className="redacted redacted--static">{l(c.name)}</span> : l(c.name),
    suffix: content.taxonomy.realms[c.realm]?.code,
    locked: locked(c),
    dim: c.status === 'outline',
  }))

  return (
    <div className={`layout3 ${chapter ? 'has-selection' : ''}`}>
      <Panel title={l(section.label)} code={section.code} className="layout3__left">
        <ListMenu items={items} activeId={chapter?.id} primary empty={t('common.none')} />
        <RealmLegend />
      </Panel>

      <Panel
        key={chapter?.id ?? 'index'}
        title={chapter ? t('chronicle.caseFile', { n: String(chapter.number).padStart(2, '0') }) : t('chronicle.timeline')}
        code={chapter ? content.taxonomy.realms[chapter.realm]?.code : 'T-LINE'}
        className="layout3__center"
      >
        {chapter ? locked(chapter) ? <LockedNotice entity={chapter} /> : <ChapterFile key={chapter.id} chapter={chapter} section={section} /> : <Timeline />}
      </Panel>

      <Panel title={chapter ? t('chronicle.involved') : t('chronicle.about')} code="IDX" className="layout3__right">
        {chapter && !locked(chapter) ? (
          <>
            <SubHead code={String(chapter.characters.length)}>{t('chronicle.characters')}</SubHead>
            <EntityList ids={chapter.characters} note={(e) => (e.kind === 'character' ? l(e.role) : '')} />
            <SubHead code={String(chapter.terms.length)}>{t('chronicle.terms')}</SubHead>
            <EntityList ids={chapter.terms} note={(e) => (e.kind === 'term' ? l(content.taxonomy.glossaryCategories.find((c) => c.id === e.category)?.label) : '')} />
          </>
        ) : (
          <p className="muted">{l(section.description)}</p>
        )}
      </Panel>
    </div>
  )
}

function RealmLegend() {
  const { l, t } = useSettings()
  return (
    <div className="legend">
      <SubHead>{t('chronicle.realms')}</SubHead>
      <ul>
        {Object.entries(content.taxonomy.realms).map(([id, r]) => (
          <li key={id}>
            <span className={`realm-tag realm-tag--${id}`}>{r.code}</span> {l(r.label)}
          </li>
        ))}
      </ul>
    </div>
  )
}

function ChapterFile({ chapter, section }: { chapter: Chapter; section: Section }) {
  const { l, t, settings } = useSettings()
  const { setOverlay } = useUi()
  const status = content.taxonomy.chapterStatuses[chapter.status]
  const realm = content.taxonomy.realms[chapter.realm]
  const idx = content.chapters.indexOf(chapter)
  const prev = content.chapters[idx - 1]
  const next = content.chapters[idx + 1]

  return (
    <article className="casefile">
      <header className="casefile__head">
        <div className="casefile__num">{String(chapter.number).padStart(2, '0')}</div>
        <div className="casefile__titles">
          <span className="casefile__kicker">
            <span className={`realm-tag realm-tag--${chapter.realm}`}>{realm?.code}</span> {l(realm?.label)}
          </span>
          <h1 className="casefile__title">
            <TypewriterText key={settings.lang} text={l(chapter.name)} speed={30} />
          </h1>
        </div>
        {status?.stamp && <Stamp text={l(status.stamp)} tone={chapter.status === 'written' ? 'fg' : 'danger'} seed={chapter.id} />}
      </header>

      <FactTable
        rows={[
          [t('chronicle.pov'), chapter.pov ? <WikiLink id={chapter.pov} /> : undefined],
          [t('chronicle.setting'), l(chapter.setting)],
          [t('chronicle.trial'), chapter.trial ? l(chapter.trial) : undefined],
          [t('chronicle.status'), l(status?.label)],
        ]}
      />

      {l(chapter.summary) && <p className="lead">{l(chapter.summary)}</p>}

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Markdown>{chapter.body[settings.lang] ?? ''}</Markdown>
      </motion.div>

      <nav className="casefile__nav">
        {prev ? (
          <Link className="key-btn" to={`/${section.path}/${prev.id}`}>
            ◀ {String(prev.number).padStart(2, '0')} · <EntityName entity={prev} />
          </Link>
        ) : (
          <span />
        )}
        <button type="button" className="key-btn" onClick={() => setOverlay('clearance')}>
          {t('chronicle.markRead')}
        </button>
        {next ? (
          <Link className="key-btn" to={`/${section.path}/${next.id}`}>
            {String(next.number).padStart(2, '0')} · <EntityName entity={next} /> ▶
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </article>
  )
}

function Timeline() {
  const { l } = useSettings()
  const locked = useLocked()
  return (
    <ol className="timeline">
      {content.chapters.map((c, i) => {
        const isLocked = locked(c)
        const realm = content.taxonomy.realms[c.realm]
        const status = content.taxonomy.chapterStatuses[c.status]
        return (
          <motion.li
            key={c.id}
            className={`timeline__item timeline__item--${c.realm} ${c.status === 'outline' ? 'is-outline' : ''}`}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <span className="timeline__node" aria-hidden="true" />
            <Link to={hrefFor(c)} className="timeline__card">
              <span className="timeline__meta">
                <span className="timeline__num">{String(c.number).padStart(2, '0')}</span>
                <span className={`realm-tag realm-tag--${c.realm}`}>{realm?.code}</span>
                <span className="muted">{l(status?.label)}</span>
              </span>
              <strong className="timeline__title">
                <EntityName entity={c} />
              </strong>
              {isLocked ? (
                <span className="bars bars--inline" aria-hidden="true">
                  <span style={{ width: '90%' }} />
                  <span style={{ width: '60%' }} />
                </span>
              ) : (
                <>
                  <span className="timeline__setting">{l(c.setting)}</span>
                  <span className="timeline__summary">{l(c.summary)}</span>
                </>
              )}
            </Link>
          </motion.li>
        )
      })}
    </ol>
  )
}
