import type { ComponentType } from 'react'
import type { GameProps } from './GameShell'
import { formatTime, pad } from './engine'
import { PasswordHack } from './PasswordHack'
import { PneumaticMail } from './PneumaticMail'
import { Redaction } from './Redaction'
import { ArchiveShelf } from './ArchiveShelf'
import { TheQueue } from './TheQueue'

export interface GameDef {
  /** URL slug and the prefix of its strings in i18n: games.<id>.name, games.<id>.blurb */
  id: string
  /** short code shown in the program list */
  code: string
  Component: ComponentType<GameProps>
  /** which way records go: more points, or less time */
  better: 'high' | 'low'
  formatRecord: (v: number) => string
  /** controls for the manual: keys, then the i18n key of what they do */
  controls: [string[], string][]
}

export const GAMES: GameDef[] = [
  {
    id: 'hack',
    code: 'ВЗЛ',
    Component: PasswordHack,
    better: 'high',
    formatRecord: (v) => pad(v, 3),
    controls: [
      [['←', '→', '↑', '↓'], 'games.ctl.select'],
      [['ENTER'], 'games.ctl.confirm'],
      [[], 'games.ctl.mouse'],
    ],
  },
  {
    id: 'tube',
    code: 'ПНВ',
    Component: PneumaticMail,
    better: 'high',
    formatRecord: (v) => pad(v, 3),
    controls: [[['←', '→', '↑', '↓'], 'games.ctl.steer']],
  },
  {
    id: 'redact',
    code: 'ЦНЗ',
    Component: Redaction,
    better: 'low',
    formatRecord: formatTime,
    controls: [
      [['←', '→', '↑', '↓'], 'games.ctl.move'],
      [['ENTER'], 'games.ctl.reveal'],
      [['F'], 'games.ctl.flag'],
      [[], 'games.ctl.mouse'],
      [[], 'games.ctl.right'],
    ],
  },
  {
    id: 'shelf',
    code: 'СТЛ',
    Component: ArchiveShelf,
    better: 'high',
    formatRecord: (v) => pad(v, 6),
    controls: [
      [['←', '→'], 'games.ctl.move'],
      [['↑'], 'games.ctl.rotate'],
      [['↓'], 'games.ctl.soft'],
      [['SPACE'], 'games.ctl.drop'],
    ],
  },
  {
    id: 'queue',
    code: 'ОЧР',
    Component: TheQueue,
    better: 'high',
    formatRecord: (v) => pad(v, 5),
    controls: [
      [['←'], 'games.ctl.approve'],
      [['→'], 'games.ctl.return'],
    ],
  },
]

/** keys every game shares, appended to each manual */
export const COMMON_CONTROLS: [string[], string][] = [
  [['P'], 'games.ctl.pause'],
  [['ESC'], 'games.ctl.release'],
]
