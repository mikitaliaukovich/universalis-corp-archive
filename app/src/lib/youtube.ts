/** Minimal YouTube IFrame Player API loader — only the parts the header radio uses. */

export const PlayerState = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } as const

export interface YTPlayer {
  playVideo(): void
  pauseVideo(): void
  nextVideo(): void
  playVideoAt(index: number): void
  setShuffle(v: boolean): void
  setLoop(v: boolean): void
  setVolume(v: number): void
  getPlayerState(): number
  getPlaylist(): string[] | null
  getVideoData(): { video_id?: string; title?: string; author?: string }
  getIframe(): HTMLIFrameElement
  destroy(): void
}

export interface YTPlayerOptions {
  host?: string
  width?: number | string
  height?: number | string
  playerVars?: Record<string, string | number>
  events?: {
    onReady?: (e: { target: YTPlayer }) => void
    onStateChange?: (e: { target: YTPlayer; data: number }) => void
    onError?: (e: { target: YTPlayer; data: number }) => void
  }
}

interface YTNamespace {
  Player: new (el: HTMLElement, opts: YTPlayerOptions) => YTPlayer
}

declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

let loading: Promise<YTNamespace> | null = null

/** Injects the API script once; safe to call repeatedly (e.g. on hover as a preload). */
export function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  loading ??= new Promise<YTNamespace>((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      prev?.()
      resolve(window.YT!)
    }
    const s = document.createElement('script')
    s.src = 'https://www.youtube.com/iframe_api'
    s.async = true
    s.onerror = () => {
      loading = null
      s.remove()
      reject(new Error('YouTube API failed to load'))
    }
    document.head.appendChild(s)
  })
  return loading
}

/** Lets the global M hotkey reach the radio without threading a context through the shell. */
export const radioControl: { toggle: (() => void) | null } = { toggle: null }
