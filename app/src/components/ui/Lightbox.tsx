import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useUi } from '../../lib/ui'
import { useSettings } from '../../lib/settings'
import { useImageCaption } from './PhotoPrint'
import { focusStyle } from './EntityThumb'
import { sfx } from '../../lib/sound'

const ZOOM = 2.5

interface Zoom {
  /** rendered width of the zoomed image, px */
  width: number
  /** point that was clicked, as a fraction of the image (0..1) */
  fx: number
  fy: number
}

/** Full-screen, unfiltered image viewer (rendered above all CRT effects). */
export function Lightbox() {
  const { lightbox, closeLightbox, openLightbox } = useUi()
  const { t } = useSettings()
  const captionOf = useImageCaption()
  const [zoom, setZoom] = useState<Zoom | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const thumbsRef = useRef<HTMLDivElement>(null)

  useEffect(() => setZoom(null), [lightbox?.index, lightbox?.images])

  const go = (i: number) => {
    if (!lightbox) return
    const n = lightbox.images.length
    sfx.blip()
    openLightbox(lightbox.images, (i + n) % n)
  }

  useEffect(() => {
    if (!lightbox) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        closeLightbox()
      } else if (e.key === 'ArrowRight') go(lightbox.index + 1)
      else if (e.key === 'ArrowLeft') go(lightbox.index - 1)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightbox, closeLightbox])

  // keep the active thumbnail visible
  useEffect(() => {
    thumbsRef.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [lightbox?.index])

  // after zooming in, scroll so the clicked point sits in the middle of the stage
  useLayoutEffect(() => {
    const stage = stageRef.current
    const el = imgRef.current
    if (!zoom || !stage || !el) return
    stage.scrollLeft = el.offsetLeft + el.offsetWidth * zoom.fx - stage.clientWidth / 2
    stage.scrollTop = el.offsetTop + el.offsetHeight * zoom.fy - stage.clientHeight / 2
  }, [zoom])

  const toggleZoom = (e?: MouseEvent) => {
    const el = imgRef.current
    if (!el) return
    if (zoom) return setZoom(null)
    const r = el.getBoundingClientRect()
    const fx = e ? (e.clientX - r.left) / r.width : 0.5
    const fy = e ? (e.clientY - r.top) / r.height : 0.5
    // zoom relative to what is on screen, so small images grow too
    setZoom({ width: r.width * ZOOM, fx, fy })
  }

  const img = lightbox?.images[lightbox.index]
  const many = (lightbox?.images.length ?? 0) > 1

  return createPortal(
    <AnimatePresence>
      {lightbox && img && (
        <motion.div
          key="lightbox"
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={captionOf(img)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeLightbox}
        >
          <div className="lightbox__bar" onClick={(e) => e.stopPropagation()}>
            <span>
              {t('photo.frame', { n: lightbox.index + 1, total: lightbox.images.length })} · {captionOf(img)}
            </span>
            <span className="lightbox__actions">
              <button type="button" className="key-btn" onClick={() => toggleZoom()}>
                {zoom ? t('photo.fit') : t('photo.zoom')}
              </button>
              <a className="key-btn" href={img.original || img.url} target="_blank" rel="noreferrer">
                {t('photo.original')}
              </a>
              <button type="button" className="key-btn" onClick={closeLightbox}>
                <kbd>ESC</kbd> {t('common.close')}
              </button>
            </span>
          </div>

          {/* clicks on the empty stage fall through to the backdrop and close the viewer */}
          <div ref={stageRef} className={`lightbox__stage ${zoom ? 'lightbox__stage--zoom' : ''}`}>
            <motion.img
              ref={imgRef}
              key={img.url}
              src={img.url}
              alt={captionOf(img)}
              style={zoom ? { width: zoom.width, maxWidth: 'none', maxHeight: 'none' } : undefined}
              initial={{ opacity: 0, filter: 'brightness(3) grayscale(1)' }}
              animate={{ opacity: 1, filter: 'brightness(1) grayscale(0)' }}
              transition={{ duration: 0.45 }}
              onClick={(e) => {
                e.stopPropagation()
                toggleZoom(e)
              }}
            />
          </div>

          {many && (
            <>
              <button
                type="button"
                className="lightbox__nav lightbox__nav--prev"
                aria-label={t('photo.prev')}
                onClick={(e) => {
                  e.stopPropagation()
                  go(lightbox.index - 1)
                }}
              >
                ◀
              </button>
              <button
                type="button"
                className="lightbox__nav lightbox__nav--next"
                aria-label={t('photo.next')}
                onClick={(e) => {
                  e.stopPropagation()
                  go(lightbox.index + 1)
                }}
              >
                ▶
              </button>
              <div ref={thumbsRef} className="lightbox__thumbs" onClick={(e) => e.stopPropagation()}>
                {lightbox.images.map((im, i) => (
                  <button
                    key={im.url + i}
                    type="button"
                    className="lightbox__thumb"
                    aria-current={i === lightbox.index}
                    aria-label={`${i + 1}. ${captionOf(im)}`}
                    title={captionOf(im)}
                    onClick={() => i !== lightbox.index && go(i)}
                  >
                    <img src={im.url} alt="" style={focusStyle(im)} />
                  </button>
                ))}
              </div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
