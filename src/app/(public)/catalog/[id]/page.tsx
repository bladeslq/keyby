import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, MapPin, Ruler, Layers, DollarSign } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Property, PROPERTY_TYPE_LABELS } from '@/lib/types'

interface PropertyPageProps {
  params: Promise<{ id: string }>
}

export default async function PropertyPage({ params }: PropertyPageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: property } = await supabase
    .from('properties')
    .select('*')
    .eq('id', id)
    .eq('status', 'published')
    .single()

  if (!property) notFound()

  const p = property as Property

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Button variant="ghost" size="sm" asChild className="mb-6 -ml-2">
        <Link href="/catalog">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Все объекты
        </Link>
      </Button>

      {/* Photos */}
      {p.photos && p.photos.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 mb-8 rounded-xl overflow-hidden">
          <div className="relative aspect-[4/3] col-span-2 sm:col-span-1 row-span-2">
            <Image src={p.photos[0]} alt={p.title} fill className="object-cover" />
          </div>
          {p.photos.slice(1, 5).map((photo, i) => (
            <div key={i} className="relative aspect-[4/3] hidden sm:block">
              <Image src={photo} alt={`${p.title} ${i + 2}`} fill className="object-cover" />
            </div>
          ))}
        </div>
      ) : (
        <div className="w-full aspect-[16/7] bg-muted rounded-xl flex items-center justify-center text-muted-foreground mb-8">
          Фотографии появятся скоро
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-4">
          <div className="flex items-start gap-3">
            <div>
              {p.type && (
                <Badge variant="secondary" className="mb-2">
                  {PROPERTY_TYPE_LABELS[p.type]}
                </Badge>
              )}
              <h1 className="text-2xl font-bold">{p.title}</h1>
              {(p.district || p.address) && (
                <p className="text-muted-foreground flex items-center gap-1 mt-1">
                  <MapPin className="w-4 h-4" />
                  {[p.address, p.district].filter(Boolean).join(', ')}
                </p>
              )}
            </div>
          </div>

          {p.description && (
            <div>
              <h2 className="font-semibold mb-2">Описание</h2>
              <p className="text-muted-foreground whitespace-pre-wrap">{p.description}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {p.area && (
              <div className="flex items-center gap-2 text-sm">
                <Ruler className="w-4 h-4 text-muted-foreground" />
                <span>{p.area} м²</span>
              </div>
            )}
            {p.floor && (
              <div className="flex items-center gap-2 text-sm">
                <Layers className="w-4 h-4 text-muted-foreground" />
                <span>{p.floor}{p.total_floors ? `/${p.total_floors}` : ''} этаж</span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="border rounded-xl p-5 space-y-3">
            <p className="text-3xl font-bold text-primary">
              {p.price ? `${p.price.toLocaleString('ru')} ₽` : '—'}
              <span className="text-base font-normal text-muted-foreground">/мес.</span>
            </p>
            {p.deposit && (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <DollarSign className="w-4 h-4" />
                Залог: {p.deposit.toLocaleString('ru')} ₽
              </p>
            )}
            <Button className="w-full">Связаться с агентом</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
