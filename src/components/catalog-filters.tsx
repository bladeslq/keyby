'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DISTRICTS, PROPERTY_TYPE_LABELS } from '@/lib/types'
import { Search, X } from 'lucide-react'

export function CatalogFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [district, setDistrict] = useState(searchParams.get('district') || '')
  const [type, setType] = useState(searchParams.get('type') || '')
  const [priceMin, setPriceMin] = useState(searchParams.get('price_min') || '')
  const [priceMax, setPriceMax] = useState(searchParams.get('price_max') || '')

  const hasFilters = district || type || priceMin || priceMax

  function applyFilters() {
    const params = new URLSearchParams()
    if (district) params.set('district', district)
    if (type) params.set('type', type)
    if (priceMin) params.set('price_min', priceMin)
    if (priceMax) params.set('price_max', priceMax)
    router.push(`/catalog?${params.toString()}`)
  }

  function reset() {
    setDistrict('')
    setType('')
    setPriceMin('')
    setPriceMax('')
    router.push('/catalog')
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mb-8">
      <Select value={district || undefined} onValueChange={(v) => setDistrict(v ?? '')}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Все районы" />
        </SelectTrigger>
        <SelectContent>
          {DISTRICTS.map((d) => (
            <SelectItem key={d} value={d}>{d}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={type || undefined} onValueChange={(v) => setType(v ?? '')}>
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
        value={priceMin}
        onChange={(e) => setPriceMin(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
        className="w-28"
      />
      <Input
        type="number"
        placeholder="Цена до"
        value={priceMax}
        onChange={(e) => setPriceMax(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
        className="w-28"
      />

      <Button size="sm" onClick={applyFilters}>
        <Search className="w-3.5 h-3.5 mr-1.5" />
        Найти
      </Button>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={reset}>
          <X className="w-3.5 h-3.5 mr-1" />
          Сбросить
        </Button>
      )}
    </div>
  )
}
