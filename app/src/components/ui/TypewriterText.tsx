import { useEffect, useRef, useState } from 'react'
import { useSettings } from '../../lib/settings'
import { sfx } from '../../lib/sound'

interface Props {
  text: string
  speed?: number
  delay?: number
  cursor?: boolean
  className?: string
  sound?: boolean
  onDone?: () => void
}

/** Reveals text character by character like a teletype. */
export function TypewriterText({ text, speed = 22, delay = 0, cursor = false, className = '', sound = false, onDone }: Props) {
  const { settings } = useSettings()
  const animate = settings.effects.typewriter
  const [n, setN] = useState(animate ? 0 : text.length)
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  useEffect(() => {
    if (!animate) {
      setN(text.length)
      doneRef.current?.()
      return
    }
    setN(0)
    let i = 0
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      i++
      setN(i)
      if (sound && i % 2 === 0 && text[i - 1] !== ' ') sfx.click()
      if (i < text.length) timer = setTimeout(tick, speed)
      else doneRef.current?.()
    }
    timer = setTimeout(tick, delay)
    return () => clearTimeout(timer)
  }, [text, animate, speed, delay, sound])

  const done = n >= text.length
  return (
    <span className={`typewriter ${className}`}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">{text.slice(0, n)}</span>
      {(cursor || !done) && <span className="cursor" aria-hidden="true" />}
    </span>
  )
}
