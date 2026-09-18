import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { content } from '../../lib/content'
import { useSettings } from '../../lib/settings'
import { sfx } from '../../lib/sound'
import { loadYouTubeApi, PlayerState, radioControl, type YTPlayer } from '../../lib/youtube'

type Status = 'off' | 'tuning' | 'playing' | 'paused' | 'error'
interface Track {
  title: string
  artist: string
}

/** consecutive unplayable tracks before the radio gives up */
const MAX_ERRORS = 5

/** "Artist - Topic" is how YouTube Music names auto-generated artist channels. */
function readTrack(p: YTPlayer): Track | null {
  const d = p.getVideoData()
  if (!d.title) return null
  return { title: d.title, artist: (d.author ?? '').replace(/\s+-\s+Topic$/i, '').trim() }
}

function trackLabel(t: Track) {
  if (!t.artist || t.title.toLowerCase().includes(t.artist.toLowerCase())) return t.title
  return `${t.artist} — ${t.title}`
}

/**
 * Header radio set ("радиоточка"): plays site.yaml → radio.playlistId through a hidden YouTube player.
 * Listeners see only the current track — never the playlist. YouTube is contacted only once the
 * listener reaches for the radio.
 */
export function RadioSet() {
  const cfg = content.site.radio
  const { t, settings, update } = useSettings()
  const [status, setStatus] = useState<Status>('off')
  const [track, setTrack] = useState<Track | null>(null)
  const playerRef = useRef<YTPlayer | null>(null)
  const hostRef = useRef<HTMLDivElement | null>(null)
  const creating = useRef(false)
  const errors = useRef(0)
  const volumeRef = useRef(settings.radioVolume)
  volumeRef.current = settings.radioVolume

  const preload = useCallback(() => {
    loadYouTubeApi().catch(() => {})
  }, [])

  const create = useCallback(async () => {
    if (creating.current || !cfg.playlistId) return
    creating.current = true
    setStatus('tuning')
    try {
      const YT = await loadYouTubeApi()
      const mount = document.createElement('div')
      hostRef.current?.appendChild(mount)
      new YT.Player(mount, {
        host: 'https://www.youtube-nocookie.com',
        width: 200,
        height: 200,
        playerVars: {
          listType: 'playlist',
          list: cfg.playlistId,
          controls: 0,
          disablekb: 1,
          playsinline: 1,
          rel: 0,
          fs: 0,
          iv_load_policy: 3,
        },
        events: {
          onReady: ({ target: p }) => {
            playerRef.current = p
            const iframe = p.getIframe()
            iframe.tabIndex = -1
            iframe.setAttribute('aria-hidden', 'true')
            p.setVolume(volumeRef.current)
            p.setLoop(true)
            const list = p.getPlaylist()
            if (cfg.shuffle && list?.length) {
              p.setShuffle(true)
              p.playVideoAt(Math.floor(Math.random() * list.length))
            } else p.playVideo()
          },
          onStateChange: ({ target: p, data }) => {
            if (data === PlayerState.PLAYING) {
              errors.current = 0
              setTrack(readTrack(p))
              setStatus('playing')
            } else if (data === PlayerState.PAUSED) setStatus('paused')
            else if (data === PlayerState.BUFFERING || data === PlayerState.UNSTARTED) {
              setStatus((s) => (s === 'paused' ? s : 'tuning'))
            }
          },
          onError: ({ target: p }) => {
            // 101/150: the owner forbids embedding; 100: removed or private. Skip to the next broadcast.
            errors.current += 1
            const list = p.getPlaylist()
            if (errors.current >= MAX_ERRORS || !list?.length) {
              p.pauseVideo()
              setTrack(null)
              setStatus('error')
            } else p.nextVideo()
          },
        },
      })
    } catch {
      creating.current = false
      setStatus('error')
    }
  }, [cfg.playlistId, cfg.shuffle])

  const toggle = useCallback(() => {
    sfx.blip()
    const p = playerRef.current
    if (!p) {
      if (!creating.current) void create()
      return
    }
    const state = p.getPlayerState()
    if (state === PlayerState.PLAYING || state === PlayerState.BUFFERING) p.pauseVideo()
    else {
      if (status === 'error') errors.current = 0
      setStatus('tuning')
      p.playVideo()
    }
  }, [create, status])

  const next = useCallback(() => {
    const p = playerRef.current
    if (!p) return
    sfx.blip()
    setStatus('tuning')
    p.nextVideo()
  }, [])

  // global M hotkey (App.tsx)
  useEffect(() => {
    radioControl.toggle = toggle
    return () => {
      radioControl.toggle = null
    }
  }, [toggle])

  useEffect(() => {
    playerRef.current?.setVolume(settings.radioVolume)
  }, [settings.radioVolume])

  // phone lock screen / headset buttons
  useEffect(() => {
    const ms = typeof navigator !== 'undefined' ? navigator.mediaSession : undefined
    if (!ms || !playerRef.current) return
    ms.metadata = track
      ? new MediaMetadata({ title: track.title, artist: track.artist, album: t('radio.label') })
      : null
    ms.setActionHandler('play', () => playerRef.current?.playVideo())
    ms.setActionHandler('pause', () => playerRef.current?.pauseVideo())
    ms.setActionHandler('nexttrack', next)
  }, [track, next, t])

  useEffect(
    () => () => {
      playerRef.current?.destroy()
      playerRef.current = null
    },
    [],
  )

  const playing = status === 'playing' || status === 'tuning'
  const readout =
    status === 'off'
      ? t('radio.off')
      : status === 'error'
        ? t('radio.nosignal')
        : status === 'tuning' || !track
          ? t('radio.tuning')
          : trackLabel(track)

  return (
    <div
      className={`radio radio--${status}`}
      data-tour="radio"
      role="group"
      aria-label={t('radio.label')}
      onPointerEnter={preload}
      onFocus={preload}
      onTouchStart={preload}
    >
      <button
        type="button"
        className="radio__btn"
        onClick={toggle}
        aria-pressed={playing}
        title={`${playing ? t('radio.pause') : t('radio.play')} (M)`}
        aria-label={playing ? t('radio.pause') : t('radio.play')}
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>
      <Readout text={readout} scroll={status === 'playing' || status === 'paused'} />
      <span className="radio__meter" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      <button
        type="button"
        className="radio__btn"
        onClick={next}
        disabled={!playerRef.current || status === 'off'}
        title={t('radio.next')}
        aria-label={t('radio.next')}
      >
        <NextIcon />
      </button>
      <input
        type="range"
        className="radio__volume hide-sm"
        min={0}
        max={100}
        step={5}
        value={settings.radioVolume}
        onChange={(e) => update({ radioVolume: Number(e.target.value) })}
        aria-label={t('radio.volume')}
        title={`${t('radio.volume')}: ${settings.radioVolume}`}
      />
      {createPortal(<div ref={hostRef} className="radio__host" aria-hidden="true" />, document.body)}
    </div>
  )
}

/** LCD strip; long titles scroll like a ticker. */
function Readout({ text, scroll }: { text: string; scroll: boolean }) {
  const boxRef = useRef<HTMLSpanElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  const [overflow, setOverflow] = useState(false)

  useLayoutEffect(() => {
    const box = boxRef.current
    const txt = textRef.current
    if (!box || !txt) return
    const measure = () => setOverflow(txt.scrollWidth > box.clientWidth + 1)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(box)
    return () => ro.disconnect()
  }, [text])

  const ticker = scroll && overflow
  return (
    <span ref={boxRef} className={`radio__lcd${ticker ? ' radio__lcd--ticker' : ''}`} aria-live="polite">
      <span
        className="radio__text"
        style={ticker ? { animationDuration: `${Math.max(8, text.length * 0.28)}s` } : undefined}
      >
        <span ref={textRef}>{text}</span>
        {ticker && <span aria-hidden="true">{text}</span>}
      </span>
    </span>
  )
}

const PlayIcon = () => (
  <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
    <path d="M3 1.5v9l7.5-4.5z" fill="currentColor" />
  </svg>
)
const PauseIcon = () => (
  <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
    <path d="M2.5 1.5h2.5v9H2.5zM7 1.5h2.5v9H7z" fill="currentColor" />
  </svg>
)
const NextIcon = () => (
  <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
    <path d="M1.5 1.5v9l6-4.5zM8.5 1.5h2v9h-2z" fill="currentColor" />
  </svg>
)
