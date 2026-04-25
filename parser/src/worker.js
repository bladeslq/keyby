import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestWaWebVersion } from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import pino from 'pino'
import axios from 'axios'
import path from 'path'
import { fileURLToPath } from 'url'
import { SocksProxyAgent } from 'socks-proxy-agent'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { parseMessage } from './parser.js'
import { isDuplicate } from './dedup.js'
import { createClient } from './db.js'

function createProxyAgent(url) {
  if (!url) return undefined
  if (url.startsWith('socks')) return new SocksProxyAgent(url)
  return new HttpsProxyAgent(url)
}

const proxyAgent = createProxyAgent(process.env.PROXY_URL)

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const WEBHOOK_URL = process.env.WEB_APP_URL + '/api/whatsapp/webhook'
const PARSER_SECRET = process.env.PARSER_SECRET

async function notifyWebApp(payload) {
  try {
    const res = await axios.post(WEBHOOK_URL, payload, {
      headers: { 'x-parser-secret': PARSER_SECRET },
      timeout: 10000,
    })
    console.log('[worker] webhook response:', res.status, JSON.stringify(res.data).slice(0, 100))
  } catch (err) {
    console.error('[worker] webhook error:', err.response?.status, err.response?.data || err.message)
  }
}

export class WhatsAppWorker {
  constructor(accountId, sessionDir, onQr, onConnected, onDisconnected) {
    this.accountId = accountId
    this.sessionDir = sessionDir
    this.onQr = onQr
    this.onConnected = onConnected
    this.onDisconnected = onDisconnected
    this.sock = null
    this.phone = null
    this.pendingPhotoRequests = new Map()
  }

  async start() {
    const { state, saveCreds } = await useMultiFileAuthState(this.sessionDir)
    const { version } = await fetchLatestWaWebVersion()

    this.sock = makeWASocket({
      auth: state,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      version,
      ...(proxyAgent && { agent: proxyAgent, fetchAgent: proxyAgent }),
    })

    this.sock.ev.on('creds.update', saveCreds)

    this.sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update

      if (qr) {
        const QRCode = (await import('qrcode')).default
        const qrDataUrl = await QRCode.toDataURL(qr)
        this.onQr?.(qrDataUrl)
      }

      if (connection === 'open') {
        this.phone = this.sock.user?.id?.split(':')[0] || null
        console.log(`[worker:${this.accountId}] connected as ${this.phone}`)
        await notifyWebApp({ type: 'account_status', accountId: this.accountId, status: 'active' })
        const supabase = createClient()
        await supabase.from('wa_accounts').update({ status: 'active', phone: this.phone, last_seen: new Date().toISOString() }).eq('id', this.accountId)
        this.onConnected?.(this.phone)
      }

      if (connection === 'close') {
        const code = (lastDisconnect?.error instanceof Boom) ? lastDisconnect.error.output?.statusCode : null
        console.error(`[worker:${this.accountId}] disconnected code=${code} reason=${lastDisconnect?.error?.message || 'unknown'}`)

        const isBanned = code === DisconnectReason.loggedOut
        const status = isBanned ? 'banned' : 'disconnected'

        await notifyWebApp({ type: 'account_status', accountId: this.accountId, status })
        const supabase = createClient()
        await supabase.from('wa_accounts').update({ status }).eq('id', this.accountId)
        this.onDisconnected?.(status)

        if (!isBanned && !this._stopped) {
          console.log(`[worker:${this.accountId}] reconnecting in 5s...`)
          setTimeout(() => this.start(), 5000)
        }
      }
    })

    this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return
      for (const msg of messages) {
        if (msg.key.fromMe) continue
        await this._handleMessage(msg)
      }
    })
  }

  async _handleMessage(msg) {
    const chatId = msg.key.remoteJid
    const isGroup = chatId?.endsWith('@g.us')
    const senderPhone = msg.key.participant?.split('@')[0] || chatId?.split('@')[0]

    const supabase = createClient()

    if (isGroup) {
      const { data: chat } = await supabase.from('wa_chats').select('enabled').eq('account_id', this.accountId).eq('chat_jid', chatId).single()
      if (chat && chat.enabled === false) return
    }

    const hasMedia = msg.message?.imageMessage || msg.message?.documentMessage
    if (!isGroup && hasMedia && this.pendingPhotoRequests.has(senderPhone)) {
      await this._handlePhotoReply(msg, senderPhone)
      return
    }

    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text
    if (!text || !isGroup) return

    console.log(`[worker:${this.accountId}] message from group, text: ${text.slice(0, 80)}`)

    const chatName = await this._getChatName(chatId)
    const parsed = await parseMessage(text)
    console.log(`[worker:${this.accountId}] parsed:`, parsed ? JSON.stringify(parsed).slice(0, 120) : 'null (not a property)')
    if (!parsed) return

    const dup = await isDuplicate(parsed)
    console.log(`[worker:${this.accountId}] duplicate:`, dup)
    if (dup) return

    console.log(`[worker:${this.accountId}] sending to webhook: ${parsed.title}`)

    const webhookRes = await notifyWebApp({ ...parsed, type: 'new_property', propertyType: parsed.type, chatId, chatName, account: this.phone, senderPhone, rawMessage: parsed.raw })
    console.log(`[worker:${this.accountId}] webhook done`)
  }

  async _handlePhotoReply(msg, senderPhone) {
    console.log(`[worker:${this.accountId}] received photo from ${senderPhone}`)
  }

  async _requestPhotos(senderPhone, propertyTitle) {
    try {
      const jid = senderPhone + '@s.whatsapp.net'
      await this.sock.sendMessage(jid, { text: `Здравствуйте! Вы недавно разместили объект "${propertyTitle}" в чате. Мы агрегируем объявления для удобного поиска — не могли бы вы прислать фотографии? Это займёт минуту и поможет вашему объекту найти арендатора быстрее 🙏` })
      this.pendingPhotoRequests.set(senderPhone, { title: propertyTitle, ts: Date.now() })
    } catch (err) {
      console.error(`[worker:${this.accountId}] failed to send photo request:`, err.message)
    }
  }

  async _getChatName(chatId) {
    try {
      const meta = await this.sock.groupMetadata(chatId)
      return meta.subject
    } catch {
      return chatId
    }
  }

  async getGroups() {
    try {
      const groups = await this.sock.groupFetchAllParticipating()
      return Object.values(groups).map((g) => ({ jid: g.id, name: g.subject }))
    } catch {
      return []
    }
  }

  stop() {
    this._stopped = true
    this.sock?.end()
  }
}
