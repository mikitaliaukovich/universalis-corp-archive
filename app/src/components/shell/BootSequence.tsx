import { useEffect, useRef, useState, type FormEvent } from 'react'
import { motion } from 'motion/react'
import { content } from '../../lib/content'
import { useSettings } from '../../lib/settings'
import { tryPassword } from '../../lib/access'
import { Logo } from '../ui/Logo'
import { sfx } from '../../lib/sound'

type Stage = 'lines' | 'password' | 'granted'

interface Props {
  onDone: () => void
  /** stop at a password prompt before granting access (site.yaml → access) */
  gate?: boolean
  /** print all lines at once (boot effect switched off, only the gate is shown) */
  instant?: boolean
}

/** POST-style power-on sequence. Any key / click skips it — up to the password prompt, if there is one. */
export function BootSequence({ onDone, gate = false, instant = false }: Props) {
  const { l, settings, t } = useSettings()
  const lines = content.site.boot.lines[settings.lang] ?? content.site.boot.lines[content.site.defaultLanguage] ?? []
  const [shown, setShown] = useState(instant ? lines.length + 1 : 0)
  const [progress, setProgress] = useState(instant ? 100 : 0)
  const [stage, setStage] = useState<Stage>(instant && gate ? 'password' : 'lines')

  useEffect(() => {
    if (stage !== 'lines') return
    let i = shown
    let timer: ReturnType<typeof setTimeout>
    const finish = () => {
      clearTimeout(timer)
      setShown(lines.length + 1)
      setProgress(100)
      if (gate) setStage('password')
      else onDone()
    }
    const next = () => {
      i++
      setShown(i)
      sfx.click()
      if (i <= lines.length) timer = setTimeout(next, 170 + Math.random() * 260)
      else if (gate) finish()
      else timer = setTimeout(onDone, 900)
    }
    timer = setTimeout(next, 500)
    const bar = setInterval(() => setProgress((p) => Math.min(100, p + 3 + Math.random() * 6)), 90)
    const skip = (e: Event) => {
      if (e instanceof KeyboardEvent && ['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return
      finish()
    }
    window.addEventListener('keydown', skip)
    window.addEventListener('pointerdown', skip)
    return () => {
      clearTimeout(timer)
      clearInterval(bar)
      window.removeEventListener('keydown', skip)
      window.removeEventListener('pointerdown', skip)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, lines.length, onDone, gate])

  useEffect(() => {
    if (stage !== 'granted') return
    const timer = setTimeout(onDone, 900)
    return () => clearTimeout(timer)
  }, [stage, onDone])

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
      {stage === 'password' && <PasswordPrompt onGranted={() => setStage('granted')} />}
      {shown > lines.length && (!gate || stage === 'granted') && (
        <div className="boot__final blink" role="status">
          {l(content.site.boot.final)}
        </div>
      )}
      {stage === 'lines' && <div className="boot__skip">{t('boot.skip')}</div>}
    </motion.div>
  )
}

function PasswordPrompt({ onGranted }: { onGranted: () => void }) {
  const { t } = useSettings()
  const [value, setValue] = useState('')
  const [status, setStatus] = useState<'idle' | 'checking' | 'denied'>('idle')
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => input.current?.focus(), [])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!value || status === 'checking') return
    setStatus('checking')
    sfx.click()
    // a short pause, as if the request went down the pneumatic tube
    const pause = new Promise((r) => setTimeout(r, 600))
    Promise.all([tryPassword(value), pause]).then(([ok]) => {
      if (ok) {
        sfx.select()
        onGranted()
      } else {
        sfx.blip()
        setStatus('denied')
        setValue('')
        input.current?.focus()
      }
    })
  }

  return (
    <form className={`boot__gate${status === 'denied' ? ' boot__gate--denied' : ''}`} onSubmit={submit}>
      <label className="boot__gateLabel" htmlFor="boot-password">
        &gt; {t('access.prompt')}:
      </label>
      <div className="boot__gateRow">
        <input
          ref={input}
          id="boot-password"
          className="boot__gateInput"
          type="password"
          autoComplete="current-password"
          spellCheck={false}
          value={value}
          disabled={status === 'checking'}
          onChange={(e) => {
            setValue(e.target.value)
            if (status === 'denied') setStatus('idle')
          }}
        />
        <button type="submit" className="key-btn" disabled={!value || status === 'checking'}>
          {t('access.submit')}
        </button>
      </div>
      <div className="boot__gateStatus" role="alert">
        {status === 'checking' ? t('access.checking') : status === 'denied' ? t('access.denied') : t('access.hint')}
      </div>
    </form>
  )
}
