import { useEffect, useRef, type ReactNode } from 'react'
import { useSettings } from '../lib/settings'
import { useUi } from '../lib/ui'
import { isTypingTarget } from '../lib/routes'
import { useMediaQuery } from '../lib/useMediaQuery'
import { sfx } from '../lib/sound'
import { Stamp } from '../components/ui/Stamp'
import { gameKeyOf, type GameKey, type Grid } from './engine'
import { TextScreen, type PointerKind } from './TextScreen'

export type Phase = 'ready' | 'play' | 'paused' | 'over'

/** What every game receives from the page: whether it owns the keyboard. */
export interface GameProps {
  armed: boolean
  setArmed: (v: boolean) => void
}

export interface Outcome {
  stamp: string
  tone?: 'danger' | 'fg' | 'accent'
  lines?: string[]
  record?: boolean
  /** the restart hint; defaults to "run again" */
  next?: string
}

interface Props extends GameProps {
  label: string
  phase: Phase
  setPhase: (p: Phase) => void
  /** reset the game state and begin playing */
  onStart: () => void
  /** a button press during play; `repeat` = key held down */
  onKey: (k: GameKey, repeat: boolean) => void
  onPointer?: (x: number, y: number, kind: PointerKind) => void
  /** the click that starts a game also counts as a move (minesweeper's first reveal) */
  startClick?: boolean
  grid: Grid
  status: { label: string; value: ReactNode }[]
  outcome?: Outcome
  /** touch pad: direction buttons or not, labels for A / B, or labelled left / right action buttons */
  pad: { dirs: boolean; a?: string; b?: string; left?: string; right?: string }
  /** drawn over the screen during play (stamps, flashes) */
  children?: ReactNode
}

/**
 * Chrome shared by all games: status strip, the character screen, ready / pause / game-over cards,
 * keyboard capture and the touch pad. While armed it swallows keys in the capture phase,
 * so the archive's global hotkeys (1–5, S, M, Tab, /, arrows in lists) stay quiet.
 */
export function GameShell(props: Props) {
  const { t } = useSettings()
  const { overlay, lightbox } = useUi()
  const coarse = useMediaQuery('(pointer: coarse)')
  const shellRef = useRef<HTMLDivElement>(null)
  const { armed, setArmed, phase, setPhase } = props

  // handlers below are bound once; they read the latest props from here
  const latest = useRef(props)
  latest.current = props

  // a key still held from the last move must not skip the game-over card
  const overAt = useRef(0)
  useEffect(() => {
    if (phase === 'over') overAt.current = Date.now()
  }, [phase])

  const begin = () => {
    const p = latest.current
    if (p.phase === 'over' && Date.now() - overAt.current < 700) return
    sfx.select()
    if (p.phase === 'paused') p.setPhase('play')
    else p.onStart()
  }
  const press = (k: GameKey, repeat = false) => {
    const p = latest.current
    if (p.phase === 'play') p.onKey(k, repeat)
    else if (k === 'a' && !repeat) begin()
  }
  const pressRef = useRef(press)
  pressRef.current = press

  // keyboard capture while armed
  useEffect(() => {
    if (!armed || overlay || lightbox) return
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return
      e.stopPropagation()
      if (e.key === 'Escape') {
        e.preventDefault()
        latest.current.setArmed(false)
        return
      }
      if (e.code === 'KeyP') {
        const p = latest.current
        if (p.phase === 'play') p.setPhase('paused')
        else if (p.phase === 'paused') p.setPhase('play')
        return
      }
      const k = gameKeyOf(e)
      if (e.key === 'Tab' || k) e.preventDefault()
      if (k) pressRef.current(k, e.repeat)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [armed, overlay, lightbox])

  // ENTER while the keyboard is free takes it and starts / resumes
  useEffect(() => {
    if (armed || overlay || lightbox) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return
      const el = e.target as HTMLElement | null
      if (el?.closest?.('a, button') && !shellRef.current?.contains(el)) return
      e.preventDefault()
      latest.current.setArmed(true)
      if (latest.current.phase !== 'play') begin()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [armed, overlay, lightbox])

  // a click anywhere else gives the keyboard back
  useEffect(() => {
    if (!armed) return
    const onDown = (e: PointerEvent) => {
      if (!shellRef.current?.contains(e.target as Node)) latest.current.setArmed(false)
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [armed])

  // losing the keyboard or the tab pauses a running game
  useEffect(() => {
    if (!armed && phase === 'play') setPhase('paused')
  }, [armed, phase, setPhase])
  useEffect(() => {
    const onVis = () => {
      if (document.hidden && latest.current.phase === 'play') latest.current.setPhase('paused')
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  const onPointer = (x: number, y: number, kind: PointerKind) => {
    const p = latest.current
    if (kind !== 'move') p.setArmed(true)
    if (p.phase === 'play') p.onPointer?.(x, y, kind)
    else if (kind === 'down') {
      const starting = p.phase === 'ready'
      begin()
      if (starting && p.startClick) p.onPointer?.(x, y, kind)
    }
  }

  const { outcome } = props
  return (
    <div className={`gameshell ${armed ? 'is-armed' : ''}`} ref={shellRef} onPointerDown={() => setArmed(true)}>
      <div className="gamestatus">
        {props.status.map((s) => (
          <span key={s.label} className="gamestatus__item">
            <span className="gamestatus__label">{s.label}</span>
            <span className="gamestatus__value">{s.value}</span>
          </span>
        ))}
        <span className="gamestatus__kbd">{armed ? t('games.armed') : t('games.released')}</span>
      </div>

      <div className="gamestage">
        <TextScreen grid={props.grid} label={props.label} onPointer={onPointer} />
        {phase === 'play' && props.children}
        {phase !== 'play' && (
          <div className="gamecard" onPointerDown={(e) => e.stopPropagation()} onClick={() => (setArmed(true), begin())}>
            {phase === 'ready' && (
              <>
                <strong className="gamecard__title">{props.label}</strong>
                <span className="gamecard__hint blink">{coarse ? t('games.readyTouch') : t('games.ready')}</span>
              </>
            )}
            {phase === 'paused' && (
              <>
                <strong className="gamecard__title">{t('games.paused')}</strong>
                <span className="gamecard__hint">{t('games.resume')}</span>
              </>
            )}
            {phase === 'over' && outcome && (
              <>
                <Stamp text={outcome.stamp} tone={outcome.tone} delay={0.1} />
                {outcome.lines?.map((line, i) => (
                  <span key={i} className="gamecard__line">
                    {line}
                  </span>
                ))}
                {outcome.record && <span className="gamecard__record">{t('games.newRecord')}</span>}
                <span className="gamecard__hint blink">{outcome.next ?? t('games.again')}</span>
              </>
            )}
          </div>
        )}
      </div>

      {coarse && <TouchPad pad={props.pad} press={(k, r) => (setArmed(true), pressRef.current(k, r))} />}
    </div>
  )
}

function TouchPad({ pad, press }: { pad: Props['pad']; press: (k: GameKey, repeat: boolean) => void }) {
  const timer = useRef<number | undefined>(undefined)
  const stop = () => {
    clearTimeout(timer.current)
    clearInterval(timer.current)
  }
  useEffect(() => stop, [])

  const button = (k: GameKey, label: string, cls: string, repeat = false) => (
    <button
      type="button"
      className={`touchpad__btn ${cls}`}
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault()
        stop()
        press(k, false)
        if (repeat) timer.current = window.setTimeout(() => (timer.current = window.setInterval(() => press(k, true), 75)), 230)
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  )

  return (
    <div className="touchpad" onPointerDown={(e) => e.stopPropagation()}>
      {pad.dirs && (
        <div className="touchpad__dirs">
          {button('up', '▲', 'touchpad__up', true)}
          {button('left', '◀', 'touchpad__left', true)}
          {button('down', '▼', 'touchpad__down', true)}
          {button('right', '▶', 'touchpad__right', true)}
        </div>
      )}
      <div className="touchpad__actions">
        {pad.left && button('left', pad.left, 'touchpad__wide')}
        {pad.right && button('right', pad.right, 'touchpad__wide')}
        {pad.b && button('b', pad.b, 'touchpad__b')}
        {pad.a && button('a', pad.a, 'touchpad__a')}
      </div>
    </div>
  )
}
