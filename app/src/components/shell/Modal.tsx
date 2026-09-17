import { useEffect, useRef, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { useSettings } from '../../lib/settings'

interface Props {
  title: string
  code?: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}

/** Terminal "window" that unfolds from a line. Rendered inside the CRT screen. */
export function Modal({ title, code, onClose, children, wide }: Props) {
  const { t } = useSettings()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    const first =
      ref.current?.querySelector<HTMLElement>('.panel__body input') ??
      ref.current?.querySelector<HTMLElement>('.panel__body button') ??
      ref.current?.querySelector<HTMLElement>('button')
    first?.focus()
    return () => prev?.focus?.()
  }, [])

  return (
    <motion.div
      className="modal"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal__window panel ${wide ? 'modal__window--wide' : ''}`}
        initial={{ scaleY: 0.02, scaleX: 0.9 }}
        animate={{ scaleY: 1, scaleX: 1 }}
        exit={{ scaleY: 0.02, opacity: 0 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
      >
        <header className="panel__head">
          <h2 className="panel__title">{title}</h2>
          {code && <span className="panel__code">{code}</span>}
          <div className="panel__actions">
            <button type="button" className="key-btn" onClick={onClose}>
              <kbd>ESC</kbd> {t('common.close')}
            </button>
          </div>
        </header>
        <div className="panel__body panel__body--scroll">{children}</div>
      </motion.div>
    </motion.div>
  )
}
