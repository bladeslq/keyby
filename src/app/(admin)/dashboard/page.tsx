import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, CheckCircle, Clock, Archive, TrendingUp, TrendingDown } from 'lucide-react'
import { PROPERTY_TYPE_LABELS, PropertyType } from '@/lib/types'
import { PropertiesChart } from '@/components/dashboard/properties-chart'
import { DistrictChart } from '@/components/dashboard/district-chart'
import { TypeChart } from '@/components/dashboard/type-chart'

export default async function DashboardPage() {
  const supabase = await createClient()

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

  const [
    { count: total },
    { count: published },
    { count: waitingPhotos },
    { count: archived },
    { count: lastWeek },
    { count: previousWeek },
    { data: recentProperties },
  ] = await Promise.all([
    supabase.from('properties').select('*', { count: 'exact', head: true }),
    supabase.from('properties').select('*', { count: 'exact', head: true }).eq('status', 'published'),
    supabase.from('properties').select('*', { count: 'exact', head: true }).eq('status', 'waiting_photos'),
    supabase.from('properties').select('*', { count: 'exact', head: true }).eq('status', 'archived'),
    supabase.from('properties').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo.toISOString()),
    supabase.from('properties').select('*', { count: 'exact', head: true }).gte('created_at', fourteenDaysAgo.toISOString()).lt('created_at', sevenDaysAgo.toISOString()),
    supabase.from('properties').select('created_at, district, type').gte('created_at', thirtyDaysAgo.toISOString()),
  ])

  const lw = lastWeek ?? 0
  const pw = previousWeek ?? 0
  const trend = pw === 0 ? (lw > 0 ? 100 : 0) : Math.round(((lw - pw) / pw) * 100)

  const dailyMap = new Map<string, number>()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
    dailyMap.set(d.toISOString().slice(0, 10), 0)
  }
  for (const p of recentProperties || []) {
    const key = p.created_at.slice(0, 10)
    if (dailyMap.has(key)) dailyMap.set(key, dailyMap.get(key)! + 1)
  }
  const dailyData = Array.from(dailyMap.entries()).map(([k, v]) => ({
    date: new Date(k).toLocaleDateString('ru', { day: 'numeric', month: 'short' }),
    count: v,
  }))

  const districtMap = new Map<string, number>()
  for (const p of recentProperties || []) {
    if (!p.district) continue
    districtMap.set(p.district, (districtMap.get(p.district) || 0) + 1)
  }
  const districtData = Array.from(districtMap.entries())
    .map(([district, count]) => ({ district, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  const typeMap = new Map<string, number>()
  for (const p of recentProperties || []) {
    if (!p.type) continue
    const label = PROPERTY_TYPE_LABELS[p.type as PropertyType] || p.type
    typeMap.set(label, (typeMap.get(label) || 0) + 1)
  }
  const typeData = Array.from(typeMap.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)

  const stats = [
    { label: 'Всего', value: total ?? 0, icon: Building2, color: 'text-foreground' },
    { label: 'Опубликовано', value: published ?? 0, icon: CheckCircle, color: 'text-green-600' },
    { label: 'Ждём фото', value: waitingPhotos ?? 0, icon: Clock, color: 'text-amber-500' },
    { label: 'В архиве', value: archived ?? 0, icon: Archive, color: 'text-muted-foreground' },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Ваши объявления</h1>
          <p className="text-muted-foreground text-sm mt-1">Обзор базы недвижимости</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">За неделю:</span>
          <span className="font-bold text-lg">{lw}</span>
          {trend !== 0 && (
            <span className={`inline-flex items-center gap-0.5 text-xs font-medium px-2 py-0.5 rounded-full ${
              trend > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {Math.abs(trend)}%
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              <s.icon className={`w-4 h-4 ${s.color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <PropertiesChart data={dailyData} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DistrictChart data={districtData} />
        <TypeChart data={typeData} />
      </div>
    </div>
  )
}
