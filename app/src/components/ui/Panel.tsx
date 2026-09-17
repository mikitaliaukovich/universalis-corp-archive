import type { ReactNode } from 'react'

interface Props {
  title?: ReactNode
  code?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
  scroll?: boolean
}

/** Double-bordered CRT panel with optional header strip. */
export function Panel({ title, code, actions, children, className = '', scroll = true }: Props) {
  return (
    <section className={`panel ${className}`}>
      {(title || actions || code) && (
        <header className="panel__head">
          {title && <h2 className="panel__title">{title}</h2>}
          {code && <span className="panel__code">{code}</span>}
          {actions && <div className="panel__actions">{actions}</div>}
        </header>
      )}
      <div className={`panel__body ${scroll ? 'panel__body--scroll' : ''}`}>{children}</div>
    </section>
  )
}
