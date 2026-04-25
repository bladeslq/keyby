'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { WaAccount, WaAccountStatus, WaChat } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Plus, RefreshCw, WifiOff, Loader2, CheckCircle2, XCircle, MessageSquare, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

const statusColor: Record<WaAccountStatus, string> = {
  active: 'bg-green-100 text-green-800 border-green-200',
  connecting: 'bg-blue-100 text-blue-800 border-blue-200',
  disconnected: 'bg-gray-100 text-gray-700 border-gray-200',
  banned: 'bg-red-100 text-red-800 border-red-200',
}

const statusLabel: Record<WaAccountStatus, string> = {
  active: 'Активен',
  connecting: 'Подключается...',
  disconnected: 'Отключён',
  banned: 'Забанен',
}

interface WaGroup {
  jid: string
  name: string
}

export default function WhatsAppPage() {
  const [accounts, setAccounts] = useState<WaAccount[]>([])
  const [qrDialog, setQrDialog] = useState(false)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [parserOnline, setParserOnline] = useState<boolean | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  // Groups dialog
  const [groupsAccount, setGroupsAccount] = useState<WaAccount | null>(null)
  const [groups, setGroups] = useState<WaGroup[]>([])
  const [chats, setChats] = useState<WaChat[]>([])
  const [groupsLoading, setGroupsLoading] = useState(false)

  async function load() {
    const supabase = createClient()
    const { data } = await supabase
      .from('wa_accounts')
      .select('*')
      .order('created_at', { ascending: false })
    setAccounts((data as WaAccount[]) || [])
  }

  async function checkParser() {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_PARSER_URL}/health`, { signal: AbortSignal.timeout(4000) })
      setParserOnline(res.ok)
    } catch {
      setParserOnline(false)
    }
  }

  useEffect(() => {
    load()
    checkParser()

    const supabase = createClient()
    const channel = supabase
      .channel('wa_accounts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wa_accounts' }, load)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  async function handleDeleteAccount(id: string) {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_PARSER_URL}/wa/account/${id}`, { method: 'DELETE' })
      toast.success('Аккаунт удалён')
      load()
    } catch {
      toast.error('Ошибка')
    }
  }

  async function handleAddAccount(existingId?: string) {
    setQrDialog(true)
    setQrCode(null)
    setConnecting(true)

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_PARSER_URL}/wa/connect`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: existingId ? JSON.stringify({ accountId: existingId }) : undefined,
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Ошибка ${res.status}`)
      const { wsToken } = data

      const ws = new WebSocket(
        `${process.env.NEXT_PUBLIC_PARSER_WS_URL}/wa/qr?token=${wsToken}`
      )
      wsRef.current = ws

      const timeout = setTimeout(() => {
        ws.close()
        toast.error('WhatsApp не ответил — попробуйте ещё раз')
        setQrDialog(false)
        setConnecting(false)
      }, 60000)

      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data)
        if (msg.type === 'qr') {
          clearTimeout(timeout)
          setQrCode(msg.data)
          setConnecting(false)
        }
        if (msg.type === 'connected') {
          clearTimeout(timeout)
          toast.success('WhatsApp аккаунт подключён!')
          setQrDialog(false)
          load()
        }
      }
      ws.onerror = () => {
        clearTimeout(timeout)
        toast.error('Ошибка подключения к парсеру')
        setQrDialog(false)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Парсер недоступен')
      setQrDialog(false)
      setConnecting(false)
    }
  }

  function closeQrDialog() {
    wsRef.current?.close()
    setQrDialog(false)
    setQrCode(null)
  }

  async function handleDisconnect(id: string) {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_PARSER_URL}/wa/disconnect/${id}`, { method: 'POST' })
      toast.success('Аккаунт отключён')
      load()
    } catch {
      toast.error('Ошибка')
    }
  }

  async function openGroups(account: WaAccount) {
    setGroupsAccount(account)
    setGroups([])
    setGroupsLoading(true)

    const supabase = createClient()
    const [groupsRes, { data: chatsData }] = await Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_PARSER_URL}/wa/groups/${account.id}`).then(r => r.json()).catch(() => []),
      supabase.from('wa_chats').select('*').eq('account_id', account.id),
    ])

    setGroups(Array.isArray(groupsRes) ? groupsRes : [])
    setChats((chatsData as WaChat[]) || [])
    setGroupsLoading(false)
  }

  async function toggleChat(jid: string, name: string, currentEnabled: boolean | undefined) {
    if (!groupsAccount) return
    const supabase = createClient()
    const existing = chats.find(c => c.chat_jid === jid)

    if (!existing) {
      // Создаём запись с enabled=false (выключаем)
      const { data } = await supabase.from('wa_chats').insert({
        account_id: groupsAccount.id,
        chat_jid: jid,
        chat_name: name,
        enabled: false,
      }).select().single()
      if (data) setChats(prev => [...prev, data as WaChat])
    } else {
      const newEnabled = !existing.enabled
      await supabase.from('wa_chats').update({ enabled: newEnabled }).eq('id', existing.id)
      setChats(prev => prev.map(c => c.id === existing.id ? { ...c, enabled: newEnabled } : c))
    }
  }

  function isEnabled(jid: string): boolean {
    const chat = chats.find(c => c.chat_jid === jid)
    if (!chat) return true // нет записи = включено по умолчанию
    return chat.enabled
  }

  const totalParsed = accounts.reduce((s, a) => s + (a.messages_parsed || 0), 0)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">WhatsApp аккаунты</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {accounts.filter((a) => a.status === 'active').length} активных из {accounts.length}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {parserOnline === true && (
            <span className="inline-flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Парсер онлайн
            </span>
          )}
          {parserOnline === false && (
            <span className="inline-flex items-center gap-1.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-full px-2.5 py-1">
              <XCircle className="w-3.5 h-3.5" /> Парсер недоступен
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => { load(); checkParser() }}>
            <RefreshCw className="w-4 h-4 mr-1.5" />
            Обновить
          </Button>
          <Button onClick={handleAddAccount}>
            <Plus className="w-4 h-4 mr-1.5" />
            Добавить аккаунт
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Аккаунтов</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{accounts.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Активных</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-green-600">{accounts.filter((a) => a.status === 'active').length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Сообщений обработано</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{totalParsed.toLocaleString('ru')}</p></CardContent>
        </Card>
      </div>

      <div className="border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Номер</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Чатов</TableHead>
              <TableHead>Обработано</TableHead>
              <TableHead>Последняя активность</TableHead>
              <TableHead className="text-right">Действие</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <p className="font-medium">{a.phone || 'Новый аккаунт'}</p>
                  {a.label && <p className="text-xs text-muted-foreground">{a.label}</p>}
                </TableCell>
                <TableCell>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusColor[a.status]}`}>
                    {statusLabel[a.status]}
                  </span>
                </TableCell>
                <TableCell className="text-sm">{a.chats_count}</TableCell>
                <TableCell className="text-sm">{a.messages_parsed?.toLocaleString('ru')}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {a.last_seen
                    ? new Date(a.last_seen).toLocaleString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                    : '—'}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {a.status === 'active' && (
                      <Button variant="outline" size="sm" onClick={() => openGroups(a)}>
                        <MessageSquare className="w-4 h-4 mr-1.5" />
                        Группы
                      </Button>
                    )}
                    {a.status === 'active' ? (
                      <Button variant="ghost" size="sm" onClick={() => handleDisconnect(a.id)}>
                        <WifiOff className="w-4 h-4 mr-1.5" />
                        Отключить
                      </Button>
                    ) : a.status === 'disconnected' ? (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => handleAddAccount(a.id)}>
                          Переподключить
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDeleteAccount(a.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    ) : a.status === 'connecting' ? (
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDeleteAccount(a.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {accounts.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  Аккаунтов нет. Добавьте первый.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* QR Dialog */}
      <Dialog open={qrDialog} onOpenChange={closeQrDialog}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle>Подключение WhatsApp</DialogTitle>
          </DialogHeader>
          {connecting || !qrCode ? (
            <div className="py-12 flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Генерируем QR-код...</p>
            </div>
          ) : (
            <div className="space-y-4">
              <img src={qrCode} alt="QR код" className="w-64 h-64 mx-auto rounded-xl" />
              <p className="text-sm text-muted-foreground">
                Откройте WhatsApp → Связанные устройства → Привязать устройство
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Groups Dialog */}
      <Dialog open={!!groupsAccount} onOpenChange={() => setGroupsAccount(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Группы — {groupsAccount?.phone}</DialogTitle>
          </DialogHeader>
          {groupsLoading ? (
            <div className="py-10 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : groups.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Групп не найдено</p>
          ) : (
            <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
              {groups.map((g) => {
                const enabled = isEnabled(g.jid)
                return (
                  <div key={g.jid} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50">
                    <div>
                      <p className="text-sm font-medium">{g.name}</p>
                      <p className="text-xs text-muted-foreground">{g.jid}</p>
                    </div>
                    <Switch
                      checked={enabled}
                      onCheckedChange={() => toggleChat(g.jid, g.name, enabled)}
                    />
                  </div>
                )
              })}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Все группы включены по умолчанию. Выключите те, которые не нужно парсить.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  )
}
