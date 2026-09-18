import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { content } from '../../lib/content'
import { useSettings } from '../../lib/settings'
import { useUi } from '../../lib/ui'
import { sfx } from '../../lib/sound'

interface Spot {
  x: number
  y: number
  w: number
  h: number
  rootW: number
}

const CARD_W = 320
const PAD = 6

/**
 * Newcomer tips (site.yaml → tour): spotlights interface elements marked data-tour="…" one by one.
 * Each tip is shown once (remembered by target), so tips added later still reach returning readers.
 * Starts after the first clearance choice; pauses while any overlay is open.
 */
export function GuideTour() {
  const { t, l, settings, update } = useSettings()
  const { overlay, lightbox } = useUi()
  const seen = settings.tourSeen
  const steps = useMemo(
    () => (content.site.tour.enabled ? content.site.tour.steps.filter((s) => !seen.includes(s.target)) : []),
    [seen],
  )
  const [index, setIndex] = useState(0)
  const [spot, setSpot] = useState<Spot | null>(null)

  const active = steps.length > 0 && settings.progress != null && !overlay && !lightbox
  const step = active ? steps[index] : undefined

  // finishing or skipping marks every tip of this round as seen
  const finish = useCallback(() => {
    update({ tourSeen: [...seen, ...steps.map((s) => s.target)] })
    setIndex(0)
    setSpot(null)
  }, [update, seen, steps])
  const next = useCallback(() => {
    sfx.blip()
    setIndex((i) => i + 1)
  }, [])

  useEffect(() => {
    if (active && index >= steps.length) finish()
  }, [active, index, steps.length, finish])

  // find and measure the target (relative to #overlay-root, which may sit under the CRT curvature filter)
  useEffect(() => {
    setSpot(null)
    if (!step) return
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`)
    const measure = () => {
      const root = document.getElementById('overlay-root')?.getBoundingClientRect()
      if (!el || !root || !el.isConnected || el.offsetParent === null) {
        setIndex((i) => i + 1) // target missing or hidden: skip this tip
        return
      }
      const r = el.getBoundingClientRect()
      setSpot({ x: r.left - root.left, y: r.top - root.top, w: r.width, h: r.height, rootW: root.width })
    }
    const delay = setTimeout(measure, 450) // let the header settle after the app fades in
    // trying the highlighted control counts as reading the tip
    el?.addEventListener('click', next)
    window.addEventListener('resize', measure)
    return () => {
      clearTimeout(delay)
      el?.removeEventListener('click', next)
      window.removeEventListener('resize', measure)
    }
  }, [step, settings.lang, next])

  // Enter / → next, Esc skips — captured before the global hotkeys see them
  useEffect(() => {
    if (!spot) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish()
      else if (e.key === 'Enter' || e.key === 'ArrowRight') next()
      else return
      e.preventDefault()
      e.stopPropagation()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [spot, next, finish])

  const root = typeof document !== 'undefined' ? document.getElementById('overlay-root') : null
  if (!root) return null

  const cardW = spot ? Math.min(CARD_W, spot.rootW - 24) : CARD_W
  const cardX = spot ? Math.min(Math.max(spot.x + spot.w / 2 - cardW / 2, 12), spot.rootW - cardW - 12) : 0
  const last = index === steps.length - 1

  return createPortal(
    <AnimatePresence>
      {step && spot && (
        <motion.div className="tour" key="tour" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div
            className="tour__spot"
            aria-hidden="true"
            style={{ left: spot.x - PAD, top: spot.y - PAD, width: spot.w + PAD * 2, height: spot.h + PAD * 2 }}
          />
          <motion.div
            key={index}
            className="tour__card"
            role="dialog"
            aria-labelledby="tour-title"
            aria-describedby="tour-text"
            style={{ left: cardX, top: spot.y + spot.h + PAD + 14, width: cardW }}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <span className="tour__arrow" style={{ left: spot.x + spot.w / 2 - cardX - 7 }} aria-hidden="true" />
            <div className="tour__step">{t('tour.step', { n: index + 1, total: steps.length })}</div>
            <strong id="tour-title" className="tour__title">
              {l(step.title)}
            </strong>
            <p id="tour-text" className="tour__text">
              {l(step.text)}
            </p>
            <div className="tour__actions">
              {!last && (
                <button type="button" className="key-btn" onClick={finish}>
                  {t('tour.skip')}
                </button>
              )}
              <button type="button" className="key-btn tour__next" autoFocus onClick={next}>
                {last ? t('tour.done') : `${t('tour.next')} →`}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    root,
  )
}
