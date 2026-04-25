import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Property, STATUS_LABELS, PROPERTY_TYPE_LABELS, PropertyStatus } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Pencil, ImageOff } from 'lucide-react'

const statusVariant: Record<PropertyStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  published: 'default',
  waiting_photos: 'secondary',
  draft: 'outline',
  archived: 'destructive',
}

const statusColor: Record<PropertyStatus, string> = {
  published: 'bg-green-100 text-green-800 border-green-200',
  waiting_photos: 'bg-amber-100 text-amber-800 border-amber-200',
  draft: 'bg-gray-100 text-gray-700 border-gray-200',
  archived: 'bg-red-100 text-red-700 border-red-200',
}

export default async function PropertiesPage() {
  const supabase = await createClient()
  const { data: propertiesData } = await supabase
    .from('properties')
    .select('*')
    .order('created_at', { ascending: false })

  const properties = (propertiesData ?? []) as Property[]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Объекты</h1>
          <p className="text-muted-foreground text-sm mt-1">{properties.length} объектов в базе</p>
        </div>
        <Button asChild><Link href="/properties/new">+ Новый объект</Link></Button>
      </div>

      <div className="border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-16">Фото</TableHead>
              <TableHead>Объект</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Цена</TableHead>
              <TableHead>Источник</TableHead>
              <TableHead>Обновлено</TableHead>
              <TableHead className="text-right">Действие</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {properties.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  {p.photos?.[0] ? (
                    <img
                      src={p.photos[0]}
                      alt={p.title}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
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
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {p.source_chat_name || '—'}
                  </p>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(p.updated_at).toLocaleDateString('ru', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/properties/${p.id}`}>
                      <Pencil className="w-4 h-4 mr-1.5" />
                      Открыть
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {properties.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  Объектов пока нет. Они появятся автоматически из WhatsApp чатов.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
