'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
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
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

const navItems = [
  { href: '/dashboard', label: 'Дашборд', icon: LayoutDashboard },
  { href: '/properties', label: 'Объекты', icon: Building2 },
  { href: '/clients', label: 'Клиенты', icon: Users },
  { href: '/whatsapp', label: 'WhatsApp', icon: Smartphone },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()

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
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)}>
                    <Link href={item.href}>
                      <item.icon className="w-4 h-4" />
                      {item.label}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
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
