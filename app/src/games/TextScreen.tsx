import { useRef, type MouseEvent, type PointerEvent } from 'react'
import type { Grid, Tone } from './engine'

export type PointerKind = 'move' | 'down' | 'context'

interface Props {
  grid: Grid
  label: string
  /** pointer position in grid cells; `down` = primary click/tap, `context` = right click or long press */
  onPointer?: (x: number, y: number, kind: PointerKind) => void
}

/** Characters the UI font draws at exactly one column; anything else gets a fixed-width box of its own. */
function isSafe(ch: string) {
  const c = ch.codePointAt(0) ?? 0
  // ASCII, Latin-1, basic Cyrillic and the numero sign
  return (c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || (c >= 0x400 && c <= 0x45f) || c === 0x2116
}

/**
 * A character-cell screen. Every cell is one column of the monospace UI font, rows are 1.2em,
 * so two columns make a square. Runs of same-tone text are merged into one span.
 */
export function TextScreen({ grid, label, onPointer }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const press = useRef<{ timer: number; fired: boolean } | null>(null)
  const rows = grid.length
  const cols = grid[0]?.length ?? 0

  const cellAt = (e: { clientX: number; clientY: number }) => {
    const box = ref.current!.getBoundingClientRect()
    const x = Math.floor(((e.clientX - box.left) / box.width) * cols)
    const y = Math.floor(((e.clientY - box.top) / box.height) * rows)
    return x >= 0 && y >= 0 && x < cols && y < rows ? { x, y } : null
  }

  const handlers = onPointer && {
    onPointerMove: (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const c = cellAt(e)
      if (c) onPointer(c.x, c.y, 'move')
    },
    onPointerDown: (e: PointerEvent) => {
      if (e.button !== 0) return
      const c = cellAt(e)
      if (!c) return
      if (e.pointerType === 'mouse') {
        onPointer(c.x, c.y, 'down')
        return
      }
      // touch: a long press acts as a right click, a short one as a tap
      const state = { fired: false, timer: 0 }
      state.timer = window.setTimeout(() => {
        state.fired = true
        onPointer(c.x, c.y, 'context')
      }, 450)
      press.current = state
    },
    onPointerUp: (e: PointerEvent) => {
      const state = press.current
      press.current = null
      if (!state) return
      clearTimeout(state.timer)
      if (state.fired) return
      const c = cellAt(e)
      if (c) onPointer(c.x, c.y, 'down')
    },
    onPointerCancel: () => {
      if (press.current) clearTimeout(press.current.timer)
      press.current = null
    },
    onContextMenu: (e: MouseEvent) => {
      e.preventDefault()
      if (press.current) return
      const c = cellAt(e)
      if (c) onPointer(c.x, c.y, 'context')
    },
  }

  return (
    <div
      ref={ref}
      className={`tscreen ${onPointer ? 'tscreen--live' : ''}`}
      style={{ ['--cols' as string]: cols, ['--rows' as string]: rows }}
      role="img"
      aria-label={label}
      {...handlers}
    >
      {grid.map((row, y) => {
        const spans: { text: string; tone: Tone; box: boolean }[] = []
        for (const cell of row) {
          const box = !isSafe(cell.ch)
          const last = spans[spans.length - 1]
          if (!box && last && !last.box && last.tone === cell.tone) last.text += cell.ch
          else spans.push({ text: cell.ch, tone: cell.tone, box })
        }
        return (
          <div className="tscreen__row" key={y}>
            {spans.map((s, i) => (
              <span key={i} className={`t-${s.tone}${s.box ? ' tscreen__box' : ''}`}>
                {s.text}
              </span>
            ))}
          </div>
        )
      })}
    </div>
  )
}
