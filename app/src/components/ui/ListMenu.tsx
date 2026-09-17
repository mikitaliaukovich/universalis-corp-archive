import { Fragment, useEffect, useRef, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { isTypingTarget } from '../../lib/routes'
import { useUi } from '../../lib/ui'
import { sfx } from '../../lib/sound'

export interface ListItem {
  id: string
  href: string
  label: ReactNode
  prefix?: ReactNode
  suffix?: ReactNode
  locked?: boolean
  dim?: boolean
  group?: string
}

interface Props {
  items: ListItem[]
  activeId?: string
  /** keyboard ↑/↓ drive this list */
  primary?: boolean
  groupLabel?: (group: string) => ReactNode
  empty?: ReactNode
}

/** Vertical menu in the style of the reference: filled bar on the active row. */
export function ListMenu({ items, activeId, primary = false, groupLabel, empty }: Props) {
  const navigate = useNavigate()
  const { overlay, lightbox } = useUi()
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    // Scroll only the list's own panel, never the window (matters on mobile).
    const item = listRef.current?.querySelector<HTMLElement>('[aria-current="page"]')
    const box = listRef.current?.closest<HTMLElement>('.panel__body')
    if (!item || !box || box.scrollHeight <= box.clientHeight) return
    const top = item.offsetTop - box.offsetTop
    if (top < box.scrollTop) box.scrollTop = top - 8
    else if (top + item.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = top + item.offsetHeight - box.clientHeight + 8
  }, [activeId])

  useEffect(() => {
    if (!primary || overlay || lightbox) return
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.altKey || e.ctrlKey || e.metaKey) return
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      e.preventDefault()
      if (!items.length) return
      const i = items.findIndex((it) => it.id === activeId)
      const next = e.key === 'ArrowDown' ? (i + 1) % items.length : i <= 0 ? items.length - 1 : i - 1
      sfx.blip()
      navigate(items[next].href, { replace: true })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [primary, items, activeId, navigate, overlay, lightbox])

  if (!items.length) return <p className="muted list-empty">{empty}</p>

  let lastGroup: string | undefined
  return (
    <ul className="listmenu" ref={listRef}>
      {items.map((it) => {
        const header = groupLabel && it.group !== lastGroup ? it.group : undefined
        lastGroup = it.group
        return (
          <Fragment key={it.id}>
            {header !== undefined && <li className="listmenu__group">{groupLabel!(header)}</li>}
            <li>
              <Link
                to={it.href}
                className={`listmenu__item ${it.locked ? 'is-locked' : ''} ${it.dim ? 'is-dim' : ''}`}
                aria-current={it.id === activeId ? 'page' : undefined}
                onClick={() => sfx.blip()}
              >
                {it.prefix && <span className="listmenu__prefix">{it.prefix}</span>}
                <span className="listmenu__label">{it.label}</span>
                {it.locked ? <LockIcon /> : it.suffix && <span className="listmenu__suffix">{it.suffix}</span>}
              </Link>
            </li>
          </Fragment>
        )
      })}
    </ul>
  )
}

export function LockIcon() {
  return (
    <svg className="lock" width="14" height="16" viewBox="0 0 14 16" aria-hidden="true">
      <path d="M3 7V5a4 4 0 0 1 8 0v2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <rect x="1" y="7" width="12" height="9" fill="currentColor" />
      <rect x="6" y="10" width="2" height="3" fill="var(--bg)" />
    </svg>
  )
}
