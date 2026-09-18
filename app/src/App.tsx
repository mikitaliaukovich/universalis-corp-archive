import { useCallback, useEffect, useState } from 'react'
import { HashRouter, Route, Routes, useLocation, useNavigate, useParams } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { content } from './lib/content'
import { SettingsProvider, useSettings } from './lib/settings'
import { UiProvider, useUi } from './lib/ui'
import { isTypingTarget } from './lib/routes'
import { setSoundEnabled, sfx } from './lib/sound'
import { CrtFrame } from './components/shell/CrtFrame'
import { BootSequence } from './components/shell/BootSequence'
import { accessRequired } from './lib/access'
import { HeaderBar } from './components/shell/HeaderBar'
import { HotkeyBar } from './components/shell/HotkeyBar'
import { PagerToast } from './components/shell/PagerToast'
import { SearchOverlay } from './components/shell/SearchOverlay'
import { SettingsOverlay } from './components/shell/SettingsOverlay'
import { ClearanceOverlay } from './components/shell/ClearanceOverlay'
import { GuideTour } from './components/shell/GuideTour'
import { Lightbox } from './components/ui/Lightbox'
import { Home } from './pages/Home'
import { Chronicle } from './pages/Chronicle'
import { Personnel } from './pages/Personnel'
import { Glossary } from './pages/Glossary'
import { NotFound } from './pages/NotFound'

const VIEWS = { chronicle: Chronicle, personnel: Personnel, glossary: Glossary }
const BOOT_KEY = 'universalis.booted'

function SectionRoute() {
  const { section, id } = useParams()
  const s = content.site.sections.find((x) => x.path === section)
  if (!s) return <NotFound />
  const View = VIEWS[s.view]
  return <View section={s} id={id} />
}

function useGlobalKeys() {
  const { overlay, setOverlay, lightbox } = useUi()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'Escape') {
        if (lightbox) return
        if (overlay) {
          setOverlay(null)
          return
        }
        const parts = location.pathname.split('/').filter(Boolean)
        if (parts.length) {
          sfx.blip()
          navigate(parts.length > 1 ? `/${parts[0]}` : '/')
        }
        return
      }
      if (overlay || lightbox || isTypingTarget(e.target)) return
      const sections = content.site.sections
      if (e.key === '/' || e.code === 'Slash') {
        e.preventDefault()
        setOverlay('search')
      } else if (e.code === 'KeyS') {
        setOverlay('settings')
      } else if (e.key === 'Tab') {
        e.preventDefault()
        const current = sections.findIndex((s) => location.pathname.startsWith(`/${s.path}`))
        const next = e.shiftKey ? (current <= 0 ? sections.length - 1 : current - 1) : (current + 1) % sections.length
        sfx.select()
        navigate(`/${sections[next].path}`)
      } else {
        const s = sections.find((x) => x.hotkey === e.key)
        if (s) {
          sfx.select()
          navigate(`/${s.path}`)
        } else if (e.key === '0') navigate('/')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [overlay, lightbox, setOverlay, navigate, location.pathname])
}

function Shell() {
  const { settings } = useSettings()
  const { overlay, setOverlay } = useUi()
  const location = useLocation()
  // the password gate (site.yaml → access) runs inside the boot screen, even when the boot effect is off
  const [gate] = useState(accessRequired)
  const [booting, setBooting] = useState(() => {
    if (gate) return true
    try {
      return settings.effects.boot && !sessionStorage.getItem(BOOT_KEY)
    } catch {
      return settings.effects.boot
    }
  })
  useGlobalKeys()

  useEffect(() => setSoundEnabled(settings.effects.sound), [settings.effects.sound])

  const finishBoot = useCallback(() => {
    try {
      sessionStorage.setItem(BOOT_KEY, '1')
    } catch {
      /* ignore */
    }
    setBooting(false)
  }, [])

  // First visit: ask for the reader's clearance (reading progress).
  useEffect(() => {
    if (!booting && settings.progress == null) setOverlay('clearance')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booting])

  // On narrow screens the whole window scrolls — start each record at the top.
  useEffect(() => {
    if (document.documentElement.scrollHeight > window.innerHeight) window.scrollTo(0, 0)
  }, [location.pathname])

  const sectionKey = location.pathname.split('/')[1] ?? ''

  return (
    <CrtFrame>
      <AnimatePresence mode="wait">
        {booting ? (
          <BootSequence key="boot" onDone={finishBoot} gate={gate} instant={!settings.effects.boot} />
        ) : (
          <motion.div
            key="app"
            className="app"
            initial={{ opacity: 0, filter: 'brightness(3)' }}
            animate={{ opacity: 1, filter: 'brightness(1)' }}
            transition={{ duration: 0.4 }}
          >
            <HeaderBar />
            <main className="app__main">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={sectionKey}
                  className="page"
                  initial={{ opacity: 0, clipPath: 'inset(49% 0 49% 0)' }}
                  animate={{ opacity: 1, clipPath: 'inset(0% 0 0% 0)' }}
                  exit={{ opacity: 0, clipPath: 'inset(49% 0 49% 0)' }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                >
                  <Routes location={location}>
                    <Route path="/" element={<Home />} />
                    <Route path="/:section/:id?" element={<SectionRoute />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </motion.div>
              </AnimatePresence>
            </main>
            <HotkeyBar />
            <PagerToast />
            <GuideTour />
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {overlay === 'search' && <SearchOverlay key="search" />}
        {overlay === 'settings' && <SettingsOverlay key="settings" />}
        {overlay === 'clearance' && <ClearanceOverlay key="clearance" />}
      </AnimatePresence>
      <Lightbox />
    </CrtFrame>
  )
}

export default function App() {
  return (
    <SettingsProvider>
      <UiProvider>
        <HashRouter>
          <Shell />
        </HashRouter>
      </UiProvider>
    </SettingsProvider>
  )
}
