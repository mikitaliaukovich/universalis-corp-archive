// Prints the value for `access.passwordHash` in content/site.yaml.
// Usage: npm run hash-password -- "new password"
import { createHash } from 'node:crypto'

const password = process.argv.slice(2).join(' ').trim()
if (!password) {
  console.error('Usage: npm run hash-password -- "new password"')
  process.exit(1)
}
console.log(`passwordHash: "${createHash('sha256').update(password).digest('hex')}"`)
