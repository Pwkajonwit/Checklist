import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

// GET /api/checklist
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  const contractorId = searchParams.get('contractor_id')
  const status = searchParams.get('status')

  const supabase = createServiceClient()
  let query = supabase.from('checklist_entries').select('*').order('created_at', { ascending: false })

  if (date) query = query.eq('entry_date', date)
  if (contractorId) query = query.eq('contractor_id', contractorId)
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// POST /api/checklist (supports single object or array for batch)
export async function POST(req: Request) {
  const body = await req.json()
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('checklist_entries')
    .insert(body)
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
