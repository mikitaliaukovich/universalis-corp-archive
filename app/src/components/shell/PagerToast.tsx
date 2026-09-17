import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { content } from '../../lib/content'
import { useSettings } from '../../lib/settings'
import { useUi } from '../../lib/ui'
import { sfx } from '../../lib/sound'
import { TypewriterText } from '../ui/TypewriterText'

/** Occasionally a transmission arrives on the Reaper's pager. */
export function PagerToast() {
  const { settings, t } = useSettings()
  const { setLastPager } = useUi()
  const cfg = content.site.pager
  const [msg, setMsg] = useState<string | null>(null)
  const enabled = cfg.enabled && settings.effects.pager

  useEffect(() => {
    if (!enabled) return
    const pool = cfg.messages[settings.lang] ?? []
    if (!pool.length) return
    let timer: ReturnType<typeof setTimeout>
    let hideTimer: ReturnType<typeof setTimeout>
    let last = -1
    const schedule = (sec: number) => {
      timer = setTimeout(() => {
        let i = Math.floor(Math.random() * pool.length)
        if (i === last && pool.length > 1) i = (i + 1) % pool.length
        last = i
        setMsg(pool[i])
        setLastPager(pool[i])
        sfx.pager()
        hideTimer = setTimeout(() => setMsg(null), cfg.displaySeconds * 1000)
        const [min, max] = cfg.intervalSeconds
        schedule(min + Math.random() * (max - min))
      }, sec * 1000)
    }
    schedule(cfg.firstDelaySeconds)
    return () => {
      clearTimeout(timer)
      clearTimeout(hideTimer)
    }
  }, [enabled, settings.lang, cfg, setLastPager])

  return (
    <AnimatePresence>
      {msg && (
        <motion.button
          type="button"
          className="pager"
          onClick={() => setMsg(null)}
          initial={{ y: 140, rotate: -6 }}
          animate={{ y: 0, rotate: [-6, -3, -5, -2, -4] }}
          exit={{ y: 160, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          aria-live="polite"
          title={t('common.close')}
        >
          <span className="pager__brand">{t('pager.brand')}</span>
          <span className="pager__lcd">
            <TypewriterText text={msg} speed={34} />
          </span>
          <span className="pager__buttons" aria-hidden="true">
            <i />
            <i />
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  )
}
