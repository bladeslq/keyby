import Link from 'next/link'
import { Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="font-bold text-xl tracking-tight">
            КЕЙБИ<span className="text-[10px] font-normal text-muted-foreground align-super ml-0.5">beta</span>
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/catalog" />}>
              <Heart className="w-4 h-4 mr-1.5" />
              Избранное
            </Button>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}
