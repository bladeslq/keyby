'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { STATUS_LABELS, PropertyStatus } from '@/lib/types'
import { X } from 'lucide-react'

interface Props {
  sources: string[]
}

const ALL = '__all__'

export function PropertiesFilters({ sources }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  function get(key: string) { return searchParams.get(key) ?? '' }

  const set = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== ALL) params.set(key, value)
    else params.delete(key)
    startTransition(() => router.replace(`${pathname}?${params.toString()}`))
  }, [searchParams, pathname, router])

  const hasFilters = searchParams.size > 0

  function reset() {
    startTransition(() => router.replace(pathname))
  }

  return (
    <div className="flex flex-wrap gap-2 items-end">
      <Input
        placeholder="Поиск по названию / адресу"
        className="w-56"
        defaultValue={get('q')}
        onChange={(e) => set('q', e.target.value)}
      />

      <Select value={get('status') || ALL} onValueChange={(v) => set('status', v)}>
        <SelectTrigger className="w-40"><SelectValue placeholder="Статус" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Все статусы</SelectItem>
          {(Object.entries(STATUS_LABELS) as [PropertyStatus, string][]).map(([v, l]) => (
            <SelectItem key={v} value={v}>{l}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-1">
        <Input
          type="number"
          placeholder="Цена от"
          className="w-28"
          defaultValue={get('price_min')}
          onChange={(e) => set('price_min', e.target.value)}
        />
        <span className="text-muted-foreground text-sm">—</span>
        <Input
          type="number"
          placeholder="до"
          className="w-24"
          defaultValue={get('price_max')}
          onChange={(e) => set('price_max', e.target.value)}
        />
      </div>

      {sources.length > 0 && (
        <Select value={get('source') || ALL} onValueChange={(v) => set('source', v)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Источник" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Все источники</SelectItem>
            {sources.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Select value={get('photo_req') || ALL} onValueChange={(v) => set('photo_req', v)}>
        <SelectTrigger className="w-44"><SelectValue placeholder="Запрос фото" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Запрос фото: все</SelectItem>
          <SelectItem value="yes">Запрошено</SelectItem>
          <SelectItem value="no">Не запрошено</SelectItem>
        </SelectContent>
      </Select>

      <Select value={get('updated') || ALL} onValueChange={(v) => set('updated', v)}>
        <SelectTrigger className="w-40"><SelectValue placeholder="Обновлено" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Любое время</SelectItem>
          <SelectItem value="today">Сегодня</SelectItem>
          <SelectItem value="week">За неделю</SelectItem>
          <SelectItem value="month">За месяц</SelectItem>
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={reset} className="gap-1.5 text-muted-foreground">
          <X className="w-3.5 h-3.5" />
          Сбросить
        </Button>
      )}
    </div>
  )
}
