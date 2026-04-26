'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useTransition, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { STATUS_LABELS, PropertyStatus } from '@/lib/types'
import { X } from 'lucide-react'

const PRICE_MAX = 200_000
const PRICE_STEP = 1_000

interface Props {
  sources: string[]
}

const ALL = '__all__'

export function PropertiesFilters({ sources }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const initMin = Number(searchParams.get('price_min') || 0)
  const initMax = Number(searchParams.get('price_max') || PRICE_MAX)
  const [priceRange, setPriceRange] = useState([initMin, initMax])

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

      <div className="flex flex-col gap-1 w-56">
        <div className="flex justify-between text-xs text-muted-foreground px-0.5">
          <span>{priceRange[0] === 0 ? 'от 0' : `от ${priceRange[0].toLocaleString('ru')}₽`}</span>
          <span>{priceRange[1] >= PRICE_MAX ? 'любая' : `до ${priceRange[1].toLocaleString('ru')}₽`}</span>
        </div>
        <Slider
          min={0}
          max={PRICE_MAX}
          step={PRICE_STEP}
          value={priceRange}
          onValueChange={(v) => setPriceRange(v as number[])}
          onValueCommit={(v) => {
            const [min, max] = v as number[]
            const params = new URLSearchParams(searchParams.toString())
            min > 0 ? params.set('price_min', String(min)) : params.delete('price_min')
            max < PRICE_MAX ? params.set('price_max', String(max)) : params.delete('price_max')
            startTransition(() => router.replace(`${pathname}?${params.toString()}`))
          }}
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
