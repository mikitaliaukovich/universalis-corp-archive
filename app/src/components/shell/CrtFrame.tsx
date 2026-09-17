import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { content } from '../../lib/content'
import { useSettings } from '../../lib/settings'

const FILTER_ID = 'crt-curvature'
const MAP_SIZE = 256

/**
 * Barrel-distortion map for feDisplacementMap. Every output pixel at normalised position
 * (u, v) ∈ [-1, 1] samples the source at (u, v)·(1 + k·r²): the picture is squeezed towards
 * the corners and its edges bow outwards, like the glass of a picture tube.
 * Red encodes the x offset, green the y offset, 0.5 = no offset.
 */
function makeDisplacementMap(k: number, width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = MAP_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const img = ctx.createImageData(MAP_SIZE, MAP_SIZE)
  // largest offset (at a corner, r² = 2), in px — defines the filter's `scale`
  const scale = 2 * k * 2 * Math.max(width, height) / 2 + 2
  for (let y = 0; y < MAP_SIZE; y++) {
    const v = ((y + 0.5) / MAP_SIZE) * 2 - 1
    for (let x = 0; x < MAP_SIZE; x++) {
      const u = ((x + 0.5) / MAP_SIZE) * 2 - 1
      const r2 = u * u + v * v
      const dx = u * k * r2 * (width / 2)
      const dy = v * k * r2 * (height / 2)
      const i = (y * MAP_SIZE + x) * 4
      img.data[i] = Math.round((0.5 + dx / scale) * 255)
      img.data[i + 1] = Math.round((0.5 + dy / scale) * 255)
      img.data[i + 2] = 128
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return { url: canvas.toDataURL(), scale }
}

/** SVG filters on HTML are unreliable in Safari; on phones the offset hurts tapping. */
function useCurvatureSupported() {
  const [ok, setOk] = useState(() => check())
  function check() {
    if (typeof window === 'undefined') return false
    const safari = /^((?!chrome|chromium|android|crios|fxios).)*safari/i.test(navigator.userAgent)
    return !safari && window.matchMedia('(min-width: 761px) and (hover: hover)').matches
  }
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 761px) and (hover: hover)')
    const on = () => setOk(check())
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return ok
}

/** Monitor bezel + screen effects. Most effects are CSS, toggled by `fx-*` classes on <html>. */
export function CrtFrame({ children }: { children: ReactNode }) {
  const { settings } = useSettings()
  const screenRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const supported = useCurvatureSupported()
  const { curvature: amount, softness } = content.theme.crt
  const active = settings.effects.curvature && supported && amount > 0

  useEffect(() => {
    const el = screenRef.current
    if (!el || !active) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize((s) => (s && Math.abs(s.w - width) < 1 && Math.abs(s.h - height) < 1 ? s : { w: width, h: height }))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [active])

  const map = useMemo(
    () => (active && size && size.w > 0 ? makeDisplacementMap(amount, size.w, size.h) : null),
    [active, size, amount],
  )

  useEffect(() => {
    document.documentElement.classList.toggle('crt-curved', !!map)
  }, [map])

  return (
    <div className="crt">
      {map && size && (
        <svg className="crt__defs" width="0" height="0" aria-hidden="true" focusable="false">
          <filter
            id={FILTER_ID}
            filterUnits="userSpaceOnUse"
            primitiveUnits="userSpaceOnUse"
            x="0"
            y="0"
            width={size.w}
            height={size.h}
            colorInterpolationFilters="sRGB"
          >
            <feImage href={map.url} x="0" y="0" width={size.w} height={size.h} preserveAspectRatio="none" result="map" />
            <feDisplacementMap in="SourceGraphic" in2="map" scale={map.scale} xChannelSelector="R" yChannelSelector="G" result="bent" />
            {/* displacement samples nearest-neighbour; a hair of blur hides the row seams (and reads as phosphor softness) */}
            {softness > 0 && <feGaussianBlur in="bent" stdDeviation={softness} />}
          </filter>
        </svg>
      )}
      <div ref={screenRef} className="crt__screen" style={map ? { filter: `url(#${FILTER_ID})` } : undefined}>
        <div className="crt__content">{children}</div>
        <div id="overlay-root" />
        <div className="crt__fx crt__scanlines" aria-hidden="true" />
        <div className="crt__fx crt__noise" aria-hidden="true" />
        <div className="crt__fx crt__roll" aria-hidden="true" />
        <div className="crt__fx crt__vignette" aria-hidden="true" />
      </div>
      <div className="crt__glass" aria-hidden="true" />
    </div>
  )
}
