import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getSession } from '@/lib/session'

// PUT /api/activities/[id] — อัปเดตกิจกรรม
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const supabase = createServiceClient()

  let { data, error } = await supabase
    .from('activities')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error && error.message.includes('tasks')) {
    const { tasks, ...withoutTasks } = body
    const res = await supabase.from('activities').update(withoutTasks).eq('id', id).select().single()
    data = res.data
    error = res.error
  }

  if (error && error.message.includes('code')) {
    const { code, tasks, ...basic } = body
    const res = await supabase.from('activities').update(basic).eq('id', id).select().single()
    data = res.data
    error = res.error
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// DELETE /api/activities/[id] — ลบกิจกรรม
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()

  const { error } = await supabase.from('activities').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
