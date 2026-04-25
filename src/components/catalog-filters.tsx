'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DISTRICTS, PROPERTY_TYPE_LABELS } from '@/lib/types'
import { X } from 'lucide-react'

export function CatalogFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const district = searchParams.get('district') || ''
  const type = searchParams.get('type') || ''
  const priceMin = searchParams.get('price_min') || ''
  const priceMax = searchParams.get('price_max') || ''
  const hasFilters = district || type || priceMin || priceMax

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    router.push(`/catalog?${params.toString()}`)
  }

  function handlePriceBlur(key: string, value: string) {
    update(key, value)
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mb-8">
      <Select value={district || undefined} onValueChange={(v) => update('district', v)}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Все районы" />
        </SelectTrigger>
        <SelectContent>
          {DISTRICTS.map((d) => (
            <SelectItem key={d} value={d}>{d}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={type || undefined} onValueChange={(v) => update('type', v)}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Все типы" />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(PROPERTY_TYPE_LABELS).map(([v, l]) => (
            <SelectItem key={v} value={v}>{l}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        type="number"
        placeholder="Цена от"
        defaultValue={priceMin}
        className="w-28 h-8"
        onBlur={(e) => handlePriceBlur('price_min', e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handlePriceBlur('price_min', (e.target as HTMLInputElement).value)
        }}
      />
      <Input
        type="number"
        placeholder="Цена до"
        defaultValue={priceMax}
        className="w-28 h-8"
        onBlur={(e) => handlePriceBlur('price_max', e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handlePriceBlur('price_max', (e.target as HTMLInputElement).value)
        }}
      />

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={() => router.push('/catalog')}>
          <X className="w-3.5 h-3.5 mr-1" />
          Сбросить
        </Button>
      )}
    </div>
  )
}
