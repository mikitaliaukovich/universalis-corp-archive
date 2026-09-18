import { content } from '../../lib/content'
import { useSettings } from '../../lib/settings'
import { useUi } from '../../lib/ui'
import { sfx } from '../../lib/sound'
import { Modal } from './Modal'

/** "Clearance level" = the last chapter the reader has finished. Gates spoilers site-wide. */
export function ClearanceOverlay() {
  const { t, l, settings, update } = useSettings()
  const { setOverlay } = useUi()
  const langs = content.site.languages

  const choose = (progress: number | null, explicitAll = false) => {
    sfx.select()
    update({ progress: explicitAll ? content.maxChapter : progress })
    setOverlay(null)
  }

  return (
    <Modal title={t('clearance.title')} code="SEC" bodyClassName="clearance-body" onClose={() => choose(settings.progress ?? 0)}>
      {langs.length > 1 && (
        <div className="clearance__lang" role="group" aria-label={t('settings.language')}>
          {/* each language names itself, so a first-time visitor can find theirs */}
          <span className="clearance__langLabel">
            {langs.map((lg) => content.i18n[lg.id]?.['settings.language'] ?? lg.label).join(' · ')}
          </span>
          <span className="swatches">
            {langs.map((lg) => (
              <button
                key={lg.id}
                type="button"
                className="swatch"
                lang={lg.id}
                aria-pressed={settings.lang === lg.id}
                onClick={() => {
                  update({ lang: lg.id })
                  sfx.blip()
                }}
              >
                {lg.label}
              </button>
            ))}
          </span>
        </div>
      )}
      <p className="lead">{t('clearance.intro')}</p>
      <ul className="clearance">
        <li>
          <button type="button" className="clearance__opt" aria-pressed={settings.progress === 0} onClick={() => choose(0)}>
            <span className="clearance__num">00</span>
            <span>{t('clearance.none')}</span>
          </button>
        </li>
        {content.chapters.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              className="clearance__opt"
              aria-pressed={settings.progress === c.number && c.number !== content.maxChapter}
              onClick={() => choose(c.number)}
            >
              <span className="clearance__num">{String(c.number).padStart(2, '0')}</span>
              <span>{l(c.name)}</span>
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            className="clearance__opt clearance__opt--all"
            aria-pressed={settings.progress === content.maxChapter}
            onClick={() => choose(null, true)}
          >
            <span className="clearance__num">∞</span>
            <span>{t('clearance.all')}</span>
          </button>
        </li>
      </ul>
      <p className="muted small">{t('clearance.note')}</p>
    </Modal>
  )
}
