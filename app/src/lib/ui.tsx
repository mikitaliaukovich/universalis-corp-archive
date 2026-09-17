import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Image } from './content'

export type Overlay = null | 'search' | 'settings' | 'clearance'

interface Ui {
  overlay: Overlay
  setOverlay: (o: Overlay) => void
  lightbox: { images: Image[]; index: number } | null
  openLightbox: (images: Image[], index: number) => void
  closeLightbox: () => void
  lastPager: string | null
  setLastPager: (m: string) => void
}

const UiContext = createContext<Ui | null>(null)

export function UiProvider({ children }: { children: ReactNode }) {
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [lightbox, setLightbox] = useState<Ui['lightbox']>(null)
  const [lastPager, setLastPager] = useState<string | null>(null)
  const openLightbox = useCallback((images: Image[], index: number) => setLightbox({ images, index }), [])
  const closeLightbox = useCallback(() => setLightbox(null), [])
  const value = useMemo(
    () => ({ overlay, setOverlay, lightbox, openLightbox, closeLightbox, lastPager, setLastPager }),
    [overlay, lightbox, openLightbox, closeLightbox, lastPager],
  )
  return <UiContext.Provider value={value}>{children}</UiContext.Provider>
}

export function useUi() {
  const ctx = useContext(UiContext)
  if (!ctx) throw new Error('useUi outside provider')
  return ctx
}
