const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys')
const { Boom } = require('@hapi/boom')
const pino = require('pino')
const axios = require('axios')
const path = require('path')
const { parseMessage } = require('./parser')
const { isDuplicate } = require('./dedup')
const { createClient } = require('./db')

const WEBHOOK_URL = process.env.WEB_APP_URL + '/api/whatsapp/webhook'
const PARSER_SECRET = process.env.PARSER_SECRET

async function notifyWebApp(payload) {
  try {
    await axios.post(WEBHOOK_URL, payload, {
      headers: { 'x-parser-secret': PARSER_SECRET },
      timeout: 10000,
    })
  } catch (err) {
    console.error('[worker] webhook error:', err.message)
  }
}

class WhatsAppWorker {
  constructor(accountId, sessionDir, onQr, onConnected, onDisconnected) {
    this.accountId = accountId
    this.sessionDir = sessionDir
    this.onQr = onQr
    this.onConnected = onConnected
    this.onDisconnected = onDisconnected
    this.sock = null
    this.phone = null
    // Track sender->property mapping for photo replies
    this.pendingPhotoRequests = new Map()
  }

  async start() {
    const { state, saveCreds } = await useMultiFileAuthState(this.sessionDir)
    const { version } = await fetchLatestBaileysVersion()

    this.sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
    })

    this.sock.ev.on('creds.update', saveCreds)

    this.sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update

      if (qr) {
        const QRCode = require('qrcode')
        const qrDataUrl = await QRCode.toDataURL(qr)
        this.onQr?.(qrDataUrl)
      }

      if (connection === 'open') {
        this.phone = this.sock.user?.id?.split(':')[0] || null
        console.log(`[worker:${this.accountId}] connected as ${this.phone}`)

        await notifyWebApp({ type: 'account_status', accountId: this.accountId, status: 'active' })

        const supabase = createClient()
        await supabase
          .from('wa_accounts')
          .update({ status: 'active', phone: this.phone, last_seen: new Date().toISOString() })
          .eq('id', this.accountId)

        this.onConnected?.(this.phone)
      }

      if (connection === 'close') {
        const code = (lastDisconnect?.error instanceof Boom)
          ? lastDisconnect.error.output?.statusCode
          : null

        const isBanned = code === DisconnectReason.loggedOut
        const status = isBanned ? 'banned' : 'disconnected'

        await notifyWebApp({ type: 'account_status', accountId: this.accountId, status })

        const supabase = createClient()
        await supabase.from('wa_accounts').update({ status }).eq('id', this.accountId)

        this.onDisconnected?.(status)

        // Reconnect unless banned or explicitly stopped
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

    // Check if chat is enabled for parsing
    const supabase = createClient()
    if (isGroup) {
      const { data: chat } = await supabase
        .from('wa_chats')
        .select('enabled')
        .eq('account_id', this.accountId)
        .eq('chat_jid', chatId)
        .single()

      if (!chat?.enabled) return
    }

    // Handle photo replies from pending requests
    const hasMedia = msg.message?.imageMessage || msg.message?.documentMessage
    if (!isGroup && hasMedia && this.pendingPhotoRequests.has(senderPhone)) {
      await this._handlePhotoReply(msg, senderPhone)
      return
    }

    // Handle text in group chats
    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text
    if (!text || !isGroup) return

    const chatName = await this._getChatName(chatId)

    const parsed = await parseMessage(text)
    if (!parsed) return

    // Deduplication check
    const dup = await isDuplicate(parsed)
    if (dup) {
      console.log(`[worker:${this.accountId}] duplicate skipped`)
      return
    }

    console.log(`[worker:${this.accountId}] new property from ${chatName}: ${parsed.title}`)

    // Save to DB via webhook
    await notifyWebApp({
      type: 'new_property',
      ...parsed,
      propertyType: parsed.type,
      chatId,
      chatName,
      account: this.phone,
      senderPhone,
      rawMessage: parsed.raw,
    })

    // Update chat stats
    await supabase.rpc('increment_chat_messages', { p_account_id: this.accountId, p_chat_jid: chatId })

    // Update account stats
    await supabase
      .from('wa_accounts')
      .update({ messages_parsed: supabase.rpc('get_parsed_count', {}), last_seen: new Date().toISOString() })
      .eq('id', this.accountId)

    // Request photos from sender (private message)
    if (senderPhone) {
      await this._requestPhotos(senderPhone, parsed.title)
    }
  }

  async _handlePhotoReply(msg, senderPhone) {
    // In a real implementation, download the media from Baileys
    // and upload to Supabase Storage, then call the webhook
    console.log(`[worker:${this.accountId}] received photo from ${senderPhone}`)
    // TODO: download + upload media, then:
    // await notifyWebApp({ type: 'photos', senderPhone, photos: [publicUrl] })
  }

  async _requestPhotos(senderPhone, propertyTitle) {
    try {
      const jid = senderPhone + '@s.whatsapp.net'
      await this.sock.sendMessage(jid, {
        text: `Здравствуйте! Вы недавно разместили объект "${propertyTitle}" в чате. Мы агрегируем объявления для удобного поиска — не могли бы вы прислать фотографии? Это займёт минуту и поможет вашему объекту найти арендатора быстрее 🙏`,
      })
      this.pendingPhotoRequests.set(senderPhone, { title: propertyTitle, ts: Date.now() })
      console.log(`[worker:${this.accountId}] photo request sent to ${senderPhone}`)
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

module.exports = { WhatsAppWorker }
