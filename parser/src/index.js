import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import path from 'path'
import { fileURLToPath } from 'url'
import crypto from 'crypto'
import { WhatsAppWorker } from './worker.js'
import { createClient } from './db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

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
const qrSessions = new Map()

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

app.get('/health', (req, res) => res.json({ ok: true }))

app.post('/wa/connect', async (req, res) => {
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
    const sessionDir = path.join(__dirname, '../sessions', accountId)
    const wsToken = crypto.randomUUID()

    qrSessions.set(wsToken, null)

    const worker = new WhatsAppWorker(
      accountId, sessionDir,
      (qrDataUrl) => {
        const ws = qrSessions.get(wsToken)
        if (ws?.readyState === 1) ws.send(JSON.stringify({ type: 'qr', data: qrDataUrl }))
      },
      (phone) => {
        const ws = qrSessions.get(wsToken)
        if (ws?.readyState === 1) { ws.send(JSON.stringify({ type: 'connected', phone })); ws.close() }
        qrSessions.delete(wsToken)
      },
      (status) => { if (status === 'banned') workers.delete(accountId) }
    )

    workers.set(accountId, worker)
    worker.start()
    res.json({ accountId, wsToken })
  } catch (err) {
    console.error('[/wa/connect] error:', err)
    res.status(500).json({ error: err.message })
  }
})

app.post('/wa/disconnect/:accountId', (req, res) => {
  const worker = workers.get(req.params.accountId)
  worker?.stop()
  workers.delete(req.params.accountId)
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
  const { data: accounts } = await supabase.from('wa_accounts').select('*').eq('status', 'active')
  for (const account of accounts || []) {
    const sessionDir = path.join(__dirname, '../sessions', account.id)
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
})
