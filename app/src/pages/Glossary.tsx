import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { motion } from 'motion/react'
import { appearancesOf, content, type Site, type Term } from '../lib/content'
import { useLocked, useSettings } from '../lib/settings'
import { hrefFor } from '../lib/routes'
import { Markdown } from '../lib/markdown'
import { Panel } from '../components/ui/Panel'
import { ListMenu } from '../components/ui/ListMenu'
import { PhotoPrint } from '../components/ui/PhotoPrint'
import { TypewriterText } from '../components/ui/TypewriterText'
import { Backlinks, ChapterRef, EntityList, EntityName, FactTable, LockedNotice, SubHead } from '../components/ui/EntityBits'
import { NotFound } from './NotFound'

type Section = Site['sections'][number]

export function Glossary({ section, id }: { section: Section; id?: string }) {
  const { l, t, settings } = useSettings()
  const locked = useLocked()
  const [params, setParams] = useSearchParams()
  const category = params.get('cat') ?? ''
  const [filter, setFilter] = useState('')
  const term = id ? content.terms.find((x) => x.id === id) : undefined

  const collator = useMemo(() => new Intl.Collator(settings.lang), [settings.lang])
  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return content.terms
      .filter((x) => !category || x.category === category)
      .filter((x) => {
        if (!q) return true
        if (locked(x)) return false
        const aliases = (x.aliases[settings.lang] ?? []).join(' ')
        return `${l(x.name)} ${aliases}`.toLowerCase().includes(q)
      })
      .sort((a, b) => collator.compare(l(a.name), l(b.name)))
  }, [category, filter, locked, l, settings.lang, collator])

  if (id && !term) return <NotFound />

  const qs = category ? `?cat=${category}` : ''
  const items = visible.map((x) => ({
    id: x.id,
    href: `/${section.path}/${x.id}${qs}`,
    label: locked(x) ? <span className="redacted redacted--static">{l(x.name)}</span> : l(x.name),
    suffix: content.taxonomy.glossaryCategories.find((c) => c.id === x.category)?.code,
    locked: locked(x),
  }))

  const setCategory = (c: string) => {
    const next = new URLSearchParams(params)
    if (c) next.set('cat', c)
    else next.delete('cat')
    setParams(next, { replace: true })
  }

  return (
    <div className={`layout3 ${term ? 'has-selection' : ''}`}>
      <Panel title={l(section.label)} code={section.code} className="layout3__left">
        <label className="prompt prompt--sm">
          <span className="prompt__sign">&gt;</span>
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t('glossary.filter')} aria-label={t('glossary.filter')} spellCheck={false} />
        </label>
        <div className="tabs" role="tablist">
          <button type="button" role="tab" aria-selected={!category} className="tab" onClick={() => setCategory('')}>
            {t('glossary.all')}
          </button>
          {content.taxonomy.glossaryCategories.map((c) => (
            <button key={c.id} type="button" role="tab" aria-selected={category === c.id} className="tab" onClick={() => setCategory(c.id)} title={l(c.label)}>
              {c.code || l(c.label)}
            </button>
          ))}
        </div>
        {category && <p className="muted small">{l(content.taxonomy.glossaryCategories.find((c) => c.id === category)?.label)}</p>}
        <ListMenu items={items} activeId={term?.id} primary empty={t('glossary.nothing')} />
      </Panel>

      <Panel
        key={term?.id ?? 'index'}
        title={term ? t('glossary.card') : t('glossary.index')}
        code={term ? content.taxonomy.glossaryCategories.find((c) => c.id === term.category)?.code : 'A–Я'}
        className="layout3__center"
      >
        {term ? locked(term) ? <LockedNotice entity={term} /> : <TermCard key={term.id} term={term} /> : <AlphaIndex terms={visible} />}
      </Panel>

      <Panel title={t('glossary.crossrefs')} code="X-REF" className="layout3__right">
        {term && !locked(term) ? (
          <>
            {term.images.length > 0 && (
              <PhotoPrint images={term.images} stack />
            )}
            <SubHead code="REL">{t('glossary.related')}</SubHead>
            <EntityList ids={term.related} note={(e) => t(`kind.${e.kind}`)} />
            <SubHead code="CH">{t('glossary.chapters')}</SubHead>
            <EntityList ids={appearancesOf(content, term.id).map((c) => c.id)} note={(c) => l(c.summary).slice(0, 80) + '…'} />
            <SubHead code="←">{t('common.mentionedIn')}</SubHead>
            <Backlinks id={term.id} />
          </>
        ) : (
          <CategoryStats />
        )}
      </Panel>
    </div>
  )
}

function TermCard({ term }: { term: Term }) {
  const { l, t, settings } = useSettings()
  const cat = content.taxonomy.glossaryCategories.find((c) => c.id === term.category)
  const aliases = term.aliases[settings.lang] ?? []
  return (
    <motion.article
      className="indexcard"
      initial={{ rotateX: -70, opacity: 0, transformPerspective: 900 }}
      animate={{ rotateX: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 22 }}
    >
      <header className="indexcard__head">
        <span className="indexcard__cat">
          {cat?.code} · {l(cat?.label)}
        </span>
        <span className="indexcard__no">№ {term.id.toUpperCase().slice(0, 18)}</span>
      </header>
      <h1 className="indexcard__title">
        <TypewriterText key={settings.lang} text={l(term.name)} speed={30} />
      </h1>
      {aliases.length > 0 && <p className="indexcard__aliases">{aliases.join(' · ')}</p>}
      {l(term.summary) && <p className="lead">{l(term.summary)}</p>}
      <div className="typed">
        <Markdown>{term.body[settings.lang] ?? ''}</Markdown>
      </div>
      <FactTable rows={[[t('glossary.firstMention'), term.firstChapter ? <ChapterRef n={term.firstChapter} /> : t('common.none')]]} />
    </motion.article>
  )
}

function AlphaIndex({ terms }: { terms: Term[] }) {
  const { l } = useSettings()
  const groups = new Map<string, Term[]>()
  for (const x of terms) {
    const letter = l(x.name).replace(/^[«"“(]/, '').charAt(0).toUpperCase()
    if (!groups.has(letter)) groups.set(letter, [])
    groups.get(letter)!.push(x)
  }
  return (
    <div className="alpha">
      {[...groups].map(([letter, list]) => (
        <section key={letter} className="alpha__group">
          <h3 className="alpha__letter">{letter}</h3>
          <ul>
            {list.map((x) => (
              <li key={x.id}>
                <Link to={hrefFor(x)} className="alpha__item">
                  <strong>
                    <EntityName entity={x} />
                  </strong>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function CategoryStats() {
  const { l } = useSettings()
  return (
    <ul className="catstats">
      {content.taxonomy.glossaryCategories.map((c) => {
        const n = content.terms.filter((x) => x.category === c.id).length
        return (
          <li key={c.id}>
            <Link to={`?cat=${c.id}`} className="catstats__item">
              <span className="catstats__code">{c.code}</span>
              <span className="catstats__label">{l(c.label)}</span>
              <span className="catstats__n">{String(n).padStart(2, '0')}</span>
              <span className="catstats__bar" style={{ width: `${(n / Math.max(1, content.terms.length)) * 100}%` }} />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
