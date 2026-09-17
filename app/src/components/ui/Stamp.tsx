import { motion } from 'motion/react'
import { useEffect } from 'react'
import { hash } from '../../lib/routes'
import { sfx } from '../../lib/sound'

interface Props {
  text: string
  tone?: 'danger' | 'fg' | 'accent'
  className?: string
  delay?: number
  seed?: string
}

/** Rubber stamp that slams onto the page. */
export function Stamp({ text, tone = 'danger', className = '', delay = 0.35, seed }: Props) {
  const tilt = (hash(seed ?? text) - 0.5) * 14
  useEffect(() => {
    const timer = setTimeout(sfx.stamp, delay * 1000 + 120)
    return () => clearTimeout(timer)
  }, [delay, text])
  return (
    <motion.span
      key={text}
      className={`stamp stamp--${tone} ${className}`}
      initial={{ scale: 2.4, opacity: 0, rotate: tilt - 8 }}
      animate={{ scale: 1, opacity: 1, rotate: tilt }}
      transition={{ delay, type: 'spring', stiffness: 520, damping: 22 }}
    >
      {text}
    </motion.span>
  )
}
