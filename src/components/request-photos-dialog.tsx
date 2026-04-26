'use client'

import { useState, useMemo } from 'react'
import { Property } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Copy, Check, MessageCircle, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  property: Property
  onRequested?: (ts: string) => void
}

function buildDefaultRequest(property: Property): string {
  const parts: string[] = ['Здравствуйте!']
  const ref: string[] = []
  if (property.address) ref.push(`по адресу ${property.address}`)
  if (property.price) ref.push(`за ${property.price.toLocaleString('ru-RU')}₽`)
  if (ref.length) {
    parts.push(`Видел ваше объявление ${ref.join(' ')}.`)
  } else {
    parts.push('Видел ваше объявление.')
  }
  parts.push('Не могли бы прислать фото объекта? Спасибо!')
  return parts.join(' ')
}

export function RequestPhotosDialog({ open, onOpenChange, property, onRequested }: Props) {
  const defaultText = useMemo(() => buildDefaultRequest(property), [property])
  const [requestText, setRequestText] = useState(defaultText)
  const [copiedRaw, setCopiedRaw] = useState(false)
  const [waOpened, setWaOpened] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const phone = (property.sender_phone || '').replace(/\D/g, '')
  // WA internal LIDs look like 14-digit numbers starting with "100" — not real phones
  const isLid = phone.length >= 13 && phone.startsWith('100')
  const waUrl = phone && !isLid
    ? `https://wa.me/${phone}?text=${encodeURIComponent(requestText)}`
    : null

  function handleClose() {
    setWaOpened(false)
    onOpenChange(false)
  }

  async function copyRaw() {
    if (!property.raw_message) return
    await navigator.clipboard.writeText(property.raw_message)
    setCopiedRaw(true)
    setTimeout(() => setCopiedRaw(false), 1500)
  }

  function handleOpenWhatsApp() {
    window.open(waUrl!, '_blank', 'noopener,noreferrer')
    setWaOpened(true)
  }

  async function handleConfirmSent() {
    setConfirming(true)
    const supabase = createClient()
    const ts = new Date().toISOString()
    const { error } = await supabase
      .from('properties')
      .update({ photos_requested_at: ts })
      .eq('id', property.id)
    if (error) {
      toast.error('Не удалось сохранить')
      setConfirming(false)
      return
    }
    onRequested?.(ts)
    handleClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Запросить фото</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Исходное сообщение риелтора</Label>
              {property.raw_message && (
                <Button type="button" variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={copyRaw}>
                  {copiedRaw ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  {copiedRaw ? 'Скопировано' : 'Копировать'}
                </Button>
              )}
            </div>
            <div className="text-sm bg-muted rounded-lg p-3 whitespace-pre-wrap max-h-40 overflow-y-auto">
              {property.raw_message || <span className="text-muted-foreground">Нет исходного сообщения</span>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Текст запроса</Label>
            <Textarea rows={4} value={requestText} onChange={(e) => setRequestText(e.target.value)} />
          </div>

          {!phone && (
            <p className="text-xs text-destructive">У объекта нет номера отправителя — открыть чат не получится.</p>
          )}
          {phone && isLid && (
            <p className="text-xs text-destructive">
              Номер отправителя ({phone}) — это внутренний ID WhatsApp, а не реальный телефон. Открыть чат через ссылку не получится — найдите этого риелтора вручную в WA.
            </p>
          )}

          {waOpened && (
            <p className="text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded-lg p-2.5">
              Вы отправили сообщение риелтору? Подтвердите — и бейдж запроса появится в таблице.
            </p>
          )}
        </div>

        <DialogFooter>
          {!waOpened ? (
            <>
              <Button variant="outline" onClick={handleClose}>Отмена</Button>
              <Button onClick={handleOpenWhatsApp} disabled={!waUrl}>
                <ExternalLink />
                Открыть WhatsApp
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>Не отправлял</Button>
              <Button onClick={handleConfirmSent} disabled={confirming}>
                <MessageCircle />
                {confirming ? 'Сохраняем...' : 'Я отправил'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
