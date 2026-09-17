import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { motion } from 'motion/react'
import { content } from '../lib/content'
import { useSettings } from '../lib/settings'
import { useUi } from '../lib/ui'
import { Markdown } from '../lib/markdown'
import { sfx } from '../lib/sound'
import { Panel } from '../components/ui/Panel'
import { Logo } from '../components/ui/Logo'
import { TypewriterText } from '../components/ui/TypewriterText'
import { FactTable, SubHead } from '../components/ui/EntityBits'

export function Home() {
  const { l, t, settings, readTo } = useSettings()
  const { lastPager, setOverlay } = useUi()
  const quotes = content.site.quotes[settings.lang] ?? []
  const [qi, setQi] = useState(() => Math.floor(Math.random() * Math.max(1, quotes.length)))

  useEffect(() => {
    if (quotes.length < 2) return
    const id = setInterval(() => setQi((i) => (i + 1) % quotes.length), 14000)
    return () => clearInterval(id)
  }, [quotes.length])

  const counts: Record<string, number> = {
    chronicle: content.chapters.length,
    personnel: content.characters.length,
    glossary: content.terms.length,
  }

  return (
    <div className="layout3">
      <Panel title={t('home.operator')} code="OP-01" className="layout3__left">
        <FactTable
          rows={[
            [t('home.clearance'), settings.progress == null ? t('clearance.unset') : t('home.chapterOf', { n: readTo, total: content.maxChapter })],
            [t('settings.language'), content.site.languages.find((x) => x.id === settings.lang)?.label],
            [t('settings.palette'), l(content.theme.palettes[settings.palette]?.label)],
            [t('home.records'), content.entities.length],
          ]}
        />
        <div className="stack-sm">
          <button type="button" className="key-btn" onClick={() => setOverlay('clearance')}>
            {t('clearance.title')}
          </button>
          <button type="button" className="key-btn" onClick={() => setOverlay('settings')}>
            <kbd>S</kbd> {t('settings.title')}
          </button>
        </div>
        <SubHead code="RX">{t('home.lastTransmission')}</SubHead>
        <div className="lcd">{lastPager ?? t('home.noTransmission')}</div>
      </Panel>

      <Panel title={t('home.mainMenu')} code="MENU" className="layout3__center">
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
        <nav className="bigmenu" aria-label={t('nav.sections')}>
          {content.site.sections.map((s, i) => (
            <motion.div key={s.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.08 }}>
              <Link to={`/${s.path}`} className="bigmenu__item" onMouseEnter={() => sfx.blip()} onClick={() => sfx.select()}>
                <span className="bigmenu__key">{s.hotkey && <kbd>{s.hotkey}</kbd>}</span>
                <span className="bigmenu__label">
                  <strong>{l(s.label)}</strong>
                  <span>{l(s.description)}</span>
                </span>
                <span className="bigmenu__count">
                  {s.code && <span className="bigmenu__code">{s.code}</span>}
                  {String(counts[s.view] ?? 0).padStart(3, '0')}
                </span>
              </Link>
            </motion.div>
          ))}
        </nav>
      </Panel>

      <Panel title={t('home.charter')} code="УСТ" className="layout3__right">
        {quotes.length > 0 && (
          <motion.blockquote key={`${settings.lang}-${qi}`} className="charter" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <TypewriterText text={quotes[qi]} speed={18} />
          </motion.blockquote>
        )}
        {content.site.home.forces.length > 0 && (
          <>
            <SubHead code="ФРК">{l(content.site.home.forcesTitle)}</SubHead>
            <ul className="forces">
              {content.site.home.forces.map((f) => (
                <li key={f.id}>
                  <Markdown>{l(f.text)}</Markdown>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>
    </div>
  )
}
