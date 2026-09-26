import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getSession } from '@/lib/session'

// GET /api/contractors
export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('contractors')
    .select('*')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// POST /api/contractors
export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const supabase = createServiceClient()

  let { data, error } = await supabase
    .from('contractors')
    .insert(body)
    .select()
    .single()

  // กรณีตารางยังไม่มีคอลัมน์ใหม่อาจจะ error PGRST204 ให้ตัดฟิลด์เฉพาะออก
  if (error && error.code === 'PGRST204') {
    const { daily_wage, alc_risk, ...fallback } = body
    const res = await supabase.from('contractors').insert(fallback).select().single()
    data = res.data
    error = res.error
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
