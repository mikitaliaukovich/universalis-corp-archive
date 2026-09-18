import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { content, type Effects, type L10n } from './content'

const KEY = 'universalis.settings.v1'
/** tips that existed while tourSeen was a single flag; readers who saw those still get tips added later */
const LEGACY_TOUR = ['search', 'clearance', 'language', 'settings']

export interface Settings {
  lang: string
  palette: string
  effects: Effects
  /** last chapter the reader has finished; null = not asked yet */
  progress: number | null
  /** targets of the newcomer tips (site.yaml → tour) already shown or dismissed */
  tourSeen: string[]
  /** header radio volume, 0–100 */
  radioVolume: number
}

function defaults(): Settings {
  const { site, theme } = content
  const browser = typeof navigator !== 'undefined' ? navigator.language.slice(0, 2) : ''
  const lang = site.detectBrowserLanguage && site.languages.some((l) => l.id === browser) ? browser : site.defaultLanguage
  return { lang, palette: theme.defaultPalette, effects: { ...theme.effects }, progress: null, tourSeen: [], radioVolume: site.radio.volume }
}

function load(): Settings {
  const d = defaults()
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return d
    const s = JSON.parse(raw) as Partial<Settings>
    return {
      lang: content.site.languages.some((l) => l.id === s.lang) ? s.lang! : d.lang,
      palette: s.palette && content.theme.palettes[s.palette] ? s.palette : d.palette,
      effects: { ...d.effects, ...(s.effects ?? {}) },
      progress: typeof s.progress === 'number' ? s.progress : null,
      tourSeen: Array.isArray(s.tourSeen)
        ? s.tourSeen.filter((x): x is string => typeof x === 'string')
        : (s.tourSeen as unknown) === true
          ? LEGACY_TOUR
          : [],
      radioVolume: typeof s.radioVolume === 'number' ? Math.min(100, Math.max(0, s.radioVolume)) : d.radioVolume,
    }
  } catch {
    return d
  }
}

interface Ctx {
  settings: Settings
  update: (patch: Partial<Settings>) => void
  setEffect: (k: keyof Effects, v: boolean) => void
  reset: () => void
  /** translate UI string, with {placeholders} */
  t: (key: string, vars?: Record<string, string | number>) => string
  /** pick a localized field */
  l: (v: L10n | undefined) => string
  /** progress with null treated as "everything unlocked" */
  readTo: number
  /** ids explicitly declassified this session */
  declassified: Set<string>
  declassify: (id: string) => void
}

const SettingsContext = createContext<Ctx | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(load)
  const [declassified, setDeclassified] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings))
    } catch {
      /* storage unavailable */
    }
  }, [settings])

  // palette & fonts -> CSS variables
  useEffect(() => {
    const p = content.theme.palettes[settings.palette]
    const root = document.documentElement
    for (const [k, v] of Object.entries(p)) if (typeof v === 'string') root.style.setProperty(`--${k}`, v)
    const f = content.theme.fonts
    root.style.setProperty('--font-ui', f.ui)
    root.style.setProperty('--font-heading', f.heading)
    root.style.setProperty('--font-type', f.typewriter)
    root.lang = settings.lang
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', p.bg)
    for (const [k, v] of Object.entries(settings.effects)) root.classList.toggle(`fx-${k}`, v)
  }, [settings])

  const update = useCallback((patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })), [])
  const setEffect = useCallback(
    (k: keyof Effects, v: boolean) => setSettings((s) => ({ ...s, effects: { ...s.effects, [k]: v } })),
    [],
  )
  const reset = useCallback(() => setSettings(defaults()), [])
  const declassify = useCallback((id: string) => setDeclassified((s) => new Set(s).add(id)), [])

  const value = useMemo<Ctx>(() => {
    const dict = content.i18n[settings.lang] ?? {}
    const fallback = content.i18n[content.site.defaultLanguage] ?? {}
    return {
      settings,
      update,
      setEffect,
      reset,
      declassified,
      declassify,
      readTo: settings.progress ?? content.maxChapter,
      t: (key, vars) => {
        let s = dict[key] ?? fallback[key] ?? key
        if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v))
        return s
      },
      l: (v) => (v ? v[settings.lang] ?? v[content.site.defaultLanguage] ?? Object.values(v)[0] ?? '' : ''),
    }
  }, [settings, update, setEffect, reset, declassified, declassify])

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings outside provider')
  return ctx
}

/** Whether an entity is hidden by the reader's progress. */
export function useLocked() {
  const { readTo, declassified } = useSettings()
  return useCallback(
    (e: { id: string; firstChapter: number }) => e.firstChapter > readTo && !declassified.has(e.id),
    [readTo, declassified],
  )
}
