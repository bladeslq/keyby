if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = require('crypto').webcrypto
}

require('dotenv').config()
const express = require('express')
const http = require('http')
const { WebSocketServer } = require('ws')
const path = require('path')
const crypto = require('crypto')
const { WhatsAppWorker } = require('./worker')
const { createClient } = require('./db')

const app = express()
app.use((req, res, next) => {
  const origin = req.headers.origin
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})
app.use(express.json())

const server = http.createServer(app)
const wss = new WebSocketServer({ server })

// accountId -> WhatsAppWorker
const workers = new Map()

// wsToken -> WebSocket (for QR streaming)
const qrSessions = new Map()

// ─── WebSocket: stream QR codes ──────────────────────────────────────────────
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost')
  const token = url.searchParams.get('token')
  if (token && qrSessions.has(token)) {
    qrSessions.set(token, ws)
    ws.on('close', () => qrSessions.delete(token))
  } else {
    ws.close()
  }
})

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ ok: true }))

// ─── REST: connect a new WA account ──────────────────────────────────────────
app.post('/wa/connect', async (req, res) => {
  try {
    const supabase = createClient()

    const { data: account, error } = await supabase
      .from('wa_accounts')
      .insert({ status: 'connecting' })
      .select()
      .single()

    if (error || !account) {
      console.error('[/wa/connect] supabase error:', error)
      return res.status(500).json({ error: error?.message || 'db error' })
    }

    const accountId = account.id
    const sessionDir = path.join(__dirname, '../sessions', accountId)
    const wsToken = crypto.randomUUID()

    qrSessions.set(wsToken, null)

    const worker = new WhatsAppWorker(
      accountId,
      sessionDir,
      (qrDataUrl) => {
        const ws = qrSessions.get(wsToken)
        if (ws?.readyState === 1) {
          ws.send(JSON.stringify({ type: 'qr', data: qrDataUrl }))
        }
      },
      (phone) => {
        const ws = qrSessions.get(wsToken)
        if (ws?.readyState === 1) {
          ws.send(JSON.stringify({ type: 'connected', phone }))
          ws.close()
        }
        qrSessions.delete(wsToken)
      },
      (status) => {
        if (status === 'banned') workers.delete(accountId)
      }
    )

    workers.set(accountId, worker)
    worker.start()

    res.json({ accountId, wsToken })
  } catch (err) {
    console.error('[/wa/connect] error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ─── REST: disconnect account ─────────────────────────────────────────────────
app.post('/wa/disconnect/:accountId', (req, res) => {
  const worker = workers.get(req.params.accountId)
  if (!worker) return res.status(404).json({ error: 'not found' })
  worker.stop()
  workers.delete(req.params.accountId)
  res.json({ success: true })
})

// ─── REST: list groups for an account ────────────────────────────────────────
app.get('/wa/groups/:accountId', async (req, res) => {
  const worker = workers.get(req.params.accountId)
  if (!worker) return res.status(404).json({ error: 'not found' })
  const groups = await worker.getGroups()
  res.json(groups)
})

// ─── Startup: reconnect all active accounts ───────────────────────────────────
async function init() {
  const supabase = createClient()
  const { data: accounts } = await supabase
    .from('wa_accounts')
    .select('*')
    .eq('status', 'active')

  for (const account of accounts || []) {
    const sessionDir = path.join(__dirname, '../sessions', account.id)
    const worker = new WhatsAppWorker(
      account.id,
      sessionDir,
      null, null,
      (status) => { if (status === 'banned') workers.delete(account.id) }
    )
    workers.set(account.id, worker)
    worker.start()
    console.log(`[init] starting worker for ${account.phone || account.id}`)
  }
}

const PORT = process.env.PORT || 4000
server.listen(PORT, async () => {
  console.log(`Parser service running on :${PORT}`)
  await init()
})
