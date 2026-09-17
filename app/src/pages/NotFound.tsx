import { Link } from 'react-router'
import { useSettings } from '../lib/settings'
import { Panel } from '../components/ui/Panel'
import { Stamp } from '../components/ui/Stamp'

export function NotFound() {
  const { t } = useSettings()
  return (
    <div className="layout1">
      <Panel title={t('notFound.title')} code="404">
        <div className="notfound">
          <Stamp text={t('notFound.stamp')} />
          <p>{t('notFound.body')}</p>
          <Link to="/" className="key-btn">
            <kbd>ESC</kbd> {t('nav.home')}
          </Link>
        </div>
      </Panel>
    </div>
  )
}
