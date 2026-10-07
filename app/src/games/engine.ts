import { useEffect, useRef, useSyncExternalStore } from 'react'

/* ------------------------------------------------------------------ grid */

/** fg/dim/faint/accent/danger = text colour; inv/ainv/dinv = filled cell (phosphor / accent / danger) */
export type Tone = 'fg' | 'dim' | 'faint' | 'accent' | 'danger' | 'inv' | 'ainv' | 'dinv'
export interface Cell {
  ch: string
  tone: Tone
}
export type Grid = Cell[][]

export function makeGrid(cols: number, rows: number): Grid {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ ch: ' ', tone: 'fg' as Tone })))
}

/** Writes `text` at (x, y); characters falling outside the grid are dropped. */
export function put(grid: Grid, x: number, y: number, text: string, tone: Tone = 'fg') {
  const row = grid[y]
  if (!row) return
  const chars = [...text]
  for (let i = 0; i < chars.length; i++) {
    const cx = x + i
    if (cx >= 0 && cx < row.length) row[cx] = { ch: chars[i], tone }
  }
}

/** Pads / cuts a string to exactly `n` characters. */
export function fit(text: string, n: number, align: 'left' | 'right' = 'left') {
  const chars = [...text].slice(0, n)
  const pad = ' '.repeat(n - chars.length)
  return align === 'left' ? chars.join('') + pad : pad + chars.join('')
}

export const pad = (n: number, width: number) => String(Math.max(0, Math.floor(n))).padStart(width, '0')

export function formatTime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/* ------------------------------------------------------------------ randomness */

export const rand = (n: number) => Math.floor(Math.random() * n)
export const pick = <T>(list: readonly T[]): T => list[rand(list.length)]
export function shuffle<T>(list: T[]): T[] {
  for (let i = list.length - 1; i > 0; i--) {
    const j = rand(i + 1)
    ;[list[i], list[j]] = [list[j], list[i]]
  }
  return list
}

/* ------------------------------------------------------------------ input */

/** Abstract buttons: arrows / WASD, A = Enter or Space, B = F, X or Z. */
export type GameKey = 'up' | 'down' | 'left' | 'right' | 'a' | 'b'

const KEYMAP: Record<string, GameKey> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
  Enter: 'a',
  NumpadEnter: 'a',
  Space: 'a',
  KeyF: 'b',
  KeyX: 'b',
  KeyZ: 'b',
}

export function gameKeyOf(e: KeyboardEvent): GameKey | undefined {
  return KEYMAP[e.code] ?? KEYMAP[e.key]
}

/** Calls `cb` every `ms` milliseconds; `null` stops it. The latest callback is always used. */
export function useInterval(cb: () => void, ms: number | null) {
  const ref = useRef(cb)
  ref.current = cb
  useEffect(() => {
    if (ms == null) return
    const id = setInterval(() => ref.current(), ms)
    return () => clearInterval(id)
  }, [ms])
}

/* ------------------------------------------------------------------ records */

/** Per-device best results, { [gameId]: value }. */
const KEY = 'universalis.games.v1'
type Records = Record<string, number>

let records: Records = load()
const listeners = new Set<() => void>()

function load(): Records {
  try {
    const raw = localStorage.getItem(KEY)
    const data = raw ? (JSON.parse(raw) as unknown) : {}
    if (!data || typeof data !== 'object') return {}
    return Object.fromEntries(Object.entries(data).filter(([, v]) => typeof v === 'number' && Number.isFinite(v))) as Records
  } catch {
    return {}
  }
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useRecords(): Records {
  return useSyncExternalStore(subscribe, () => records)
}

/** Stores `value` if it beats the record; returns true for a new record. `better: 'low'` = smaller wins (times). */
export function submitRecord(id: string, value: number, better: 'high' | 'low'): boolean {
  if (better === 'high' && value <= 0) return false
  const prev = records[id]
  const beats = prev == null || (better === 'high' ? value > prev : value < prev)
  if (!beats) return false
  records = { ...records, [id]: value }
  try {
    localStorage.setItem(KEY, JSON.stringify(records))
  } catch {
    /* storage unavailable: the record lasts for this visit */
  }
  listeners.forEach((l) => l())
  return true
}
