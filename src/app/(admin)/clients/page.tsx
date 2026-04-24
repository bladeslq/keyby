'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Client, DISTRICTS } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { Plus, Sparkles, Pencil, Trash2 } from 'lucide-react'
import { AiMatchDialog } from '@/components/ai-match-dialog'

const emptyForm = {
  name: '',
  phone: '',
  districts: [] as string[],
  price_min: '',
  price_max: '',
  rooms: [] as number[],
  area_min: '',
  notes: '',
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [matchClient, setMatchClient] = useState<Client | null>(null)

  async function load() {
    const supabase = createClient()
    const { data } = await supabase.from('clients').select('*').order('created_at', { ascending: false })
    setClients((data as Client[]) || [])
  }

  useEffect(() => { load() }, [])

  function openNew() {
    setEditingId(null)
    setForm(emptyForm)
    setOpen(true)
  }

  function openEdit(c: Client) {
    setEditingId(c.id)
    setForm({
      name: c.name,
      phone: c.phone || '',
      districts: c.districts || [],
      price_min: c.price_min?.toString() || '',
      price_max: c.price_max?.toString() || '',
      rooms: c.rooms || [],
      area_min: c.area_min?.toString() || '',
      notes: c.notes || '',
    })
    setOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Укажите имя клиента'); return }
    setSaving(true)
    const supabase = createClient()

    const payload = {
      name: form.name,
      phone: form.phone || null,
      districts: form.districts,
      price_min: form.price_min ? Number(form.price_min) : null,
      price_max: form.price_max ? Number(form.price_max) : null,
      rooms: form.rooms,
      area_min: form.area_min ? Number(form.area_min) : null,
      notes: form.notes || null,
    }

    if (editingId) {
      await supabase.from('clients').update(payload).eq('id', editingId)
      toast.success('Клиент обновлён')
    } else {
      await supabase.from('clients').insert(payload)
      toast.success('Клиент добавлен')
    }

    setSaving(false)
    setOpen(false)
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить клиента?')) return
    const supabase = createClient()
    await supabase.from('clients').delete().eq('id', id)
    toast.success('Клиент удалён')
    load()
  }

  function toggleDistrict(d: string) {
    setForm((prev) => ({
      ...prev,
      districts: prev.districts.includes(d)
        ? prev.districts.filter((x) => x !== d)
        : [...prev.districts, d],
    }))
  }

  function toggleRoom(r: number) {
    setForm((prev) => ({
      ...prev,
      rooms: prev.rooms.includes(r)
        ? prev.rooms.filter((x) => x !== r)
        : [...prev.rooms, r],
    }))
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Клиенты</h1>
          <p className="text-muted-foreground text-sm mt-1">{clients.length} клиентов</p>
        </div>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-1.5" />Добавить клиента</Button>
      </div>

      <div className="border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Клиент</TableHead>
              <TableHead>Бюджет</TableHead>
              <TableHead>Районы</TableHead>
              <TableHead>Комнаты</TableHead>
              <TableHead>Заметки</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <p className="font-medium">{c.name}</p>
                  {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
                </TableCell>
                <TableCell className="text-sm">
                  {c.price_min || c.price_max
                    ? `${c.price_min ? c.price_min.toLocaleString('ru') : '—'} – ${c.price_max ? c.price_max.toLocaleString('ru') : '—'} ₽`
                    : '—'}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {c.districts?.slice(0, 2).map((d) => (
                      <Badge key={d} variant="secondary" className="text-xs">{d}</Badge>
                    ))}
                    {(c.districts?.length || 0) > 2 && (
                      <Badge variant="outline" className="text-xs">+{c.districts.length - 2}</Badge>
                    )}
                    {!c.districts?.length && <span className="text-muted-foreground text-sm">—</span>}
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  {c.rooms?.length ? c.rooms.join(', ') + '-к' : '—'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                  {c.notes || '—'}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setMatchClient(c)}>
                      <Sparkles className="w-4 h-4 mr-1" />
                      ИИ подбор
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {clients.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  Клиентов пока нет
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add/Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Редактировать клиента' : 'Новый клиент'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>Имя *</Label>
                <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Иван Иванов" />
              </div>
              <div className="space-y-1.5">
                <Label>Телефон</Label>
                <Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="+7 900 000 00 00" />
              </div>
              <div className="space-y-1.5">
                <Label>Площадь от, м²</Label>
                <Input type="number" value={form.area_min} onChange={(e) => setForm((p) => ({ ...p, area_min: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Цена от</Label>
                <Input type="number" value={form.price_min} onChange={(e) => setForm((p) => ({ ...p, price_min: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Цена до</Label>
                <Input type="number" value={form.price_max} onChange={(e) => setForm((p) => ({ ...p, price_max: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Количество комнат</Label>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => toggleRoom(r)}
                    className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                      form.rooms.includes(r)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    {r}-к
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Районы</Label>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                {DISTRICTS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDistrict(d)}
                    className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                      form.districts.includes(d)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Заметки</Label>
              <Textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Пожелания, сроки, особенности..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Отмена</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Сохраняем...' : 'Сохранить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI match dialog */}
      {matchClient && (
        <AiMatchDialog
          client={matchClient}
          onClose={() => setMatchClient(null)}
        />
      )}
    </div>
  )
}
