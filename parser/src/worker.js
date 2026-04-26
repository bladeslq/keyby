import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestWaWebVersion, downloadMediaMessage } from '@whiskeysockets/baileys'
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
    return res.data
  } catch (err) {
    console.error('[worker] webhook error:', err.response?.status, err.response?.data || err.message)
    return null
  }
}

const GROUP_CONTEXT_TTL_MS = 30 * 60 * 1000
const ORPHAN_PHOTO_TTL_MS = 5 * 60 * 1000

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
    // groupContexts: key = `${chatId}|${senderPhone}`
    // value = { propertyId: string|null, ts: number, orphanPhotos: [{ url, ts }] }
    this.groupContexts = new Map()
    this._qrAttempts = 0
    this._reconnectAttempts = 0
    this._photoCleanupInterval = setInterval(() => this._cleanupPhotoRequests(), 5 * 60 * 1000)
  }

  _cleanupPhotoRequests() {
    const dmCutoff = Date.now() - 24 * 60 * 60 * 1000
    for (const [phone, req] of this.pendingPhotoRequests) {
      if (req.ts < dmCutoff) this.pendingPhotoRequests.delete(phone)
    }
    const ctxCutoff = Date.now() - GROUP_CONTEXT_TTL_MS
    const orphanCutoff = Date.now() - ORPHAN_PHOTO_TTL_MS
    for (const [key, ctx] of this.groupContexts) {
      ctx.orphanPhotos = ctx.orphanPhotos.filter(p => p.ts >= orphanCutoff)
      if (ctx.ts < ctxCutoff && ctx.orphanPhotos.length === 0) {
        this.groupContexts.delete(key)
      }
    }
  }

  async _uploadPhoto(msg, senderPhone) {
    try {
      const buffer = await downloadMediaMessage(msg, 'buffer', {})
      const mimetype = msg.message?.imageMessage?.mimetype || 'image/jpeg'
      const ext = mimetype.split('/')[1]?.split(';')[0] || 'jpg'
      const filePath = `${senderPhone}/${Date.now()}_${msg.key.id}.${ext}`
      const supabase = createClient()
      const { error: upErr } = await supabase.storage
        .from('property-photos')
        .upload(filePath, buffer, { contentType: mimetype, upsert: false })
      if (upErr) {
        console.error(`[worker:${this.accountId}] photo upload error:`, upErr.message)
        return null
      }
      const { data } = supabase.storage.from('property-photos').getPublicUrl(filePath)
      return data.publicUrl
    } catch (err) {
      console.error(`[worker:${this.accountId}] photo download/upload failed:`, err.message)
      return null
    }
  }

  async start() {
    const t0 = Date.now()
    const { state, saveCreds } = await useMultiFileAuthState(this.sessionDir)
    console.log(`[worker:${this.accountId.slice(0, 8)}] auth loaded in ${Date.now() - t0}ms`)

    const tVer = Date.now()
    const { version } = await Promise.race([
      fetchLatestWaWebVersion(),
      new Promise(resolve => setTimeout(() => resolve({ version: [2, 3000, 1038149389] }), 5000)),
    ])
    console.log(`[worker:${this.accountId.slice(0, 8)}] version fetched in ${Date.now() - tVer}ms`)

    this.sock = makeWASocket({
      auth: state,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      version,
      connectTimeoutMs: 15000,
      defaultQueryTimeoutMs: 15000,
      keepAliveIntervalMs: 10000,
      ...(proxyAgent && { agent: proxyAgent, fetchAgent: proxyAgent }),
    })

    this.sock.ev.on('creds.update', saveCreds)

    this.sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update

      if (qr) {
        this._qrAttempts++
        if (this._qrAttempts > 3) {
          console.log(`[worker:${this.accountId}] QR not scanned after 3 attempts, stopping`)
          this._stopped = true
          this.sock?.end()
          const supabase = createClient()
          await supabase.from('wa_accounts').update({ status: 'disconnected' }).eq('id', this.accountId)
          return
        }
        const QRCode = (await import('qrcode')).default
        const qrDataUrl = await QRCode.toDataURL(qr)
        this.onQr?.(qrDataUrl)
      }

      if (connection === 'open') {
        this.phone = this.sock.user?.id?.split(':')[0] || null
        this._qrAttempts = 0
        this._reconnectAttempts = 0
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
        const supabase = createClient()

        if (isBanned) {
          await notifyWebApp({ type: 'account_status', accountId: this.accountId, status: 'banned' })
          await supabase.from('wa_accounts').update({ status: 'banned' }).eq('id', this.accountId)
          this.onDisconnected?.('banned')
        } else if (this._stopped) {
          await notifyWebApp({ type: 'account_status', accountId: this.accountId, status: 'disconnected' })
          await supabase.from('wa_accounts').update({ status: 'disconnected' }).eq('id', this.accountId)
          this.onDisconnected?.('disconnected')
        } else {
          this._reconnectAttempts++
          if (this._reconnectAttempts > 10) {
            console.error(`[worker:${this.accountId}] reconnect limit (10) reached, giving up`)
            this._stopped = true
            await supabase.from('wa_accounts').update({ status: 'disconnected' }).eq('id', this.accountId)
            this.onDisconnected?.('disconnected')
            return
          }
          const delayMs = Math.min(5000 * Math.pow(2, this._reconnectAttempts - 1), 5 * 60 * 1000)
          console.log(`[worker:${this.accountId}] reconnect attempt ${this._reconnectAttempts}/10 in ${delayMs}ms`)
          setTimeout(() => this.start(), delayMs)
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

  _getActiveTarget(groupKey) {
    const ctx = this.groupContexts.get(groupKey)
    if (!ctx || !ctx.propertyId) return null
    if (Date.now() - ctx.ts > GROUP_CONTEXT_TTL_MS) return null
    return ctx
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

    const imageMessage = msg.message?.imageMessage
    const hasMedia = imageMessage || msg.message?.documentMessage
    if (!isGroup && hasMedia && this.pendingPhotoRequests.has(senderPhone)) {
      await this._handlePhotoReply(msg, senderPhone)
      return
    }
    if (!isGroup) return

    const text = msg.message?.conversation
      || msg.message?.extendedTextMessage?.text
      || imageMessage?.caption

    const groupKey = `${chatId}|${senderPhone}`

    // Case A: pure photo, no caption — append to active context, or stash as orphan
    if (!text && imageMessage) {
      const url = await this._uploadPhoto(msg, senderPhone)
      if (!url) return

      const active = this._getActiveTarget(groupKey)
      if (active) {
        await notifyWebApp({ type: 'photos', propertyId: active.propertyId, photos: [url] })
        active.ts = Date.now()
        console.log(`[worker:${this.accountId}] photo attached to ${active.propertyId} (sender ${senderPhone})`)
      } else {
        const ctx = this.groupContexts.get(groupKey) || { propertyId: null, ts: 0, orphanPhotos: [] }
        ctx.orphanPhotos.push({ url, ts: Date.now() })
        this.groupContexts.set(groupKey, ctx)
        console.log(`[worker:${this.accountId}] orphan photo stashed for ${senderPhone} (no active listing yet)`)
      }
      return
    }

    if (!text) return

    console.log(`[worker:${this.accountId}] message from group, text: ${text.slice(0, 80)}`)

    const chatName = await this._getChatName(chatId)
    const parsed = await parseMessage(text)
    console.log(`[worker:${this.accountId}] parsed:`, parsed ? JSON.stringify(parsed).slice(0, 120) : 'null (not a property)')

    // Case B: text/caption that isn't a listing (e.g. "вот ещё 2 фото")
    //         — if there's an attached photo, attach it to the active listing
    if (!parsed) {
      if (imageMessage) {
        const url = await this._uploadPhoto(msg, senderPhone)
        if (!url) return
        const active = this._getActiveTarget(groupKey)
        if (active) {
          await notifyWebApp({ type: 'photos', propertyId: active.propertyId, photos: [url] })
          active.ts = Date.now()
          console.log(`[worker:${this.accountId}] caption-only photo attached to ${active.propertyId}`)
        } else {
          const ctx = this.groupContexts.get(groupKey) || { propertyId: null, ts: 0, orphanPhotos: [] }
          ctx.orphanPhotos.push({ url, ts: Date.now() })
          this.groupContexts.set(groupKey, ctx)
        }
      }
      return
    }

    // Case C: new listing parsed
    const dup = await isDuplicate(parsed)
    console.log(`[worker:${this.accountId}] duplicate:`, dup)
    if (dup) return

    console.log(`[worker:${this.accountId}] sending to webhook: ${parsed.title}`)
    const result = await notifyWebApp({ ...parsed, type: 'new_property', propertyType: parsed.type, chatId, chatName, account: this.phone, senderPhone, rawMessage: parsed.raw })
    const propertyId = result?.id
    if (!propertyId) {
      console.error(`[worker:${this.accountId}] webhook did not return id`)
      return
    }
    console.log(`[worker:${this.accountId}] new property id: ${propertyId}`)

    // Replace context: subsequent photos from this sender go to the NEW listing
    const prevCtx = this.groupContexts.get(groupKey)
    const orphanCutoff = Date.now() - ORPHAN_PHOTO_TTL_MS
    const orphanUrls = (prevCtx?.orphanPhotos || [])
      .filter(p => p.ts >= orphanCutoff)
      .map(p => p.url)
    this.groupContexts.set(groupKey, { propertyId, ts: Date.now(), orphanPhotos: [] })

    const photosToAttach = [...orphanUrls]
    if (imageMessage) {
      const url = await this._uploadPhoto(msg, senderPhone)
      if (url) photosToAttach.push(url)
    }
    if (photosToAttach.length) {
      await notifyWebApp({ type: 'photos', propertyId, photos: photosToAttach })
      console.log(`[worker:${this.accountId}] attached ${photosToAttach.length} photo(s) to ${propertyId} (orphans=${orphanUrls.length})`)
    }

    await supabase.rpc('increment_messages_parsed', { p_account_id: this.accountId })
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
    clearInterval(this._photoCleanupInterval)
    this.sock?.end()
  }
}
