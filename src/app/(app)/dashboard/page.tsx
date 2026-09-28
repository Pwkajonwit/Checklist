import { createServiceClient } from '@/lib/supabase/service'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { isAlcoholFailed } from '@/lib/types'
import { DashboardClient } from '@/components/dashboard/DashboardClient'

async function getDashboardData(today: string) {
  const supabase = createServiceClient()
  const { data: entries } = await supabase
    .from('checklist_entries')
    .select('*')
    .eq('entry_date', today)
    .order('created_at', { ascending: false })

  const list = entries ?? []
  return {
    total: list.length,
    active: list.filter(e => e.status === 'active').length,
    out: list.filter(e => e.status === 'checked_out').length,
    alc: list.filter(e => isAlcoholFailed(e.alc_result)).length,
    ppeIncomplete: list.filter(e => !e.ppe_helmet || !e.ppe_vest || !e.ppe_shirt || !e.ppe_gloves || !e.ppe_shoes).length,
    black: list.filter(e => e.is_blacklisted).length,
    recent: list.slice(0, 15),
    allToday: list,
  }
}

export default async function DashboardPage() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const todayThai = format(new Date(), 'EEEEที่ d MMMM yyyy', { locale: th })
  const data = await getDashboardData(today)

  return (
    <DashboardClient
      todayThai={todayThai}
      todayData={data}
    />
  )
}
