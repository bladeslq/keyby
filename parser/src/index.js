import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import path from 'path'
import { fileURLToPath } from 'url'
import crypto from 'crypto'
import { WhatsAppWorker } from './worker.js'
import { createClient } from './db.js'

// Force line-buffered stdout/stderr for real-time Railway logs
if (process.stdout._handle?.setBlocking) process.stdout._handle.setBlocking(true)
if (process.stderr._handle?.setBlocking) process.stderr._handle.setBlocking(true)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SESSIONS_DIR = process.env.SESSIONS_DIR || path.join(__dirname, '../sessions')
console.log(`[startup] sessions dir: ${SESSIONS_DIR}`)

const app = express()
app.use((req, res, next) => {
  const origin = req.headers.origin
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})
app.use(express.json())

const server = createServer(app)
const wss = new WebSocketServer({ server })

const workers = new Map()
// qrSessions: token -> { ws, lastQr, lastConnected, createdAt }
const qrSessions = new Map()

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost')
  const token = url.searchParams.get('token')
  const session = qrSessions.get(token)
  if (!session) { ws.close(); return }

  session.ws = ws
  console.log(`[ws] frontend connected for token=${token.slice(0, 8)}, buffered: qr=${!!session.lastQr} connected=${!!session.lastConnected}`)

  // Send any buffered messages immediately
  if (session.lastQr) ws.send(JSON.stringify({ type: 'qr', data: session.lastQr }))
  if (session.lastConnected) {
    ws.send(JSON.stringify({ type: 'connected', phone: session.lastConnected }))
    ws.close()
  }

  ws.on('close', () => qrSessions.delete(token))
})

app.get('/health', (req, res) => res.json({ ok: true }))

app.post('/wa/connect', async (req, res) => {
  const t0 = Date.now()
  try {
    const supabase = createClient()
    let accountId = req.body?.accountId

    if (accountId) {
      await supabase.from('wa_accounts').update({ status: 'connecting' }).eq('id', accountId)
      workers.get(accountId)?.stop()
      workers.delete(accountId)
    } else {
      const { data: account, error } = await supabase.from('wa_accounts').insert({ status: 'connecting' }).select().single()
      if (error || !account) {
        console.error('[/wa/connect] supabase error:', error)
        return res.status(500).json({ error: error?.message || 'db error' })
      }
      accountId = account.id
    }
    const sessionDir = path.join(SESSIONS_DIR, accountId)
    const wsToken = crypto.randomUUID()

    const session = { ws: null, lastQr: null, lastConnected: null, createdAt: Date.now() }
    qrSessions.set(wsToken, session)

    const worker = new WhatsAppWorker(
      accountId, sessionDir,
      (qrDataUrl) => {
        const dt = Date.now() - session.createdAt
        console.log(`[qr] generated for token=${wsToken.slice(0, 8)} after ${dt}ms, ws=${session.ws?.readyState === 1 ? 'ready' : 'not-ready'}`)
        session.lastQr = qrDataUrl
        if (session.ws?.readyState === 1) {
          session.ws.send(JSON.stringify({ type: 'qr', data: qrDataUrl }))
        }
      },
      (phone) => {
        session.lastConnected = phone
        if (session.ws?.readyState === 1) {
          session.ws.send(JSON.stringify({ type: 'connected', phone }))
          session.ws.close()
        }
        qrSessions.delete(wsToken)
      },
      (status) => { if (status === 'banned') workers.delete(accountId) }
    )

    workers.set(accountId, worker)
    console.log(`[/wa/connect] account=${accountId} setup took ${Date.now() - t0}ms, starting worker`)
    worker.start().catch(err => console.error(`[/wa/connect] worker.start failed:`, err.message))
    res.json({ accountId, wsToken })
  } catch (err) {
    console.error('[/wa/connect] error:', err)
    res.status(500).json({ error: err.message })
  }
})

app.post('/wa/disconnect/:accountId', async (req, res) => {
  const { accountId } = req.params
  const worker = workers.get(accountId)
  worker?.stop()
  workers.delete(accountId)
  const supabase = createClient()
  await supabase.from('wa_accounts').update({ status: 'disconnected' }).eq('id', accountId)
  res.json({ success: true })
})

app.delete('/wa/account/:accountId', async (req, res) => {
  const { accountId } = req.params
  workers.get(accountId)?.stop()
  workers.delete(accountId)
  const supabase = createClient()
  await supabase.from('wa_accounts').delete().eq('id', accountId)
  res.json({ success: true })
})

app.get('/wa/groups/:accountId', async (req, res) => {
  const worker = workers.get(req.params.accountId)
  if (!worker) return res.status(404).json({ error: 'not found' })
  const groups = await worker.getGroups()
  res.json(groups)
})

async function init() {
  const supabase = createClient()
  const fs = await import('fs')
  if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true })

  const { data: accounts } = await supabase.from('wa_accounts').select('*').in('status', ['active', 'disconnected'])
  for (const account of accounts || []) {
    const sessionDir = path.join(SESSIONS_DIR, account.id)
    if (!fs.existsSync(sessionDir)) {
      console.log(`[init] no session for ${account.phone || account.id}, skipping`)
      continue
    }
    const worker = new WhatsAppWorker(account.id, sessionDir, null, null, (status) => { if (status === 'banned') workers.delete(account.id) })
    workers.set(account.id, worker)
    worker.start()
    console.log(`[init] starting worker for ${account.phone || account.id}`)
  }
}

const PORT = process.env.PORT || 4000
server.listen(PORT, async () => {
  console.log(`Parser service running on :${PORT}`)
  await init()
  setInterval(() => {
    fetch(`http://localhost:${PORT}/health`).catch(() => {})
  }, 4 * 60 * 1000)
})
