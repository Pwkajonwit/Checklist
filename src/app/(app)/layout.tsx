import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { AppHeader } from '@/components/layout'
import type { UserRole } from '@/lib/types'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()

  if (!session) redirect('/login')
  if (session.is_active === false) redirect('/login?reason=inactive')

  const role = (session.role ?? 'viewer') as UserRole
  const displayName = session.full_name ?? session.phone ?? 'User'
  const initials = displayName.substring(0, 2).toUpperCase()

  return (
    <div className="flex flex-col h-screen max-h-screen overflow-hidden bg-slate-100">
      <AppHeader
        role={role}
        initials={initials}
        email={session.email ?? session.phone ?? ''}
        name={displayName}
      />
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        <main className="page-content flex-1 flex flex-col min-h-0 p-2 sm:p-2.5 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  )
}
