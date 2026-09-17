import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useSettings } from '../../lib/settings'
import { sfx } from '../../lib/sound'

/** Inline redaction bar. Declassified automatically once chapter `ch` is read, or by click. */
export function Redacted({ ch, children }: { ch?: number; children?: ReactNode }) {
  const { readTo, t } = useSettings()
  const [open, setOpen] = useState(false)
  const cleared = ch != null && readTo >= ch
  if (cleared || open) {
    return (
      <motion.span
        className="declassified"
        title={ch != null ? t('redact.clearedTitle', { ch }) : t('redact.openedTitle')}
        initial={open ? { opacity: 0.2 } : false}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {children}
      </motion.span>
    )
  }
  return (
    <button
      type="button"
      className="redacted"
      title={ch != null ? t('redact.lockedTitle', { ch }) : t('redact.clickTitle')}
      aria-label={t('redact.clickTitle')}
      onClick={() => {
        sfx.select()
        setOpen(true)
      }}
    >
      <span className="redacted__text" aria-hidden="true">
        {children}
      </span>
    </button>
  )
}

export function ClassifiedBlock({ ch, title, children }: { ch?: number; title?: string; children?: ReactNode }) {
  const { readTo, t } = useSettings()
  const [open, setOpen] = useState(false)
  const cleared = (ch != null && readTo >= ch) || open
  return (
    <div className={`classified ${cleared ? 'classified--open' : ''}`}>
      <div className="classified__head">
        <span className="classified__label">{cleared ? t('redact.declassified') : t('redact.secret')}</span>
        <span className="classified__meta">
          {title ? `${title} · ` : ''}
          {ch != null ? t('redact.clearance', { ch }) : t('redact.authorOnly')}
        </span>
      </div>
      <AnimatePresence initial={false} mode="wait">
        {cleared ? (
          <motion.div
            key="open"
            className="classified__body"
            initial={{ clipPath: 'inset(0 0 100% 0)' }}
            animate={{ clipPath: 'inset(0 0 0% 0)' }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          >
            {children}
          </motion.div>
        ) : (
          <motion.button
            key="closed"
            type="button"
            className="classified__cover"
            onClick={() => {
              sfx.select()
              setOpen(true)
            }}
            exit={{ opacity: 0 }}
          >
            <span className="bars" aria-hidden="true">
              {[92, 78, 88, 54].map((w, i) => (
                <span key={i} style={{ width: `${w}%` }} />
              ))}
            </span>
            <span className="classified__cta">{t('redact.declassifyCta')}</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
