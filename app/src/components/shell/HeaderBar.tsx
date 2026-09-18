import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { content } from '../../lib/content'
import { useSettings } from '../../lib/settings'
import { useUi } from '../../lib/ui'
import { Logo } from '../ui/Logo'

/** "Purgatory time": the clock runs `ratio` times faster than real time. */
function usePurgatoryClock(ratio: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const d = new Date(now)
  const realSeconds = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()
  const scaled = Math.floor((realSeconds * ratio) / 60) % (24 * 60)
  return `${String(Math.floor(scaled / 60)).padStart(2, '0')}:${String(scaled % 60).padStart(2, '0')}`
}

export function HeaderBar() {
  const { l, t, settings, update, readTo } = useSettings()
  const { setOverlay } = useUi()
  const clock = usePurgatoryClock(content.site.clock.ratio)
  const langs = content.site.languages

  return (
    <header className="topbar">
      <Link to="/" className="topbar__brand" aria-label={t('nav.home')}>
        <Logo />
        <span className="topbar__org">{l(content.site.org)}</span>
      </Link>
      <div className="topbar__terminal">{l(content.site.terminal)}</div>
      <div className="topbar__right">
        <button type="button" className="chip" data-tour="search" onClick={() => setOverlay('search')} title={t('search.title')}>
          <kbd>/</kbd>
          <span className="hide-sm">{t('search.short')}</span>
        </button>
        <button
          type="button"
          className="chip"
          data-tour="clearance"
          onClick={() => setOverlay('clearance')}
          title={t('clearance.title')}
        >
          <span className="hide-sm">{t('clearance.short')}</span>
          <span className="chip__value">
            {settings.progress == null ? '∞' : String(readTo).padStart(2, '0')}/{String(content.maxChapter).padStart(2, '0')}
          </span>
        </button>
        <div className="langswitch" data-tour="language" role="group" aria-label={t('settings.language')}>
          {langs.map((lg) => (
            <button
              key={lg.id}
              type="button"
              aria-pressed={settings.lang === lg.id}
              onClick={() => update({ lang: lg.id })}
            >
              {lg.label}
            </button>
          ))}
        </div>
        <button type="button" className="chip" data-tour="settings" onClick={() => setOverlay('settings')} title={t('settings.title')}>
          <kbd>S</kbd>
          <span className="hide-sm">{t('settings.short')}</span>
        </button>
        <div className="pagerclock" title={l(content.site.clock.label)}>
          <span className="pagerclock__label">{l(content.site.clock.label)}</span>
          <span className="pagerclock__lcd">{clock}</span>
        </div>
      </div>
    </header>
  )
}
