import { useEffect, useState } from 'react'

/** Phone layout; matches the `max-width: 760px` breakpoint in pages.css. */
export const MOBILE_QUERY = '(max-width: 760px)'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(query).matches)
  useEffect(() => {
    const mq = matchMedia(query)
    const onChange = () => setMatches(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return matches
}
