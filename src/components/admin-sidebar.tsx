'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { LayoutDashboard, Building2, Users, Smartphone, LogOut } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupContent,
} from '@/components/ui/sidebar'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [newCount, setNewCount] = useState(0)

  useEffect(() => {
    const supabase = createClient()

    async function loadCount() {
      const { count } = await supabase
        .from('properties')
        .select('*', { count: 'exact', head: true })
        .in('status', ['draft', 'waiting_photos'])
      setNewCount(count ?? 0)
    }

    loadCount()

    const channel = supabase
      .channel('new-properties')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'properties' }, (payload) => {
        setNewCount((n) => n + 1)
        const title = payload.new?.title || 'Новый объект'
        toast.success(`Новый объект: ${title}`, {
          description: [payload.new?.district, payload.new?.price ? `${payload.new.price.toLocaleString('ru')} ₽` : null]
            .filter(Boolean).join(' · '),
          duration: 6000,
        })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success('Вышли из системы')
    router.push('/login')
  }

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b">
        <Link href="/dashboard" className="font-bold text-lg tracking-tight">
          КЕЙБИ
          <span className="text-[10px] font-normal text-muted-foreground align-super ml-0.5">beta</span>
        </Link>
        <p className="text-xs text-muted-foreground">Кабинет агента</p>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith('/dashboard')}>
                  <Link href="/dashboard">
                    <LayoutDashboard className="w-4 h-4" />
                    Дашборд
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith('/properties')}>
                  <Link href="/properties" className="flex items-center justify-between w-full">
                    <span className="flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      Объекты
                    </span>
                    {newCount > 0 && (
                      <Badge className="ml-auto h-5 min-w-5 px-1.5 text-[11px]">{newCount}</Badge>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith('/clients')}>
                  <Link href="/clients">
                    <Users className="w-4 h-4" />
                    Клиенты
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith('/whatsapp')}>
                  <Link href="/whatsapp">
                    <Smartphone className="w-4 h-4" />
                    WhatsApp
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} className="text-muted-foreground">
              <LogOut className="w-4 h-4" />
              Выйти
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
