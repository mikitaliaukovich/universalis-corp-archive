import { useMemo, useReducer, useRef, useState } from 'react'
import { content } from '../lib/content'
import { useLocked, useSettings } from '../lib/settings'
import { sfx } from '../lib/sound'
import { fit, makeGrid, pad, pick, put, rand, shuffle, submitRecord, useRecords, type GameKey } from './engine'
import { GameShell, type GameProps, type Outcome, type Phase } from './GameShell'
import type { PointerKind } from './TextScreen'

const ID = 'hack'
const ROWS = 16
const COLS = 12
const HALF = ROWS * COLS
const SIZE = HALF * 2
const ATTEMPTS = 4
const JUNK = '!@#$%^&*-_=+|;:\'",./?'
const OPEN = '([{<'
const CLOSE = ')]}>'
/** screen layout: 4 header rows, then two dump columns with addresses and the log on the right */
const TOP = 4
const COL_X = [7, 27]
const LOG_X = 41
const LOG_W = 15
const SCREEN_W = LOG_X + LOG_W

interface Word {
  text: string
  start: number
  tried?: boolean
  removed?: boolean
}

interface State {
  dump: string[]
  words: Word[]
  password: string
  attempts: number
  log: string[]
  cursor: { x: number; y: number }
  base: number
  streak: number
  won?: boolean
}

/** Single words of 5–8 letters from the open cards and files, plus the filler list in site.yaml. */
function usePool(): string[] {
  const { l, settings } = useSettings()
  const locked = useLocked()
  return useMemo(() => {
    const names = [...content.characters, ...content.terms].filter((e) => !locked(e)).map((e) => l(e.name))
    const extra = content.site.games.words[settings.lang] ?? []
    const words = [...names, ...extra]
      .flatMap((n) => n.split(/[^\p{L}]+/u))
      .map((w) => w.toUpperCase())
      .filter((w) => w.length >= 5 && w.length <= 8)
    return [...new Set(words)]
  }, [l, locked, settings.lang])
}

function generate(pool: string[], streak: number): State {
  const level = streak + 1
  const target = Math.min(8, 4 + level)
  const byLen = (n: number) => pool.filter((w) => w.length === n)
  // the target length if it has enough words, else the nearest one that does
  const len = [0, -1, 1, -2, 2, -3, 3].map((d) => target + d).find((n) => n >= 5 && n <= 8 && byLen(n).length >= 6) ?? 5
  const words = shuffle(byLen(len)).slice(0, Math.min(12, 7 + level))

  const dump = Array.from({ length: SIZE }, () => (Math.random() < 0.09 ? pick([...OPEN, ...CLOSE]) : pick([...JUNK])))
  const taken = new Array<boolean>(SIZE).fill(false)
  const placed: Word[] = []
  for (const text of words) {
    for (let tries = 0; tries < 200; tries++) {
      const start = rand(SIZE - len)
      const end = start + len - 1
      // keep a gap around each word and never run across the two columns
      if (Math.floor(start / HALF) !== Math.floor(end / HALF)) continue
      let free = true
      for (let i = start - 1; i <= end + 1; i++) if (taken[i]) free = false
      if (!free) continue
      for (let i = 0; i < len; i++) {
        dump[start + i] = text[i]
        taken[start + i] = true
      }
      placed.push({ text, start })
      break
    }
  }
  return {
    dump,
    words: placed,
    password: pick(placed).text,
    attempts: ATTEMPTS,
    log: [],
    cursor: { x: 0, y: 0 },
    base: 0xf000 + rand(0x80) * COLS,
    streak,
  }
}

const indexOf = (x: number, y: number) => (x < COLS ? 0 : HALF) + y * COLS + (x % COLS)
const posOf = (i: number) => ({ x: (i >= HALF ? COLS : 0) + (i % COLS), y: Math.floor((i % HALF) / COLS) })
const wordAt = (s: State, i: number) => s.words.find((w) => !w.removed && i >= w.start && i < w.start + w.text.length)

/** an opening bracket with its partner later on the same line and no letters between */
function bracketAt(s: State, i: number): [number, number] | undefined {
  const kind = OPEN.indexOf(s.dump[i])
  if (kind < 0) return
  const rowEnd = i - (i % COLS) + COLS
  for (let j = i + 1; j < rowEnd; j++) {
    if (wordAt(s, j)) return
    if (s.dump[j] === CLOSE[kind]) return [i, j]
  }
}

function likeness(a: string, b: string) {
  let n = 0
  for (let i = 0; i < a.length; i++) if (a[i] === b[i]) n++
  return n
}

/** word-wraps log lines into the log column, each entry starting with ">" */
function wrapLog(entries: string[]) {
  const lines: string[] = []
  for (const entry of entries) {
    let line = '>'
    for (const word of entry.split(' ')) {
      if (line.length > 1 && line.length + 1 + word.length > LOG_W) {
        lines.push(line)
        line = ' '
      }
      line += (line.length > 1 ? ' ' : '') + word
    }
    lines.push(line)
  }
  return lines
}

export function PasswordHack({ armed, setArmed }: GameProps) {
  const { t, settings } = useSettings()
  const best = useRecords()[ID]
  const pool = usePool()
  const s = useRef<State>(null!)
  s.current ??= generate(pool, 0)
  const [phase, setPhase] = useState<Phase>('ready')
  const [outcome, setOutcome] = useState<Outcome>()
  const [, redraw] = useReducer((n: number) => n + 1, 0)

  const choose = () => {
    const st = s.current
    const i = indexOf(st.cursor.x, st.cursor.y)
    const word = wordAt(st, i)
    const bracket = bracketAt(st, i)
    if (word) {
      st.log.push(word.text)
      if (word.text === st.password) {
        st.won = true
        st.streak++
        const record = submitRecord(ID, st.streak, 'high')
        const quotes = content.site.quotes[settings.lang] ?? []
        sfx.select()
        setOutcome({
          stamp: t('games.hack.granted'),
          tone: 'fg',
          lines: [`${t('games.streak')}: ${pad(st.streak, 3)}`, ...(quotes.length ? [t('games.hack.decrypted'), `«${pick(quotes)}»`] : [])],
          record,
          next: t('games.next'),
        })
        setPhase('over')
        return
      }
      word.tried = true
      st.attempts--
      st.log.push(t('games.hack.denied'), t('games.hack.likeness', { n: likeness(word.text, st.password) }))
      sfx.error()
      if (st.attempts <= 0) {
        st.won = false
        sfx.stamp()
        setOutcome({ stamp: t('games.hack.locked'), lines: [`${t('games.streak')}: ${pad(st.streak, 3)}`] })
        setPhase('over')
      }
    } else if (bracket) {
      const [a, b] = bracket
      st.log.push(st.dump.slice(a, b + 1).join(''))
      for (let j = a; j <= b; j++) st.dump[j] = '.'
      const duds = st.words.filter((w) => !w.removed && w.text !== st.password)
      if (duds.length && (st.attempts === ATTEMPTS || Math.random() < 0.75)) {
        const dud = pick(duds)
        dud.removed = true
        for (let j = 0; j < dud.text.length; j++) st.dump[dud.start + j] = '.'
        st.log.push(t('games.hack.dud'))
      } else {
        st.attempts = ATTEMPTS
        st.log.push(t('games.hack.reset'))
      }
      sfx.select()
    } else {
      st.log.push(st.dump[i], t('games.hack.error'))
      sfx.blip()
    }
  }

  const move = (dx: number, dy: number) => {
    const st = s.current
    const c = st.cursor
    const word = wordAt(st, indexOf(c.x, c.y))
    if (word && dx) {
      // step over the whole word
      const edge = dx > 0 ? word.start + word.text.length : word.start - 1
      if (edge >= 0 && edge < SIZE) st.cursor = posOf(edge)
    } else {
      st.cursor = { x: (c.x + dx + COLS * 2) % (COLS * 2), y: (c.y + dy + ROWS) % ROWS }
    }
    sfx.click()
  }

  const onKey = (k: GameKey) => {
    if (k === 'up') move(0, -1)
    else if (k === 'down') move(0, 1)
    else if (k === 'left') move(-1, 0)
    else if (k === 'right') move(1, 0)
    else choose()
    redraw()
  }

  const onPointer = (x: number, y: number, kind: PointerKind) => {
    const col = COL_X.findIndex((cx) => x >= cx && x < cx + COLS)
    if (col < 0 || y < TOP || y >= TOP + ROWS) return
    const next = { x: col * COLS + x - COL_X[col], y: y - TOP }
    const st = s.current
    if (next.x !== st.cursor.x || next.y !== st.cursor.y) {
      st.cursor = next
      if (kind === 'move') sfx.click()
    }
    if (kind !== 'move') choose()
    redraw()
  }

  // ---- draw
  const st = s.current
  const grid = makeGrid(SCREEN_W, TOP + ROWS)
  put(grid, 0, 0, t('games.hack.header'))
  put(grid, 0, 1, t('games.hack.prompt'))
  const label = t('games.hack.attempts', { n: st.attempts })
  put(grid, 0, 2, label)
  for (let i = 0; i < st.attempts; i++) put(grid, [...label].length + 1 + i * 2, 2, ' ', 'inv')

  const at = indexOf(st.cursor.x, st.cursor.y)
  const word = wordAt(st, at)
  const bracket = word ? undefined : bracketAt(st, at)
  const lit = word ? [word.start, word.start + word.text.length - 1] : bracket ?? [at, at]
  const showCursor = phase === 'play'
  for (let col = 0; col < 2; col++)
    for (let y = 0; y < ROWS; y++) {
      put(grid, COL_X[col] - 7, TOP + y, '0x' + (st.base + (col * ROWS + y) * COLS).toString(16).toUpperCase(), 'dim')
      for (let x = 0; x < COLS; x++) {
        const i = col * HALF + y * COLS + x
        const w = wordAt(st, i)
        const tone = showCursor && i >= lit[0] && i <= lit[1] ? 'inv' : w?.tried ? 'dim' : 'fg'
        put(grid, COL_X[col] + x, TOP + y, st.dump[i], tone)
      }
    }

  const selection = word ? word.text : bracket ? st.dump.slice(bracket[0], bracket[1] + 1).join('') : st.dump[at]
  const log = wrapLog(st.log).slice(-(ROWS - 1))
  log.forEach((line, i) => put(grid, LOG_X, TOP + ROWS - 1 - log.length + i, fit(line, LOG_W), 'fg'))
  if (showCursor) {
    put(grid, LOG_X, TOP + ROWS - 1, fit('>' + selection, LOG_W - 1), 'accent')
    put(grid, LOG_X + Math.min(LOG_W - 1, selection.length + 1), TOP + ROWS - 1, ' ', 'inv')
  }

  return (
    <GameShell
      armed={armed}
      setArmed={setArmed}
      label={t('games.hack.name')}
      phase={phase}
      setPhase={setPhase}
      onStart={() => {
        const prev = s.current
        s.current = generate(pool, prev.won ? prev.streak : 0)
        setOutcome(undefined)
        setPhase('play')
      }}
      onKey={onKey}
      onPointer={onPointer}
      grid={grid}
      status={[
        { label: t('games.streak'), value: pad(st.streak, 3) },
        { label: t('games.level'), value: pad(st.streak + 1, 2) },
        { label: t('games.best'), value: best == null ? t('games.noRecord') : pad(best, 3) },
      ]}
      outcome={outcome}
      pad={{ dirs: true, a: '⏎' }}
    />
  )
}
