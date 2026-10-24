import { Server } from '@hocuspocus/server'
import { SQLite } from '@hocuspocus/extension-sqlite'
import crypto from 'node:crypto'

const port = Number(process.env.PORT || 1234)
const secret = process.env.JWT_KEY || ''
const issuer = process.env.JWT_ISSUER || 'JournalBackend'
if (secret.length < 32) throw new Error('JWT_KEY must contain at least 32 characters')

function decodePart(value) {
  return JSON.parse(Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4), 'base64url').toString('utf8'))
}
function verifyHs256(token) {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Invalid token')
  const [head, payload, signature] = parts
  const expected = crypto.createHmac('sha256', secret).update(`${head}.${payload}`).digest('base64url')
  const expectedBuf = Buffer.from(expected); const actualBuf = Buffer.from(signature)
  if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) throw new Error('Invalid signature')
  const h = decodePart(head), p = decodePart(payload)
  const now = Math.floor(Date.now() / 1000)
  if (h.alg !== 'HS256' || p.iss !== issuer || p.aud !== 'JournalCollab' || !p.exp || p.exp < now || (p.nbf && p.nbf > now + 5) || !p.sub || !p.collab_room) throw new Error('Invalid claims')
  return p
}

const server = new Server({
  port,
  extensions: [new SQLite({ database: process.env.SQLITE_PATH || '/data/collab.sqlite' })],
  maxUnauthenticatedQueueSize: 1024 * 1024,
  maxUnauthenticatedQueueMessages: 250,
  async onAuthenticate({ token, documentName }) {
    if (!token) throw new Error('Authentication required')
    const claims = verifyHs256(token)
    if (claims.collab_room !== documentName) throw new Error('Document access denied')
  },
})
server.listen()
console.log(`[collab] Hocuspocus listening on :${port}`)
