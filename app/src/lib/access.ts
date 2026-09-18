import { content } from './content'

/** Remembers the hash that was unlocked, so changing the password in site.yaml asks everyone again. */
const KEY = 'universalis.access'

/** Whether the password gate (site.yaml → access) still has to be passed on this device. */
export function accessRequired(): boolean {
  const { enabled, passwordHash } = content.site.access
  if (!enabled) return false
  try {
    return localStorage.getItem(KEY) !== passwordHash
  } catch {
    return true
  }
}

/** SHA-256 → hex. `crypto.subtle` needs a secure context: HTTPS or localhost. */
async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function tryPassword(password: string): Promise<boolean> {
  const { passwordHash } = content.site.access
  if ((await sha256(password.trim())) !== passwordHash) return false
  try {
    localStorage.setItem(KEY, passwordHash!)
  } catch {
    /* storage unavailable: asked again next visit */
  }
  return true
}
