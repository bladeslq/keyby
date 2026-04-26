import Link from 'next/link'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { Property, STATUS_LABELS, PropertyStatus } from '@/lib/types'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { ImageOff, Plus } from 'lucide-react'
import { PropertyRowActions } from '@/components/property-row-actions'
import { PropertiesFilters } from '@/components/properties-filters'

const statusColor: Record<PropertyStatus, string> = {
  published: 'bg-green-100 text-green-800 border-green-200',
  waiting_photos: 'bg-amber-100 text-amber-800 border-amber-200',
  draft: 'bg-gray-100 text-gray-700 border-gray-200',
  archived: 'bg-red-100 text-red-700 border-red-200',
}

interface PageProps {
  searchParams: Promise<Record<string, string>>
}

export default async function PropertiesPage({ searchParams }: PageProps) {
  const params = await searchParams
  const supabase = await createClient()

  let query = supabase.from('properties').select('*')

  if (params.q) {
    query = query.or(`title.ilike.%${params.q}%,address.ilike.%${params.q}%`)
  }
  if (params.status) {
    query = query.eq('status', params.status)
  }
  if (params.price_min) {
    query = query.gte('price', Number(params.price_min))
  }
  if (params.price_max) {
    query = query.lte('price', Number(params.price_max))
  }
  if (params.source) {
    query = query.eq('source_chat_name', params.source)
  }
  if (params.photo_req === 'yes') {
    query = query.not('photos_requested_at', 'is', null)
  } else if (params.photo_req === 'no') {
    query = query.is('photos_requested_at', null)
  }
  if (params.updated) {
    const now = new Date()
    const cutoff = new Date(now)
    if (params.updated === 'today') cutoff.setHours(0, 0, 0, 0)
    else if (params.updated === 'week') cutoff.setDate(now.getDate() - 7)
    else if (params.updated === 'month') cutoff.setMonth(now.getMonth() - 1)
    query = query.gte('updated_at', cutoff.toISOString())
  }

  const { data: propertiesData } = await query.order('created_at', { ascending: false })
  const properties = (propertiesData ?? []) as Property[]

  const { data: sourcesData } = await supabase
    .from('properties')
    .select('source_chat_name')
    .not('source_chat_name', 'is', null)
  const sources = [...new Set((sourcesData ?? []).map((r) => r.source_chat_name as string))].sort()

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Объекты</h1>
          <p className="text-muted-foreground text-sm mt-1">{properties.length} объектов</p>
        </div>
        <Button asChild><Link href="/properties/new"><Plus />Новый объект</Link></Button>
      </div>

      <Suspense fallback={null}>
        <PropertiesFilters sources={sources} />
      </Suspense>

      <div className="border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-16">Фото</TableHead>
              <TableHead>Объект</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Цена</TableHead>
              <TableHead>Источник</TableHead>
              <TableHead>Запрос фото</TableHead>
              <TableHead>Обновлено</TableHead>
              <TableHead className="w-12 text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {properties.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  {p.photos?.[0] ? (
                    <img src={p.photos[0]} alt={p.title} className="w-12 h-12 rounded-lg object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                      <ImageOff className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <p className="font-medium line-clamp-1">{p.title}</p>
                  <p className="text-xs text-muted-foreground">{p.address || p.district || '—'}</p>
                </TableCell>
                <TableCell>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusColor[p.status]}`}>
                    {STATUS_LABELS[p.status]}
                  </span>
                </TableCell>
                <TableCell>
                  {p.price ? `${p.price.toLocaleString('ru')} ₽/мес.` : '—'}
                </TableCell>
                <TableCell>
                  <p className="text-xs text-muted-foreground line-clamp-1">{p.source_chat_name || '—'}</p>
                </TableCell>
                <TableCell>
                  {p.status === 'waiting_photos' && (
                    p.photos_requested_at ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-blue-50 text-blue-700 border-blue-200">
                        {new Date(p.photos_requested_at).toLocaleString('ru', {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-gray-100 text-gray-500 border-gray-200">
                        Не запрошено
                      </span>
                    )
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(p.updated_at).toLocaleDateString('ru', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </TableCell>
                <TableCell className="text-right">
                  <PropertyRowActions property={p} />
                </TableCell>
              </TableRow>
            ))}
            {properties.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                  Объектов не найдено.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
