import { useReducer, useRef, useState } from 'react'
import { useSettings } from '../lib/settings'
import { sfx } from '../lib/sound'
import { makeGrid, pad, put, shuffle, submitRecord, useInterval, useRecords, type GameKey } from './engine'
import { GameShell, type GameProps, type Outcome, type Phase } from './GameShell'

const ID = 'shelf'
const W = 10
const H = 20

type Matrix = number[][]
const SHAPES: Record<string, Matrix> = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
}
const LINE_SCORE = [0, 100, 300, 500, 800]

const rotate = (m: Matrix): Matrix => m[0].map((_, i) => m.map((row) => row[i]).reverse())

interface Piece {
  m: Matrix
  x: number
  y: number
}

interface State {
  board: number[][]
  cur: Piece
  next: Matrix
  bag: string[]
  score: number
  lines: number
}

function collides(board: number[][], m: Matrix, px: number, py: number) {
  for (let y = 0; y < m.length; y++)
    for (let x = 0; x < m[y].length; x++) {
      if (!m[y][x]) continue
      const bx = px + x
      const by = py + y
      if (bx < 0 || bx >= W || by >= H || (by >= 0 && board[by][bx])) return true
    }
  return false
}

/** 7-bag randomiser: every shape once per seven pieces */
function draw(s: { bag: string[] }): Matrix {
  if (!s.bag.length) s.bag = shuffle(Object.keys(SHAPES))
  return SHAPES[s.bag.pop()!]
}

const spawn = (m: Matrix): Piece => ({ m, x: Math.floor((W - m[0].length) / 2), y: m === SHAPES.I ? -1 : 0 })

function fresh(): State {
  const s = { board: Array.from({ length: H }, () => Array<number>(W).fill(0)), bag: [] as string[], score: 0, lines: 0 } as State
  s.cur = spawn(draw(s))
  s.next = draw(s)
  return s
}

const levelOf = (lines: number) => Math.floor(lines / 10) + 1
const gravity = (level: number) => Math.max(70, 750 - (level - 1) * 65)

/** fixes the piece, clears full shelves and brings the next one; false = no room for it */
function lock(s: State): boolean {
  const { m, x, y } = s.cur
  m.forEach((row, dy) => row.forEach((v, dx) => v && y + dy >= 0 && (s.board[y + dy][x + dx] = 1)))
  const kept = s.board.filter((row) => row.some((v) => !v))
  const cleared = H - kept.length
  if (cleared) {
    s.board = [...Array.from({ length: cleared }, () => Array<number>(W).fill(0)), ...kept]
    s.score += LINE_SCORE[cleared] * levelOf(s.lines)
    s.lines += cleared
    sfx.select()
  } else sfx.click()
  s.cur = spawn(s.next)
  s.next = draw(s)
  return !collides(s.board, s.cur.m, s.cur.x, s.cur.y)
}

export function ArchiveShelf({ armed, setArmed }: GameProps) {
  const { t } = useSettings()
  const best = useRecords()[ID]
  const s = useRef<State>(fresh())
  const [phase, setPhase] = useState<Phase>('ready')
  const [outcome, setOutcome] = useState<Outcome>()
  const [, redraw] = useReducer((n: number) => n + 1, 0)

  const finish = () => {
    sfx.stamp()
    const st = s.current
    const record = submitRecord(ID, st.score, 'high')
    setOutcome({ stamp: t('games.shelf.over'), lines: [`${t('games.score')}: ${pad(st.score, 6)}`, `${t('games.lines')}: ${pad(st.lines, 3)}`], record })
    setPhase('over')
  }

  /** moves down one row, locking the piece when it lands */
  const fall = () => {
    const st = s.current
    if (!collides(st.board, st.cur.m, st.cur.x, st.cur.y + 1)) {
      st.cur.y++
      return true
    }
    if (!lock(st)) finish()
    return false
  }

  useInterval(
    () => {
      fall()
      redraw()
    },
    phase === 'play' ? gravity(levelOf(s.current.lines)) : null,
  )

  const onKey = (k: GameKey) => {
    const st = s.current
    const { m, x, y } = st.cur
    if (k === 'left' || k === 'right') {
      const nx = x + (k === 'left' ? -1 : 1)
      if (!collides(st.board, m, nx, y)) st.cur.x = nx
    } else if (k === 'up' || k === 'b') {
      const r = rotate(m)
      // try a few sideways nudges so pieces can turn against a wall
      for (const dx of [0, -1, 1, -2, 2]) {
        if (!collides(st.board, r, x + dx, y)) {
          st.cur = { m: r, x: x + dx, y }
          sfx.blip()
          break
        }
      }
    } else if (k === 'down') {
      if (fall()) st.score += 1
    } else if (k === 'a') {
      let n = 0
      while (!collides(st.board, m, st.cur.x, st.cur.y + 1)) {
        st.cur.y++
        n++
      }
      st.score += n * 2
      if (!lock(st)) finish()
    }
    redraw()
  }

  // ---- draw: <! . . . !> well in the Elektronika-60 manner, next folder on the right
  const st = s.current
  const grid = makeGrid(36, H + 2)
  let ghost = st.cur.y
  while (!collides(st.board, st.cur.m, st.cur.x, ghost + 1)) ghost++
  for (let y = 0; y < H; y++) {
    put(grid, 0, y, '<!', 'dim')
    put(grid, 22, y, '!>', 'dim')
    for (let x = 0; x < W; x++) put(grid, 2 + x * 2, y, st.board[y][x] ? '[]' : ' .', st.board[y][x] ? 'fg' : 'faint')
  }
  const drawPiece = (p: Piece, tone: 'accent' | 'faint') =>
    p.m.forEach((row, dy) => row.forEach((v, dx) => v && p.y + dy >= 0 && put(grid, 2 + (p.x + dx) * 2, p.y + dy, '[]', tone)))
  if (phase !== 'over') {
    drawPiece({ ...st.cur, y: ghost }, 'faint')
    drawPiece(st.cur, 'accent')
  }
  put(grid, 0, H, '<!' + '='.repeat(W * 2) + '!>', 'dim')
  put(grid, 2, H + 1, '\\/'.repeat(W), 'dim')
  put(grid, 26, 1, t('games.shelf.next'), 'dim')
  st.next.forEach((row, dy) => row.forEach((v, dx) => v && put(grid, 26 + dx * 2, 3 + dy, '[]', 'fg')))

  return (
    <GameShell
      armed={armed}
      setArmed={setArmed}
      label={t('games.shelf.name')}
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
        { label: t('games.score'), value: pad(st.score, 6) },
        { label: t('games.lines'), value: pad(st.lines, 3) },
        { label: t('games.level'), value: pad(levelOf(st.lines), 2) },
        { label: t('games.best'), value: best == null ? t('games.noRecord') : pad(best, 6) },
      ]}
      outcome={outcome}
      pad={{ dirs: true, a: '⤓', b: '⟳' }}
    />
  )
}
