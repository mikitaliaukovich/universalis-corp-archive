import { useReducer, useRef, useState } from 'react'
import { content } from '../lib/content'
import { useSettings } from '../lib/settings'
import { sfx } from '../lib/sound'
import { Stamp } from '../components/ui/Stamp'
import { makeGrid, pad, pick, put, rand, shuffle, submitRecord, useInterval, useRecords, type GameKey } from './engine'
import { GameShell, type GameProps, type Outcome, type Phase } from './GameShell'

const ID = 'queue'
const W = 44
const H = 17
const MAX_QUEUE = 10
const MAX_ERRORS = 3
/** files per directive */
const PER_STAGE = 8
const TICK = 100

type Rule = { kind: 'viol'; n: number } | { kind: 'moral'; n: number } | { kind: 'form' }

interface Soul {
  no: string
  given: number
  family: number
  born: number
  died: number
  viol: number
  moral: number
  form: boolean
}

interface State {
  stage: number
  rules: Rule[]
  soul: Soul
  waiting: number
  sinceArrival: number
  done: number
  inStage: number
  score: number
  errors: number
  /** stamp shown over the file just processed */
  stamp?: { id: number; approved: boolean; until: number }
  wrongUntil: number
  directiveUntil: number
}

function makeRules(stage: number): Rule[] {
  const viol: Rule = { kind: 'viol', n: 2 + rand(4) }
  const moral: Rule = { kind: 'moral', n: pick([30, 40, 50, 60]) }
  const form: Rule = { kind: 'form' }
  if (stage === 1) return [pick([viol, moral])]
  if (stage === 2) return shuffle([viol, moral, form]).slice(0, 2)
  return shuffle([viol, moral, form])
}

function makeSoul(): Soul {
  const born = 1880 + rand(80)
  return {
    no: `${pad(rand(10000), 4)}-${pad(rand(100), 2)}`,
    given: rand(1000),
    family: rand(1000),
    born,
    died: Math.min(1979, born + 16 + rand(75)),
    viol: rand(8),
    moral: rand(101),
    form: Math.random() < 0.8,
  }
}

const breaks = (r: Rule, s: Soul) => (r.kind === 'viol' ? s.viol > r.n : r.kind === 'moral' ? s.moral < r.n : !s.form)
const shouldReturn = (rules: Rule[], s: Soul) => rules.some((r) => breaks(r, s))
const arrivalMs = (stage: number) => Math.max(1500, 4200 * 0.88 ** (stage - 1))

function fresh(): State {
  return {
    stage: 1,
    rules: makeRules(1),
    soul: makeSoul(),
    waiting: 3,
    sinceArrival: 0,
    done: 0,
    inStage: 0,
    score: 0,
    errors: 0,
    wrongUntil: 0,
    directiveUntil: 0,
  }
}

const leader = (label: string, width: number) => {
  const head = [...label].slice(0, width - 2).join('') + ' '
  return head + '.'.repeat(Math.max(0, width - [...head].length - 1)) + ' '
}

export function TheQueue({ armed, setArmed }: GameProps) {
  const { t, settings } = useSettings()
  const best = useRecords()[ID]
  const s = useRef<State>(fresh())
  const [phase, setPhase] = useState<Phase>('ready')
  const [outcome, setOutcome] = useState<Outcome>()
  const [, redraw] = useReducer((n: number) => n + 1, 0)

  const finish = (stamp: string) => {
    const st = s.current
    sfx.stamp()
    const record = submitRecord(ID, st.score, 'high')
    setOutcome({ stamp, lines: [`${t('games.score')}: ${pad(st.score, 5)}`, `${t('games.queue.processed')}: ${st.done}`], record })
    setPhase('over')
  }

  useInterval(
    () => {
      const st = s.current
      st.sinceArrival += TICK
      if (st.sinceArrival >= arrivalMs(st.stage)) {
        st.sinceArrival = 0
        st.waiting++
        if (st.waiting > MAX_QUEUE) return finish(t('games.queue.heldUp'))
      }
      redraw()
    },
    phase === 'play' ? TICK : null,
  )

  const decide = (approve: boolean) => {
    const st = s.current
    const right = approve !== shouldReturn(st.rules, st.soul)
    const now = Date.now()
    st.done++
    st.stamp = { id: st.done, approved: approve, until: now + 650 }
    if (right) st.score += 10 * st.stage
    else {
      st.errors++
      st.wrongUntil = now + 1600
      sfx.error()
      if (st.errors >= MAX_ERRORS) return finish(t('games.queue.dismissed'))
    }
    if (++st.inStage >= PER_STAGE) {
      st.stage++
      st.inStage = 0
      st.rules = makeRules(st.stage)
      st.directiveUntil = now + 2200
      sfx.pager()
    }
    if (st.waiting > 0) {
      st.waiting--
      st.soul = makeSoul()
    } else {
      // nobody waiting: the next soul walks straight up to the window
      st.soul = makeSoul()
      st.sinceArrival = 0
    }
  }

  const onKey = (k: GameKey) => {
    if (k === 'left' || k === 'a') decide(true)
    else if (k === 'right' || k === 'b') decide(false)
    redraw()
  }

  // ---- draw
  const st = s.current
  const now = Date.now()
  const g = content.site.games
  const names = g.names[settings.lang] ?? []
  const surnames = g.surnames[settings.lang] ?? []
  const soulName = [names[st.soul.given % Math.max(1, names.length)], surnames[st.soul.family % Math.max(1, surnames.length)]]
    .filter(Boolean)
    .join(' ')
    .toUpperCase()
  const grid = makeGrid(W, H)
  const flashDirective = now < st.directiveUntil
  put(grid, 0, 0, `${t('games.queue.directive', { n: st.stage })} `, flashDirective ? 'inv' : 'fg')
  if (flashDirective) put(grid, W - [...t('games.queue.newDirective')].length, 0, t('games.queue.newDirective'), 'accent')
  put(grid, 0, 1, t('games.queue.returnIf'), 'dim')
  st.rules.forEach((r, i) => {
    const text = r.kind === 'viol' ? t('games.queue.ruleViol', { n: r.n }) : r.kind === 'moral' ? t('games.queue.ruleMoral', { n: r.n }) : t('games.queue.ruleForm')
    put(grid, 1, 2 + i, `· ${text}`, 'accent')
  })
  put(grid, 0, 5, '-'.repeat(W), 'faint')
  put(grid, 0, 6, t('games.queue.case', { n: st.soul.no }))
  const rows: [string, string][] = [
    [t('games.queue.soul'), soulName],
    [t('games.queue.years'), `${st.soul.born}-${st.soul.died}`],
    [t('games.queue.violations'), String(st.soul.viol)],
    [t('games.queue.moral'), String(st.soul.moral)],
    [t('games.queue.form'), st.soul.form ? t('games.queue.formOk') : t('games.queue.formMissing')],
  ]
  rows.forEach(([label, value], i) => {
    put(grid, 0, 8 + i, leader(label, 22), 'dim')
    put(grid, 22, 8 + i, value, 'fg')
  })
  if (now < st.wrongUntil) put(grid, 0, 13, `! ${t('games.queue.wrong')}`, 'danger')
  put(grid, 0, 14, '-'.repeat(W), 'faint')
  const qLabel = `${t('games.queue.queue')} `
  put(grid, 0, 15, qLabel, 'dim')
  for (let i = 0; i < MAX_QUEUE; i++) put(grid, [...qLabel].length + i * 2, 15, i < st.waiting ? ' ' : '.', i < st.waiting ? (st.waiting > 7 ? 'dinv' : 'inv') : 'faint')
  put(grid, [...qLabel].length + MAX_QUEUE * 2 + 1, 15, `${pad(st.waiting, 2)}/${MAX_QUEUE}`, st.waiting > 7 ? 'danger' : 'fg')
  const fill = Math.round((st.sinceArrival / arrivalMs(st.stage)) * W)
  put(grid, 0, 16, '='.repeat(fill), 'faint')

  const stamp = st.stamp && now < st.stamp.until ? st.stamp : undefined

  return (
    <GameShell
      armed={armed}
      setArmed={setArmed}
      label={t('games.queue.name')}
      phase={phase}
      setPhase={setPhase}
      onStart={() => {
        s.current = fresh()
        setOutcome(undefined)
        setPhase('play')
      }}
      onKey={onKey}
      grid={grid}
      status={[
        { label: t('games.score'), value: pad(st.score, 5) },
        { label: t('games.level'), value: pad(st.stage, 2) },
        { label: t('games.errors'), value: `${st.errors}/${MAX_ERRORS}` },
        { label: t('games.best'), value: best == null ? t('games.noRecord') : pad(best, 5) },
      ]}
      outcome={outcome}
      pad={{ dirs: false, left: `◀ ${t('games.queue.approved')}`, right: `${t('games.queue.returned')} ▶` }}
    >
      {stamp && (
        <div className="gamestage__stamp" key={stamp.id}>
          <Stamp
            text={stamp.approved ? t('games.queue.approved') : t('games.queue.returned')}
            tone={stamp.approved ? 'fg' : 'danger'}
            delay={0}
            seed={String(stamp.id)}
          />
        </div>
      )}
    </GameShell>
  )
}
