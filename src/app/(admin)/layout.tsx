import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminSidebar } from '@/components/admin-sidebar'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset>
        <div className="flex flex-col min-h-screen">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
