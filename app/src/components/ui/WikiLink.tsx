import { Children, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { content } from '../../lib/content'
import { hrefFor } from '../../lib/routes'
import { useLocked, useSettings } from '../../lib/settings'
import { Redacted } from './Redacted'
import { EntityThumb } from './EntityThumb'

/** Cross-reference to any entity, with a hover preview card. */
export function WikiLink({ id, children }: { id: string; children?: ReactNode }) {
  const entity = content.byId.get(id)
  const locked = useLocked()
  const { l, t } = useSettings()
  const ref = useRef<HTMLAnchorElement>(null)
  const [pos, setPos] = useState<{ x: number; y: number; above: boolean } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  if (!entity) return <span className="wikilink wikilink--broken">{children ?? id}</span>
  const label = Children.count(children) > 0 ? children : l(entity.name)
  if (locked(entity)) return <Redacted ch={entity.firstChapter}>{label}</Redacted>

  const show = () => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const r = ref.current?.getBoundingClientRect()
      if (!r || matchMedia('(hover: none)').matches) return
      // positioned inside #overlay-root (which may sit under the CRT curvature filter)
      const root = document.getElementById('overlay-root')?.getBoundingClientRect() ?? new DOMRect(0, 0, window.innerWidth, window.innerHeight)
      const above = r.bottom > root.bottom - 220
      setPos({
        x: Math.min(Math.max(r.left - root.left, 12), root.width - 332),
        y: (above ? r.top - 8 : r.bottom + 8) - root.top,
        above,
      })
    }, 220)
  }
  const hide = () => {
    clearTimeout(timer.current)
    setPos(null)
  }
  const kindLabel = t(`kind.${entity.kind}`)

  return (
    <>
      <Link
        ref={ref}
        to={hrefFor(entity)}
        className={`wikilink wikilink--${entity.kind}`}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={hide}
      >
        {label}
      </Link>
      {createPortal(
        <AnimatePresence>
          {pos && (
            <motion.div
              className="hovercard"
              role="tooltip"
              style={{ left: pos.x, top: pos.y, translateY: pos.above ? '-100%' : '0%' }}
              initial={{ opacity: 0, scaleY: 0.2 }}
              animate={{ opacity: 1, scaleY: 1 }}
              exit={{ opacity: 0, scaleY: 0.2 }}
              transition={{ duration: 0.14 }}
            >
              <EntityThumb entity={entity} />
              <div className="hovercard__text">
                <span className="hovercard__kind">{kindLabel}</span>
                <strong className="hovercard__name">{l(entity.name)}</strong>
                <span className="hovercard__summary">{l(entity.summary)}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.getElementById('overlay-root') ?? document.body,
      )}
    </>
  )
}
