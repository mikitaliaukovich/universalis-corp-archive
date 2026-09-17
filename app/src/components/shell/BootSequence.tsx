import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { content } from '../../lib/content'
import { useSettings } from '../../lib/settings'
import { Logo } from '../ui/Logo'
import { sfx } from '../../lib/sound'

/** POST-style power-on sequence. Any key / click skips it. */
export function BootSequence({ onDone }: { onDone: () => void }) {
  const { l, settings, t } = useSettings()
  const lines = content.site.boot.lines[settings.lang] ?? content.site.boot.lines[content.site.defaultLanguage] ?? []
  const [shown, setShown] = useState(0)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let i = 0
    let timer: ReturnType<typeof setTimeout>
    const next = () => {
      i++
      setShown(i)
      sfx.click()
      if (i <= lines.length) timer = setTimeout(next, 170 + Math.random() * 260)
      else timer = setTimeout(onDone, 900)
    }
    timer = setTimeout(next, 500)
    const bar = setInterval(() => setProgress((p) => Math.min(100, p + 3 + Math.random() * 6)), 90)
    const skip = (e: Event) => {
      if (e instanceof KeyboardEvent && ['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return
      onDone()
    }
    window.addEventListener('keydown', skip)
    window.addEventListener('pointerdown', skip)
    return () => {
      clearTimeout(timer)
      clearInterval(bar)
      window.removeEventListener('keydown', skip)
      window.removeEventListener('pointerdown', skip)
    }
  }, [lines.length, onDone])

  return (
    <motion.div
      className="boot"
      initial={{ opacity: 0, scaleY: 0.004, scaleX: 0.6 }}
      animate={{ opacity: 1, scaleY: 1, scaleX: 1 }}
      exit={{ opacity: 0, scaleY: 0.004, filter: 'brightness(4)' }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
    >
      <div className="boot__head">
        <Logo size={44} />
        <div>
          <div className="boot__org">{l(content.site.org)}</div>
          <div className="boot__terminal">{l(content.site.terminal)}</div>
        </div>
      </div>
      <ol className="boot__lines">
        {lines.slice(0, shown).map((line, i) => (
          <li key={i}>
            <span className="boot__addr">{(0x7c00 + i * 0x1a4).toString(16).toUpperCase().padStart(5, '0')}</span> {line}
          </li>
        ))}
      </ol>
      <div className="boot__progress" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>
      {shown > lines.length && <div className="boot__final blink">{l(content.site.boot.final)}</div>}
      <div className="boot__skip">{t('boot.skip')}</div>
    </motion.div>
  )
}
