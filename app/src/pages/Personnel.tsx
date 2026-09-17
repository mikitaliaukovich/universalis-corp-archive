import { Link } from 'react-router'
import { motion } from 'motion/react'
import { appearancesOf, content, type Character, type Site } from '../lib/content'
import { useLocked, useSettings } from '../lib/settings'
import { hrefFor } from '../lib/routes'
import { Markdown } from '../lib/markdown'
import { Panel } from '../components/ui/Panel'
import { ListMenu } from '../components/ui/ListMenu'
import { Stamp } from '../components/ui/Stamp'
import { PhotoPrint } from '../components/ui/PhotoPrint'
import { Silhouette } from '../components/ui/Silhouette'
import { TypewriterText } from '../components/ui/TypewriterText'
import { EntityThumb, focusStyle, primaryImage } from '../components/ui/EntityThumb'
import { Backlinks, ChapterRef, EntityList, EntityName, FactTable, LockedNotice, SubHead } from '../components/ui/EntityBits'
import { NotFound } from './NotFound'

type Section = Site['sections'][number]

function factionOrder(id: string) {
  const i = content.taxonomy.factions.findIndex((f) => f.id === id)
  return i < 0 ? 999 : i
}

export function Personnel({ section, id }: { section: Section; id?: string }) {
  const { l, t } = useSettings()
  const locked = useLocked()
  const person = id ? content.characters.find((c) => c.id === id) : undefined
  if (id && !person) return <NotFound />

  const sorted = [...content.characters].sort((a, b) => factionOrder(a.faction) - factionOrder(b.faction) || a.order - b.order)
  const items = sorted.map((c) => ({
    id: c.id,
    href: `/${section.path}/${c.id}`,
    group: c.faction,
    label: locked(c) ? <span className="redacted redacted--static">{l(c.name)}</span> : l(c.name),
    suffix: content.taxonomy.characterStatuses[c.status] ? <StatusGlyph status={c.status} /> : undefined,
    locked: locked(c),
  }))

  return (
    <div className={`layout3 ${person ? 'has-selection' : ''}`}>
      <Panel title={l(section.label)} code={section.code} className="layout3__left">
        <ListMenu
          items={items}
          activeId={person?.id}
          primary
          groupLabel={(g) => l(content.taxonomy.factions.find((f) => f.id === g)?.label)}
        />
      </Panel>

      <Panel
        key={person?.id ?? 'index'}
        title={person ? t('personnel.dossier') : t('personnel.index')}
        code={person ? `№ ${String(sorted.indexOf(person) + 1).padStart(4, '0')}` : section.code}
        className="layout3__center"
      >
        {person ? locked(person) ? <LockedNotice entity={person} /> : <Dossier key={person.id} person={person} /> : <Roster people={sorted} />}
      </Panel>

      <Panel title={t('personnel.designs')} code="IMG" className="layout3__right">
        {person && !locked(person) ? (
          <>
            {person.images.length ? (
              <PhotoPrint images={person.images} stack />
            ) : (
              <Silhouette />
            )}
            {person.reference && (
              <>
                <SubHead code="REF">{t('personnel.reference')}</SubHead>
                <p>{l(person.reference)}</p>
              </>
            )}
            <SubHead code="CH">{t('personnel.appearances')}</SubHead>
            <EntityList ids={appearancesOf(content, person.id).map((c) => c.id)} note={(c) => l(c.summary).slice(0, 80) + '…'} />
            <SubHead code="←">{t('common.mentionedIn')}</SubHead>
            <Backlinks id={person.id} />
          </>
        ) : (
          <FactionNotes />
        )}
      </Panel>
    </div>
  )
}

function StatusGlyph({ status }: { status: string }) {
  const { l } = useSettings()
  const s = content.taxonomy.characterStatuses[status]
  return (
    <span className={`status-glyph status-glyph--${status}`} title={l(s?.label)}>
      {l(s?.label).slice(0, 1)}
    </span>
  )
}

function Dossier({ person }: { person: Character }) {
  const { l, t, settings } = useSettings()
  const status = content.taxonomy.characterStatuses[person.status]
  const faction = content.taxonomy.factions.find((f) => f.id === person.faction)
  const main = primaryImage(person)
  const mainIndex = main ? person.images.indexOf(main) : -1

  return (
    <article className="dossier">
      <div className="dossier__top">
        <div className="dossier__photo">
          {mainIndex >= 0 ? <PhotoPrint images={person.images} index={mainIndex} showCaption={false} crop /> : <Silhouette />}
          {status && <Stamp text={l(person.stamp ?? status.stamp)} tone={person.status === 'dead' ? 'danger' : 'fg'} seed={person.id} className="dossier__stamp" />}
        </div>
        <div className="dossier__fields">
          <span className="dossier__kicker">{l(faction?.label)}</span>
          <h1 className="dossier__name">
            <TypewriterText key={settings.lang} text={l(person.name)} speed={40} />
          </h1>
          <p className="dossier__role">{l(person.role)}</p>
          <FactTable
            rows={[
              [t('personnel.status'), l(status?.label)],
              ...person.facts.map((f) => [l(f.label), l(f.value)] as [string, string]),
              [t('personnel.firstSeen'), person.firstChapter ? <ChapterRef n={person.firstChapter} /> : undefined],
            ]}
          />
        </div>
      </div>

      {person.quote && (
        <blockquote className="dossier__quote">
          <Markdown>{l(person.quote)}</Markdown>
        </blockquote>
      )}

      <motion.div className="dossier__body typed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
        <Markdown>{person.body[settings.lang] ?? ''}</Markdown>
      </motion.div>

      {person.relations.length > 0 && (
        <>
          <SubHead code="REL">{t('personnel.relations')}</SubHead>
          <ul className="relations">
            {person.relations.map((r) => {
              const other = content.byId.get(r.id)
              if (!other) return null
              return (
                <li key={r.id + l(r.type)}>
                  <Link to={hrefFor(other)} className="relations__item">
                    <EntityThumb entity={other} size="sm" />
                    <span>
                      <strong>
                        <EntityName entity={other} />
                      </strong>
                      <span className="muted">{l(r.type)}</span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </article>
  )
}

function Roster({ people }: { people: Character[] }) {
  const { l } = useSettings()
  const locked = useLocked()
  return (
    <ul className="roster">
      {people.map((p, i) => {
        const isLocked = locked(p)
        const img = primaryImage(p)
        return (
          <motion.li key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.025 }}>
            <Link to={hrefFor(p)} className={`roster__card ${isLocked ? 'is-locked' : ''}`}>
              <span className="roster__photo">
                {img && !isLocked ? <img src={img.url} alt="" loading="lazy" style={focusStyle(img)} /> : <Silhouette compact />}
              </span>
              <span className="roster__name">
                <EntityName entity={p} />
              </span>
              {!isLocked && <span className="roster__role">{l(p.role)}</span>}
            </Link>
          </motion.li>
        )
      })}
    </ul>
  )
}

function FactionNotes() {
  const { l } = useSettings()
  return (
    <ul className="factions">
      {content.taxonomy.factions.map((f) => (
        <li key={f.id}>
          <SubHead>{l(f.label)}</SubHead>
          {l(f.description) && <p className="small">{l(f.description)}</p>}
        </li>
      ))}
    </ul>
  )
}
