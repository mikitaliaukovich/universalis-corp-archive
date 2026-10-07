import { useReducer, useRef, useState } from 'react'
import { useSettings } from '../lib/settings'
import { sfx } from '../lib/sound'
import { formatTime, makeGrid, put, rand, submitRecord, useInterval, useRecords, type GameKey, type Tone } from './engine'
import { GameShell, type GameProps, type Outcome, type Phase } from './GameShell'
import type { PointerKind } from './TextScreen'

const ID = 'redact'
const W = 18
const H = 11
const SECRETS = 30

interface State {
  secret: boolean[][]
  open: boolean[][]
  bar: boolean[][]
  /** secrets are laid out on the first reveal, so it is always safe */
  laid: boolean
  cursor: { x: number; y: number }
  seconds: number
  /** where the leak happened */
  hit?: { x: number; y: number }
  done?: 'win' | 'leak'
}

const field = <T,>(v: T) => Array.from({ length: H }, () => Array<T>(W).fill(v))

const fresh = (): State => ({
  secret: field(false),
  open: field(false),
  bar: field(false),
  laid: false,
  cursor: { x: Math.floor(W / 2), y: Math.floor(H / 2) },
  seconds: 0,
})

function neighbours(x: number, y: number) {
  const out: { x: number; y: number }[] = []
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx
      const ny = y + dy
      if ((dx || dy) && nx >= 0 && ny >= 0 && nx < W && ny < H) out.push({ x: nx, y: ny })
    }
  return out
}

const countAround = (s: State, x: number, y: number) => neighbours(x, y).filter((n) => s.secret[n.y][n.x]).length

function lay(s: State, sx: number, sy: number) {
  const keepClear = (x: number, y: number) => Math.abs(x - sx) <= 1 && Math.abs(y - sy) <= 1
  let left = SECRETS
  while (left > 0) {
    const x = rand(W)
    const y = rand(H)
    if (s.secret[y][x] || keepClear(x, y)) continue
    s.secret[y][x] = true
    left--
  }
  s.laid = true
}

/** opens a cell (flood-filling blanks); returns false if it held a secret */
function reveal(s: State, x: number, y: number): boolean {
  if (s.bar[y][x]) return true
  if (s.open[y][x]) {
    // a number with all its secrets barred opens the rest of its neighbours
    const around = neighbours(x, y)
    const n = countAround(s, x, y)
    if (n === 0 || around.filter((c) => s.bar[c.y][c.x]).length !== n) return true
    return around.every((c) => s.open[c.y][c.x] || reveal(s, c.x, c.y))
  }
  if (s.secret[y][x]) {
    s.hit = { x, y }
    return false
  }
  const stack = [{ x, y }]
  while (stack.length) {
    const c = stack.pop()!
    if (s.open[c.y][c.x] || s.bar[c.y][c.x]) continue
    s.open[c.y][c.x] = true
    if (countAround(s, c.x, c.y) === 0) stack.push(...neighbours(c.x, c.y))
  }
  return true
}

const allOpen = (s: State) => s.open.flat().filter(Boolean).length === W * H - SECRETS

export function Redaction({ armed, setArmed }: GameProps) {
  const { t } = useSettings()
  const best = useRecords()[ID]
  const s = useRef<State>(fresh())
  const [phase, setPhase] = useState<Phase>('ready')
  const [outcome, setOutcome] = useState<Outcome>()
  const [, redraw] = useReducer((n: number) => n + 1, 0)

  useInterval(
    () => {
      s.current.seconds++
      redraw()
    },
    phase === 'play' && s.current.laid ? 1000 : null,
  )

  const end = (result: 'win' | 'leak') => {
    const st = s.current
    st.done = result
    if (result === 'win') {
      st.secret.forEach((row, y) => row.forEach((v, x) => (st.bar[y][x] = v)))
      sfx.select()
      const record = submitRecord(ID, st.seconds, 'low')
      setOutcome({ stamp: t('games.redact.win'), tone: 'fg', lines: [`${t('games.time')}: ${formatTime(st.seconds)}`], record })
    } else {
      sfx.stamp()
      setOutcome({ stamp: t('games.redact.over'), lines: [`${t('games.time')}: ${formatTime(st.seconds)}`] })
    }
    setPhase('over')
  }

  const open = (x: number, y: number) => {
    const st = s.current
    if (!st.laid) lay(st, x, y)
    if (!reveal(st, x, y)) end('leak')
    else if (allOpen(st)) end('win')
    else sfx.click()
  }

  const toggleBar = (x: number, y: number) => {
    const st = s.current
    if (st.open[y][x]) return
    st.bar[y][x] = !st.bar[y][x]
    sfx.blip()
  }

  const onKey = (k: GameKey) => {
    const c = s.current.cursor
    if (k === 'up') c.y = (c.y + H - 1) % H
    else if (k === 'down') c.y = (c.y + 1) % H
    else if (k === 'left') c.x = (c.x + W - 1) % W
    else if (k === 'right') c.x = (c.x + 1) % W
    else if (k === 'a') open(c.x, c.y)
    else toggleBar(c.x, c.y)
    redraw()
  }

  const onPointer = (px: number, y: number, kind: PointerKind) => {
    const x = Math.floor(px / 2)
    s.current.cursor = { x, y }
    if (kind === 'down') open(x, y)
    else if (kind === 'context') toggleBar(x, y)
    redraw()
  }

  // ---- draw
  const st = s.current
  const grid = makeGrid(W * 2, H)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let text = '[]'
      let tone: Tone = 'dim'
      const n = countAround(st, x, y)
      if (st.done === 'leak' && st.secret[y][x]) [text, tone] = ['**', st.hit?.x === x && st.hit.y === y ? 'dinv' : 'danger']
      else if (st.done === 'leak' && st.bar[y][x]) [text, tone] = ['XX', 'danger']
      else if (st.bar[y][x]) [text, tone] = ['  ', 'inv']
      else if (st.open[y][x]) [text, tone] = n ? [` ${n}`, n > 2 ? 'accent' : 'fg'] : [' .', 'faint']
      if (phase === 'play' && st.cursor.x === x && st.cursor.y === y) tone = 'ainv'
      put(grid, x * 2, y, text, tone)
    }
  const barsLeft = SECRETS - st.bar.flat().filter(Boolean).length

  return (
    <GameShell
      armed={armed}
      setArmed={setArmed}
      label={t('games.redact.name')}
      phase={phase}
      setPhase={setPhase}
      onStart={() => {
        s.current = fresh()
        setOutcome(undefined)
        setPhase('play')
      }}
      startClick
      onKey={onKey}
      onPointer={onPointer}
      grid={grid}
      status={[
        { label: t('games.time'), value: formatTime(st.seconds) },
        { label: t('games.marks'), value: String(barsLeft).padStart(2, '0') },
        { label: t('games.best'), value: best == null ? t('games.noRecord') : formatTime(best) },
      ]}
      outcome={outcome}
      pad={{ dirs: true, a: '◻', b: '■' }}
    />
  )
}
