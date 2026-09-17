import { useState } from 'react'
import { motion } from 'motion/react'
import { content, type Image } from '../../lib/content'
import { useSettings } from '../../lib/settings'
import { useUi } from '../../lib/ui'
import { focusStyle } from './EntityThumb'

interface Props {
  images: Image[]
  index?: number
  className?: string
  showCaption?: boolean
  label?: string
  /** apply the image's focal crop (for portrait-style frames) */
  crop?: boolean
  /** show the whole set as one pile of prints; click opens the gallery */
  stack?: boolean
}

export function useImageCaption() {
  const { l } = useSettings()
  return (img: Image) => l(img.caption) || l(content.taxonomy.imageKinds[img.kind]?.label)
}

/**
 * A full-colour photograph clipped into the dossier. It "develops" from a monochrome
 * phosphor print into its real colours once loaded. Click opens the lightbox.
 */
export function PhotoPrint({ images, index = 0, className = '', showCaption = true, label, crop = false, stack = false }: Props) {
  const { t } = useSettings()
  const captionOf = useImageCaption()
  const { openLightbox } = useUi()
  const [loaded, setLoaded] = useState(false)
  const img = images[index]
  if (!img) return null
  const caption = captionOf(img)
  const pile = stack && images.length > 1
  if (pile) label ??= t('photo.stack', { total: images.length })
  return (
    <figure className={`photo ${pile ? `photo--stack photo--stack-${Math.min(images.length - 1, 2)}` : ''} ${className}`}>
      <button
        type="button"
        className="photo__frame"
        onClick={() => openLightbox(images, index)}
        aria-label={t('photo.open', { name: caption })}
      >
        <span className="photo__clip" aria-hidden="true" />
        <span className={`photo__crop ${crop ? 'photo__crop--focus' : ''}`}>
          <motion.img
            src={img.url}
            alt={caption}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            style={crop ? focusStyle(img) : undefined}
            initial={false}
            animate={{
              filter: loaded
                ? 'grayscale(0) sepia(0) brightness(1) contrast(1)'
                : 'grayscale(1) sepia(1) brightness(0.55) contrast(1.4)',
            }}
            transition={{ duration: 1.4, ease: 'easeOut', delay: 0.15 }}
          />
        </span>
        <motion.span
          className="photo__develop"
          aria-hidden="true"
          initial={{ scaleY: 1 }}
          animate={{ scaleY: loaded ? 0 : 1 }}
          transition={{ duration: 0.9, ease: [0.7, 0, 0.3, 1] }}
        />
        {label && <span className="photo__label">{label}</span>}
      </button>
      {showCaption && (
        <figcaption className="photo__caption">
          <span>{caption}</span>
          {images.length > 1 && !pile && (
            <span className="photo__count">{t('photo.count', { n: index + 1, total: images.length })}</span>
          )}
        </figcaption>
      )}
    </figure>
  )
}
