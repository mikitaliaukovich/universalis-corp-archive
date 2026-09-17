import { useId } from 'react'
import { useSettings } from '../../lib/settings'

/** Placeholder "no photo on file" card. */
export function Silhouette({ label, compact = false }: { label?: string; compact?: boolean }) {
  const { t } = useSettings()
  const id = useId()
  return (
    <div className={`silhouette ${compact ? 'silhouette--compact' : ''}`}>
      <svg viewBox="0 0 100 120" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
        <defs>
          <pattern id={id} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="5" stroke="currentColor" strokeWidth="1.4" />
          </pattern>
        </defs>
        <circle cx="50" cy="44" r="21" fill={`url(#${id})`} />
        <path d="M10 120c0-27 18-46 40-46s40 19 40 46z" fill={`url(#${id})`} />
      </svg>
      {!compact && <span>{label ?? t('personnel.noPhoto')}</span>}
    </div>
  )
}
