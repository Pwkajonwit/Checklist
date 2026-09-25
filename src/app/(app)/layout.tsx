import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppHeader } from '@/components/layout'

import type { UserRole } from '@/lib/types'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: fetchedProfile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  let profile = fetchedProfile
  if (!profile && user) {
    const { data: created } = await supabase
      .from('user_profiles')
      .upsert({
        id: user.id,
        email: user.email,
        full_name: user.email?.split('@')[0] ?? 'Admin',
        role: 'admin',
      })
      .select('*')
      .maybeSingle()
    if (created) profile = created
  }

  const role = (profile?.role ?? 'admin') as UserRole
  const displayName = profile?.full_name ?? user.email?.split('@')[0] ?? 'User'
  const initials = displayName.substring(0, 2).toUpperCase()

  return (
    <div className="flex flex-col h-screen max-h-screen overflow-hidden bg-slate-100">
      <AppHeader
        role={role}
        initials={initials}
        email={user.email ?? ''}
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
