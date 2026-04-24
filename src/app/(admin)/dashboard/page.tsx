import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, CheckCircle, Clock, Archive } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()

  const [
    { count: total },
    { count: published },
    { count: waitingPhotos },
    { count: archived },
  ] = await Promise.all([
    supabase.from('properties').select('*', { count: 'exact', head: true }),
    supabase.from('properties').select('*', { count: 'exact', head: true }).eq('status', 'published'),
    supabase.from('properties').select('*', { count: 'exact', head: true }).eq('status', 'waiting_photos'),
    supabase.from('properties').select('*', { count: 'exact', head: true }).eq('status', 'archived'),
  ])

  const stats = [
    { label: 'Всего', value: total ?? 0, icon: Building2, color: 'text-foreground' },
    { label: 'Опубликовано', value: published ?? 0, icon: CheckCircle, color: 'text-green-600' },
    { label: 'Ждём фото', value: waitingPhotos ?? 0, icon: Clock, color: 'text-amber-500' },
    { label: 'В архиве', value: archived ?? 0, icon: Archive, color: 'text-muted-foreground' },
  ]

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ваши объявления</h1>
        <p className="text-muted-foreground text-sm mt-1">Обзор базы недвижимости</p>
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
    </div>
  )
}
