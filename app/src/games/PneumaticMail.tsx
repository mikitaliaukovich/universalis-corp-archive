import { useReducer, useRef, useState } from 'react'
import { useSettings } from '../lib/settings'
import { sfx } from '../lib/sound'
import { makeGrid, pad, put, rand, submitRecord, useInterval, useRecords, type GameKey } from './engine'
import { GameShell, type GameProps, type Outcome, type Phase } from './GameShell'

const ID = 'tube'
const W = 22
const H = 15

type P = { x: number; y: number }
const DIRS: Record<'up' | 'down' | 'left' | 'right', P> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

interface State {
  body: P[]
  dir: P
  /** buffered turns, so two quick presses between ticks both count */
  turns: P[]
  capsule: P
  score: number
}

function placeCapsule(body: P[]): P {
  for (;;) {
    const p = { x: rand(W), y: rand(H) }
    if (!body.some((b) => b.x === p.x && b.y === p.y)) return p
  }
}

function fresh(): State {
  const body = [
    { x: 6, y: 7 },
    { x: 5, y: 7 },
    { x: 4, y: 7 },
  ]
  return { body, dir: DIRS.right, turns: [], capsule: placeCapsule(body), score: 0 }
}

/** one tick: 'dead' when the tube hits a wall or itself, 'ate' when it picks up a capsule */
function step(s: State): 'ok' | 'ate' | 'dead' {
  s.dir = s.turns.shift() ?? s.dir
  const head = { x: s.body[0].x + s.dir.x, y: s.body[0].y + s.dir.y }
  if (head.x < 0 || head.y < 0 || head.x >= W || head.y >= H) return 'dead'
  const ate = head.x === s.capsule.x && head.y === s.capsule.y
  const body = ate ? s.body : s.body.slice(0, -1)
  if (body.some((b) => b.x === head.x && b.y === head.y)) return 'dead'
  s.body = [head, ...body]
  if (!ate) return 'ok'
  s.score++
  s.capsule = placeCapsule(s.body)
  return 'ate'
}

const speed = (score: number) => Math.max(65, 150 - score * 4)

export function PneumaticMail({ armed, setArmed }: GameProps) {
  const { t } = useSettings()
  const best = useRecords()[ID]
  const s = useRef<State>(fresh())
  const [phase, setPhase] = useState<Phase>('ready')
  const [outcome, setOutcome] = useState<Outcome>()
  const [, redraw] = useReducer((n: number) => n + 1, 0)

  useInterval(
    () => {
      const r = step(s.current)
      if (r === 'ate') sfx.blip()
      if (r === 'dead') {
        sfx.stamp()
        const record = submitRecord(ID, s.current.score, 'high')
        setOutcome({ stamp: t('games.tube.over'), lines: [`${t('games.capsules')}: ${pad(s.current.score, 3)}`], record })
        setPhase('over')
      }
      redraw()
    },
    phase === 'play' ? speed(s.current.score) : null,
  )

  const onKey = (k: GameKey) => {
    if (k === 'a' || k === 'b') return
    const d = DIRS[k]
    const last = s.current.turns[s.current.turns.length - 1] ?? s.current.dir
    if ((d.x === last.x && d.y === last.y) || (d.x === -last.x && d.y === -last.y) || s.current.turns.length >= 3) return
    s.current.turns.push(d)
  }

  const st = s.current
  const grid = makeGrid(W * 2, H)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) put(grid, x * 2, y, ' .', 'faint')
  put(grid, st.capsule.x * 2, st.capsule.y, '()', 'accent')
  st.body.forEach((b, i) => put(grid, b.x * 2, b.y, i === 0 ? '::' : '  ', i === 0 ? 'ainv' : 'inv'))

  return (
    <GameShell
      armed={armed}
      setArmed={setArmed}
      label={t('games.tube.name')}
      phase={phase}
      setPhase={setPhase}
      onStart={() => {
        s.current = fresh()
        setOutcome(undefined)
        setPhase('play')
      }}
      onKey={onKey}
      grid={grid}
      status={[
        { label: t('games.capsules'), value: pad(st.score, 3) },
        { label: t('games.best'), value: best == null ? t('games.noRecord') : pad(best, 3) },
      ]}
      outcome={outcome}
      pad={{ dirs: true, a: '▶' }}
    />
  )
}
