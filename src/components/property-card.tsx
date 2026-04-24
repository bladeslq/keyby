'use client'

import Image from 'next/image'
import Link from 'next/link'
import { MapPin } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Property, PROPERTY_TYPE_LABELS } from '@/lib/types'

interface PropertyCardProps {
  property: Property
}

export function PropertyCard({ property }: PropertyCardProps) {
  const photo = property.photos?.[0]
  const label = property.type ? PROPERTY_TYPE_LABELS[property.type] : 'Объект'

  return (
    <Link href={`/catalog/${property.id}`} className="group block">
      <div className="rounded-xl overflow-hidden border bg-card hover:shadow-md transition-shadow">
        <div className="relative aspect-[4/3] bg-muted">
          {photo ? (
            <Image
              src={photo}
              alt={property.title}
              fill
              className="object-cover group-hover:scale-[1.02] transition-transform duration-300"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
              Фото появятся скоро
            </div>
          )}
          <div className="absolute top-2 left-2">
            <Badge variant="secondary" className="text-xs">
              {label}
            </Badge>
          </div>
        </div>
        <div className="p-4 space-y-1.5">
          <p className="font-semibold text-base leading-tight line-clamp-1">{property.title}</p>
          {(property.district || property.address) && (
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="line-clamp-1">{property.address || property.district}</span>
            </p>
          )}
          <p className="font-bold text-lg text-primary">
            {property.price
              ? `${property.price.toLocaleString('ru')} ₽/мес.`
              : 'Цена не указана'}
          </p>
        </div>
      </div>
    </Link>
  )
}
