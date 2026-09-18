import { NavLink } from 'react-router'
import { content } from '../../lib/content'
import { useSettings } from '../../lib/settings'

/** Bottom strip: section tabs + key legend, like the reference's TAB / ESC footer. */
export function HotkeyBar() {
  const { l, t } = useSettings()
  return (
    <footer className="hotkeys">
      <nav className="hotkeys__nav" aria-label={t('nav.sections')}>
        {content.site.sections.map((s) => (
          <NavLink key={s.id} to={`/${s.path}`} className="hotkeys__tab">
            {s.hotkey && <kbd>{s.hotkey}</kbd>}
            <span>{l(s.label)}</span>
          </NavLink>
        ))}
      </nav>
      <div className="hotkeys__legend hide-sm">
        <span>
          <kbd>TAB</kbd> {t('keys.tab')}
        </span>
        <span>
          <kbd>↑</kbd>
          <kbd>↓</kbd> {t('keys.arrows')}
        </span>
        <span>
          <kbd>/</kbd> {t('keys.search')}
        </span>
        <span>
          <kbd>ESC</kbd> {t('keys.esc')}
        </span>
        {content.site.radio.enabled && (
          <span>
            <kbd>M</kbd> {t('keys.radio')}
          </span>
        )}
      </div>
    </footer>
  )
}
