import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getSession } from '@/lib/session'

// GET /api/activities — ดึงกิจกรรมทั้งหมด
export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// POST /api/activities — สร้างกิจกรรมใหม่
export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const supabase = createServiceClient()

  let { data, error } = await supabase
    .from('activities')
    .insert(body)
    .select()
    .single()

  // กรณีตารางยังไม่มีคอลัมน์ tasks
  if (error && error.message.includes('tasks')) {
    const { tasks, ...withoutTasks } = body
    const res = await supabase.from('activities').insert(withoutTasks).select().single()
    data = res.data
    error = res.error
  }

  // กรณีตารางยังไม่มีคอลัมน์ code
  if (error && error.message.includes('code')) {
    const { code, tasks, ...basic } = body
    const res = await supabase.from('activities').insert(basic).select().single()
    data = res.data
    error = res.error
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
