'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Property, DISTRICTS, PROPERTY_TYPE_LABELS, STATUS_LABELS, PropertyStatus, PropertyType } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileUpload } from '@/components/ui/file-upload'
import { toast } from 'sonner'
import { ArrowLeft, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AddressInput } from '@/components/ui/address-input'

export default function PropertyEditPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const isNew = id === 'new'

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [form, setForm] = useState<Partial<Property>>({
    status: 'draft',
    photos: [],
  })

  useEffect(() => {
    if (isNew) return
    const supabase = createClient()
    supabase.from('properties').select('*').eq('id', id).single().then(({ data }) => {
      if (data) setForm(data)
      setLoading(false)
    })
  }, [id, isNew])

  function set(key: keyof Property, value: unknown) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()

    const payload = { ...form }

    if (isNew) {
      const { error } = await supabase.from('properties').insert(payload)
      if (error) { toast.error('Ошибка сохранения'); setSaving(false); return }
      toast.success('Объект создан')
      router.push('/properties')
    } else {
      const { error } = await supabase.from('properties').update(payload).eq('id', id)
      if (error) { toast.error('Ошибка сохранения'); setSaving(false); return }
      toast.success('Сохранено')
      setSaving(false)
    }
  }

  async function handlePhotoUpload(files: File[]): Promise<string[]> {
    setUploading(true)
    const supabase = createClient()
    const uploaded: string[] = []
    const folder = isNew ? 'temp' : id

    for (const file of files) {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('property-photos').upload(path, file)
      if (!error) {
        const { data } = supabase.storage.from('property-photos').getPublicUrl(path)
        uploaded.push(data.publicUrl)
      }
    }

    setUploading(false)
    return uploaded
  }

  async function handleDelete() {
    const supabase = createClient()
    await supabase.from('properties').delete().eq('id', id)
    toast.success('Объект удалён')
    router.push('/properties')
  }

  if (loading) return <div className="p-6 text-muted-foreground">Загрузка...</div>

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/properties"><ArrowLeft className="w-4 h-4 mr-1" />Назад</Link>
        </Button>
        <h1 className="text-xl font-bold">{isNew ? 'Новый объект' : form.title}</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Основное</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Статус</Label>
              <Select value={form.status} onValueChange={(v) => set('status', v as PropertyStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Название *</Label>
              <Input value={form.title || ''} onChange={(e) => set('title', e.target.value)} placeholder="ЖК Уникум" />
            </div>
            <div className="space-y-1.5">
              <Label>Тип объекта</Label>
              <Select value={form.type || ''} onValueChange={(v) => set('type', v as PropertyType)}>
                <SelectTrigger><SelectValue placeholder="Выберите тип" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PROPERTY_TYPE_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Район</Label>
              <Select value={form.district || ''} onValueChange={(v) => set('district', v)}>
                <SelectTrigger><SelectValue placeholder="Не выбран" /></SelectTrigger>
                <SelectContent>
                  {DISTRICTS.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Адрес</Label>
              <AddressInput
                value={form.address || ''}
                onChange={(v) => set('address', v)}
                placeholder="Начните вводить адрес..."
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Параметры</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Цена *</Label>
                <Input type="number" value={form.price || ''} onChange={(e) => set('price', Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Залог</Label>
                <Input type="number" value={form.deposit || ''} onChange={(e) => set('deposit', Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Площадь, м²</Label>
                <Input type="number" value={form.area || ''} onChange={(e) => set('area', Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Комнат</Label>
                <Input type="number" value={form.rooms || ''} onChange={(e) => set('rooms', Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Этаж</Label>
                <Input type="number" value={form.floor || ''} onChange={(e) => set('floor', Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Этажность</Label>
                <Input type="number" value={form.total_floors || ''} onChange={(e) => set('total_floors', Number(e.target.value))} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-base">Описание</CardTitle></CardHeader>
          <CardContent>
            <Textarea
              rows={4}
              value={form.description || ''}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Дополнительная информация об объекте..."
            />
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Фотографии</CardTitle>
            <p className="text-xs text-muted-foreground">Можно перетаскивать файлы прямо в область загрузки или выбирать их вручную.</p>
          </CardHeader>
          <CardContent>
            <FileUpload
              value={form.photos ?? []}
              onChange={(urls) => set('photos', urls)}
              onUpload={handlePhotoUpload}
              uploading={uploading}
            />
          </CardContent>
        </Card>

        {form.raw_message && (
          <Card className="md:col-span-2">
            <CardHeader><CardTitle className="text-base">Исходное сообщение из WhatsApp</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground bg-muted rounded-lg p-3 whitespace-pre-wrap">{form.raw_message}</p>
              {form.source_chat_name && (
                <p className="text-xs text-muted-foreground mt-2">Источник: {form.source_chat_name}</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Сохраняем...' : 'Сохранить'}
        </Button>
        {!isNew && (
          <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="w-4 h-4 mr-1.5" />
            Удалить
          </Button>
        )}
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Удалить объект?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Это действие необратимо.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>Отмена</Button>
            <Button variant="destructive" onClick={handleDelete}>Удалить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
