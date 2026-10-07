import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import type { Site } from '../lib/content'
import { useSettings } from '../lib/settings'
import { sfx } from '../lib/sound'
import { Panel } from '../components/ui/Panel'
import { ListMenu } from '../components/ui/ListMenu'
import { FactTable, SubHead } from '../components/ui/EntityBits'
import { TypewriterText } from '../components/ui/TypewriterText'
import { COMMON_CONTROLS, GAMES, type GameDef } from '../games/registry'
import { useRecords } from '../games/engine'
import { NotFound } from './NotFound'

type Section = Site['sections'][number]

export function Games({ section, id }: { section: Section; id?: string }) {
  const { t, l } = useSettings()
  const records = useRecords()
  const game = id ? GAMES.find((g) => g.id === id) : undefined
  // the running game owns the keyboard; the list's ↑/↓ wait until it lets go
  const [armed, setArmed] = useState(false)
  useEffect(() => setArmed(false), [id])

  if (id && !game) return <NotFound />

  const items = GAMES.map((g) => ({
    id: g.id,
    href: `/${section.path}/${g.id}`,
    prefix: g.code,
    label: t(`games.${g.id}.name`),
    suffix: records[g.id] != null ? g.formatRecord(records[g.id]) : undefined,
  }))

  return (
    <div className={`layout3 ${game ? 'has-selection' : ''}`}>
      <Panel title={l(section.label)} code={section.code} className="layout3__left">
        <ListMenu items={items} activeId={game?.id} primary={!armed} />
      </Panel>

      <Panel key={game?.id ?? 'dir'} title={game ? t(`games.${game.id}.name`) : t('games.programs')} code={game?.code ?? 'DIR'} className="layout3__center games__center">
        {game ? <game.Component armed={armed} setArmed={setArmed} /> : <Directory section={section} />}
      </Panel>

      <Panel title={t('games.manual')} code="MAN" className="layout3__right">
        {game ? <Manual game={game} /> : <RecordTable />}
      </Panel>
    </div>
  )
}

/** No program selected: a DIR listing of the recreation drive. */
function Directory({ section }: { section: Section }) {
  const { t, l } = useSettings()
  const records = useRecords()
  const drive = `C:\\${section.path.toUpperCase()}>`
  return (
    <div className="dirlist">
      <p className="home__intro">
        <TypewriterText text={t('games.intro')} speed={12} cursor />
      </p>
      <p className="dirlist__cmd">
        {drive} {t('games.dir')}
      </p>
      <ul className="dirlist__files">
        {GAMES.map((g) => (
          <li key={g.id}>
            <Link to={`/${section.path}/${g.id}`} className="dirlist__file" onMouseEnter={() => sfx.blip()} onClick={() => sfx.select()}>
              <span className="dirlist__name">{g.id.toUpperCase().padEnd(8, ' ')}</span>
              <span className="dirlist__ext">EXE</span>
              <span className="dirlist__title">{t(`games.${g.id}.name`)}</span>
              <span className="dirlist__best">{records[g.id] != null ? g.formatRecord(records[g.id]) : '---'}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="dirlist__cmd muted">{t('games.files', { n: GAMES.length })}</p>
      <p className="dirlist__cmd">
        {drive} <span className="cursor" aria-hidden="true" />
      </p>
      <span className="sr-only">{l(section.description)}</span>
    </div>
  )
}

function Manual({ game }: { game: GameDef }) {
  const { t } = useSettings()
  const records = useRecords()
  const best = records[game.id]
  return (
    <>
      <p className="games__blurb">{t(`games.${game.id}.blurb`)}</p>
      <SubHead code="KEY">{t('games.controls')}</SubHead>
      <ul className="games__controls">
        {[...game.controls, ...COMMON_CONTROLS].map(([keys, label]) => (
          <li key={label}>
            {keys.length > 0 && (
              <span className="games__keys">
                {keys.map((k) => (
                  <kbd key={k}>{k}</kbd>
                ))}
              </span>
            )}
            <span className={keys.length ? '' : 'muted'}>{t(label)}</span>
          </li>
        ))}
      </ul>
      <p className="muted small">{t('games.arm')}</p>
      <SubHead code="REC">{t('games.records')}</SubHead>
      <FactTable rows={[[t('games.best'), best != null ? game.formatRecord(best) : t('games.noRecord')]]} />
      <p className="muted small">{t('games.recordsNote')}</p>
    </>
  )
}

function RecordTable() {
  const { t } = useSettings()
  const records = useRecords()
  return (
    <>
      <SubHead code="REC">{t('games.records')}</SubHead>
      <FactTable rows={GAMES.map((g) => [t(`games.${g.id}.name`), records[g.id] != null ? g.formatRecord(records[g.id]) : t('games.noRecord')])} />
      <p className="muted small">{t('games.recordsNote')}</p>
      <p className="muted small">{t('games.arm')}</p>
    </>
  )
}
