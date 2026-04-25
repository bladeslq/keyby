'use client'

import { useState } from 'react'
import { Client, Property } from '@/lib/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sparkles, MapPin, Loader2 } from 'lucide-react'
import Link from 'next/link'

interface AiMatchDialogProps {
  client: Client
  onClose: () => void
}

interface MatchResult {
  property: Property
  score: number
  reason: string
}

export function AiMatchDialog({ client, onClose }: AiMatchDialogProps) {
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<MatchResult[] | null>(null)

  async function handleMatch() {
    setLoading(true)
    try {
      const res = await fetch('/api/clients/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id }),
      })
      const data = await res.json()
      setResults(data.matches || [])
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            ИИ подбор для {client.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm text-muted-foreground bg-muted/50 rounded-lg p-4">
          <p>
            <span className="font-medium text-foreground">Бюджет:</span>{' '}
            {client.price_min || client.price_max
              ? `${client.price_min?.toLocaleString('ru') ?? '—'} – ${client.price_max?.toLocaleString('ru') ?? '—'} ₽`
              : 'не указан'}
          </p>
          {client.rooms?.length > 0 && (
            <p><span className="font-medium text-foreground">Комнат:</span> {client.rooms.join(', ')}-к</p>
          )}
          {client.districts?.length > 0 && (
            <p>
              <span className="font-medium text-foreground">Районы:</span>{' '}
              {client.districts.join(', ')}
            </p>
          )}
          {client.notes && (
            <p><span className="font-medium text-foreground">Заметки:</span> {client.notes}</p>
          )}
        </div>

        {!results && (
          <Button onClick={handleMatch} disabled={loading} className="w-full">
            {loading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Ищем подходящие объекты...</>
            ) : (
              <><Sparkles className="w-4 h-4 mr-2" />Подобрать через ИИ</>
            )}
          </Button>
        )}

        {results !== null && (
          <div className="space-y-3">
            <p className="text-sm font-medium">
              {results.length > 0 ? `Найдено ${results.length} подходящих объектов` : 'Подходящих объектов не найдено'}
            </p>
            {results.map((r, i) => (
              <div key={r.property.id} className="border rounded-xl p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-muted-foreground">#{i + 1}</span>
                      <p className="font-medium">{r.property.title}</p>
                      <Badge variant="secondary" className="text-xs">
                        {Math.round(r.score * 100)}%
                      </Badge>
                    </div>
                    {(r.property.district || r.property.address) && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3.5 h-3.5" />
                        {r.property.address || r.property.district}
                      </p>
                    )}
                  </div>
                  <p className="font-bold text-primary shrink-0">
                    {r.property.price ? `${r.property.price.toLocaleString('ru')} ₽` : '—'}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground bg-muted rounded p-2">{r.reason}</p>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/properties/${r.property.id}`} target="_blank">Открыть объект</Link>
                </Button>
              </div>
            ))}
            <Button variant="outline" className="w-full" onClick={() => setResults(null)}>
              Искать снова
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
