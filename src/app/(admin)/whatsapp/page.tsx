'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { WaAccount, WaAccountStatus } from '@/lib/types'
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
import { Plus, RefreshCw, WifiOff, Loader2 } from 'lucide-react'
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

export default function WhatsAppPage() {
  const [accounts, setAccounts] = useState<WaAccount[]>([])
  const [qrDialog, setQrDialog] = useState(false)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  async function load() {
    const supabase = createClient()
    const { data } = await supabase
      .from('wa_accounts')
      .select('*')
      .order('created_at', { ascending: false })
    setAccounts((data as WaAccount[]) || [])
  }

  useEffect(() => {
    load()

    // Real-time updates
    const supabase = createClient()
    const channel = supabase
      .channel('wa_accounts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wa_accounts' }, load)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  async function handleAddAccount() {
    setQrDialog(true)
    setQrCode(null)
    setConnecting(true)

    // Request new QR from parser service
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_PARSER_URL}/wa/connect`,
        { method: 'POST' }
      )
      const { wsToken } = await res.json()

      // Connect via WebSocket to stream QR
      const ws = new WebSocket(
        `${process.env.NEXT_PUBLIC_PARSER_WS_URL}/wa/qr?token=${wsToken}`
      )
      wsRef.current = ws

      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data)
        if (msg.type === 'qr') {
          setQrCode(msg.data)
          setConnecting(false)
        }
        if (msg.type === 'connected') {
          toast.success('WhatsApp аккаунт подключён!')
          setQrDialog(false)
          load()
        }
      }
      ws.onerror = () => {
        toast.error('Ошибка подключения к парсеру')
        setQrDialog(false)
      }
    } catch {
      toast.error('Парсер недоступен')
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
          <Button variant="outline" size="sm" onClick={load}>
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
                  {a.status === 'active' ? (
                    <Button variant="ghost" size="sm" onClick={() => handleDisconnect(a.id)}>
                      <WifiOff className="w-4 h-4 mr-1.5" />
                      Отключить
                    </Button>
                  ) : a.status === 'disconnected' ? (
                    <Button variant="ghost" size="sm" onClick={handleAddAccount}>
                      Переподключить
                    </Button>
                  ) : null}
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
    </div>
  )
}
