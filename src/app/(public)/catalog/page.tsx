import { createClient } from '@/lib/supabase/server'
import { PropertyCard } from '@/components/property-card'
import { Property, DISTRICTS, PROPERTY_TYPE_LABELS } from '@/lib/types'

interface CatalogPageProps {
  searchParams: Promise<{ district?: string; type?: string; price_min?: string; price_max?: string }>
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const params = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('properties')
    .select('*')
    .eq('status', 'published')
    .order('created_at', { ascending: false })

  if (params.district) query = query.eq('district', params.district)
  if (params.type) query = query.eq('type', params.type)
  if (params.price_min) query = query.gte('price', Number(params.price_min))
  if (params.price_max) query = query.lte('price', Number(params.price_max))

  const { data: propertiesData } = await query
  const properties = (propertiesData ?? []) as Property[]

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold">Аренда квартир в Казани</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {properties.length} актуальных квартир на Кейби
          </p>
        </div>
      </div>

      {/* Filters */}
      <form className="flex flex-wrap gap-3 mb-8">
        <select
          name="district"
          defaultValue={params.district || ''}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Все районы</option>
          {DISTRICTS.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        <select
          name="type"
          defaultValue={params.type || ''}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Все типы</option>
          {Object.entries(PROPERTY_TYPE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>

        <input
          name="price_min"
          type="number"
          placeholder="Цена от"
          defaultValue={params.price_min || ''}
          className="h-9 w-32 rounded-md border border-input bg-background px-3 text-sm"
        />
        <input
          name="price_max"
          type="number"
          placeholder="Цена до"
          defaultValue={params.price_max || ''}
          className="h-9 w-32 rounded-md border border-input bg-background px-3 text-sm"
        />

        <button
          type="submit"
          className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Найти
        </button>
        {Object.values(params).some(Boolean) && (
          <a
            href="/catalog"
            className="h-9 px-4 rounded-md border text-sm font-medium flex items-center hover:bg-muted transition-colors"
          >
            Сбросить
          </a>
        )}
      </form>

      {/* Grid */}
      {properties.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-lg">Объектов не найдено</p>
          <p className="text-sm mt-1">Попробуйте изменить фильтры</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {properties.map((p) => (
            <PropertyCard key={p.id} property={p} />
          ))}
        </div>
      )}
    </div>
  )
}
