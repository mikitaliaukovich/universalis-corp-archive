import { content, type Effects } from '../../lib/content'
import { useSettings } from '../../lib/settings'
import { useUi } from '../../lib/ui'
import { sfx } from '../../lib/sound'
import { Modal } from './Modal'

export function SettingsOverlay() {
  const { t, l, settings, update, setEffect, reset } = useSettings()
  const { setOverlay } = useUi()
  const effects = Object.keys(content.theme.effects) as (keyof Effects)[]

  return (
    <Modal title={t('settings.title')} code="CFG" onClose={() => setOverlay(null)}>
      <h3 className="subhead">{t('settings.palette')}</h3>
      <div className="swatches">
        {Object.entries(content.theme.palettes).map(([id, p]) => (
          <button
            key={id}
            type="button"
            className="swatch"
            aria-pressed={settings.palette === id}
            onClick={() => {
              update({ palette: id })
              sfx.select()
            }}
            style={{ color: p.fg, background: p.bg, borderColor: p.dim }}
          >
            <span className="swatch__chip" style={{ background: p.fg, boxShadow: `0 0 10px ${p.fg}` }} />
            {l(p.label)}
          </button>
        ))}
      </div>

      <h3 className="subhead">{t('settings.language')}</h3>
      <div className="swatches">
        {content.site.languages.map((lg) => (
          <button key={lg.id} type="button" className="swatch" aria-pressed={settings.lang === lg.id} onClick={() => update({ lang: lg.id })}>
            {lg.label}
          </button>
        ))}
      </div>

      <h3 className="subhead">{t('settings.effects')}</h3>
      <ul className="toggles">
        {effects.map((k) => (
          <li key={k}>
            <button
              type="button"
              role="switch"
              aria-checked={settings.effects[k]}
              className="toggle"
              onClick={() => {
                setEffect(k, !settings.effects[k])
                sfx.blip()
              }}
            >
              <span className="toggle__box">{settings.effects[k] ? '■' : '□'}</span>
              <span>{t(`effect.${k}`)}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="modal__footer">
        <button type="button" className="key-btn" onClick={() => setOverlay('clearance')}>
          {t('clearance.title')}
        </button>
        {content.site.tour.enabled && content.site.tour.steps.length > 0 && (
          <button
            type="button"
            className="key-btn"
            onClick={() => {
              update({ tourSeen: false })
              setOverlay(null)
            }}
          >
            {t('settings.tour')}
          </button>
        )}
        <button type="button" className="key-btn key-btn--danger" onClick={reset}>
          {t('settings.reset')}
        </button>
      </div>
    </Modal>
  )
}
