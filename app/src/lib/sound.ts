/** Tiny WebAudio synth — no audio assets needed. */
let ctx: AudioContext | null = null
let enabled = false

export function setSoundEnabled(v: boolean) {
  enabled = v
}

function ac() {
  if (!enabled) return null
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function tone(freq: number, dur: number, type: OscillatorType = 'square', gain = 0.03, delay = 0) {
  const a = ac()
  if (!a) return
  const t = a.currentTime + delay
  const o = a.createOscillator()
  const g = a.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  g.gain.setValueAtTime(gain, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(a.destination)
  o.start(t)
  o.stop(t + dur + 0.02)
}

export const sfx = {
  /** typewriter / key click */
  click: () => tone(1800 + Math.random() * 400, 0.025, 'square', 0.015),
  /** menu move */
  blip: () => tone(660, 0.04, 'square', 0.02),
  /** confirm */
  select: () => {
    tone(520, 0.05, 'square', 0.025)
    tone(880, 0.07, 'square', 0.025, 0.05)
  },
  /** pager beep-beep */
  pager: () => {
    for (let i = 0; i < 3; i++) tone(2900, 0.09, 'square', 0.02, i * 0.16)
  },
  /** rubber stamp thud */
  stamp: () => tone(90, 0.12, 'sine', 0.12),
}
