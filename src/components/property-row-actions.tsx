'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Property } from '@/lib/types'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { MoreHorizontal, Pencil, MessageCircle, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { RequestPhotosDialog } from '@/components/request-photos-dialog'

interface Props {
  property: Property
}

export function PropertyRowActions({ property }: Props) {
  const router = useRouter()
  const [requestOpen, setRequestOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [requestedAt, setRequestedAt] = useState<string | null>(property.photos_requested_at)

  async function handleDelete() {
    setDeleting(true)
    const supabase = createClient()
    const { error } = await supabase.from('properties').delete().eq('id', property.id)
    if (error) {
      toast.error('Ошибка удаления')
      setDeleting(false)
      return
    }
    toast.success('Объект удалён')
    setConfirmDelete(false)
    router.refresh()
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          <DropdownMenuItem asChild>
            <Link href={`/properties/${property.id}`}>
              <Pencil />
              Редактировать
            </Link>
          </DropdownMenuItem>
          {property.sender_phone && (
            <DropdownMenuItem onSelect={() => setRequestOpen(true)}>
              <MessageCircle />
              Запросить фото
            </DropdownMenuItem>
          )}
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
            <Trash2 />
            Удалить
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <RequestPhotosDialog
        open={requestOpen}
        onOpenChange={setRequestOpen}
        property={{ ...property, photos_requested_at: requestedAt }}
        onRequested={(ts) => {
          setRequestedAt(ts)
          router.refresh()
        }}
      />

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Удалить объект?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Это действие необратимо.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>Отмена</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Удаление...' : 'Удалить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
