import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { motion } from 'motion/react'
import { content, type Entity } from '../lib/content'
import { useLocked, useSettings } from '../lib/settings'
import { useUi } from '../lib/ui'
import { sfx } from '../lib/sound'
import { Panel } from '../components/ui/Panel'
import { Logo } from '../components/ui/Logo'
import { TypewriterText } from '../components/ui/TypewriterText'
import { focusStyle, primaryImage } from '../components/ui/EntityThumb'

type Section = (typeof content.site.sections)[number]

const RECORDS: Record<Section['view'], Entity[]> = {
  chronicle: content.chapters,
  personnel: content.characters,
  glossary: content.terms,
  releases: content.releases,
}

/** Card home: one column of large section cards and a row of tools. Settings → Home screen switches back to the classic layout. */
export function HomeCards() {
  const { l, t, settings, readTo } = useSettings()
  const { setOverlay } = useUi()

  const tools: { id: string; label: string; hint: string; key?: string; onClick: () => void }[] = [
    { id: 'search', label: t('search.title'), hint: t('home.searchHint'), key: '/', onClick: () => setOverlay('search') },
    {
      id: 'clearance',
      label: t('clearance.title'),
      hint: settings.progress == null ? t('clearance.unset') : t('home.chapterOf', { n: readTo, total: content.maxChapter }),
      onClick: () => setOverlay('clearance'),
    },
    { id: 'settings', label: t('settings.title'), hint: t('home.settingsHint'), key: 'S', onClick: () => setOverlay('settings') },
  ]

  return (
    <div className="layout1">
      <Panel title={t('home.mainMenu')} code="MENU">
        <div className="homecards">
          <div className="home__hero">
            <Logo size={72} />
            <div>
              <div className="home__org">{l(content.site.org)}</div>
              <h1 className="home__title">{l(content.site.title)}</h1>
            </div>
          </div>
          <p className="home__intro">
            <TypewriterText text={l(content.site.home.intro)} speed={12} cursor />
          </p>

          <nav className="homecards__grid" aria-label={t('nav.sections')}>
            {content.site.sections.map((s, i) => (
              <motion.div key={s.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.08 }}>
                <SectionCard section={s} />
              </motion.div>
            ))}
          </nav>

          <h2 className="subhead homecards__toolshead">{t('home.tools')}</h2>
          <div className="homecards__tools">
            {tools.map((x) => (
              <button
                key={x.id}
                type="button"
                className="toolcard"
                onMouseEnter={() => sfx.blip()}
                onClick={() => {
                  sfx.select()
                  x.onClick()
                }}
              >
                <span className="toolcard__label">
                  {x.key && <kbd>{x.key}</kbd>}
                  {x.label}
                </span>
                <span className="toolcard__hint">{x.hint}</span>
              </button>
            ))}
          </div>
        </div>
      </Panel>
    </div>
  )
}

function SectionCard({ section: s }: { section: Section }) {
  const { l } = useSettings()
  const locked = useLocked()
  const records = RECORDS[s.view]
  // a fresh pick each visit; only records the reader's clearance allows
  const [seed] = useState(Math.random)
  const image = useMemo(() => {
    const open = records.filter((e) => e.images.length > 0 && !locked(e))
    return open.length ? primaryImage(open[Math.floor(seed * open.length)]) : undefined
  }, [records, locked, seed])

  return (
    <Link to={`/${s.path}`} className="homecard" onMouseEnter={() => sfx.blip()} onClick={() => sfx.select()}>
      <span className="homecard__bg" aria-hidden="true">
        {image ? <img src={image.url} alt="" loading="lazy" style={focusStyle(image)} /> : <span className="homecard__glyph">{s.code}</span>}
      </span>
      <span className="homecard__top">
        {s.hotkey && <kbd>{s.hotkey}</kbd>}
        {s.code && <span className="homecard__code">{s.code}</span>}
        <span className="homecard__count">{String(records.length).padStart(3, '0')}</span>
      </span>
      <span className="homecard__body">
        <strong className="homecard__label">{l(s.label)}</strong>
        <span className="homecard__desc">{l(s.description)}</span>
      </span>
    </Link>
  )
}
