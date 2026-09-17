import { content } from '../../lib/content'
import { useSettings } from '../../lib/settings'
import { useUi } from '../../lib/ui'
import { sfx } from '../../lib/sound'
import { Modal } from './Modal'

/** "Clearance level" = the last chapter the reader has finished. Gates spoilers site-wide. */
export function ClearanceOverlay() {
  const { t, l, settings, update } = useSettings()
  const { setOverlay } = useUi()

  const choose = (progress: number | null, explicitAll = false) => {
    sfx.select()
    update({ progress: explicitAll ? content.maxChapter : progress })
    setOverlay(null)
  }

  return (
    <Modal title={t('clearance.title')} code="SEC" onClose={() => choose(settings.progress ?? content.maxChapter)}>
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
