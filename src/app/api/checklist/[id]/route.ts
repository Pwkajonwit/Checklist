import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

function sanitizeAlcResult(val: any): string | null {
  if (val === null || val === undefined) return null
  const s = String(val).trim()
  if (!s || s === 'ไม่ได้ตรวจ' || s === 'null') return 'ไม่ได้ตรวจ'
  if (s === '0%' || s === '0' || s === '0.0' || s === '0.00') return '0%'
  if (s === '>0%' || s.startsWith('>') || s.includes('เกิน')) return '>0%'
  const num = parseFloat(s.replace(/[%mg]/gi, '').trim())
  if (!isNaN(num)) {
    return num > 0 ? '>0%' : '0%'
  }
  return '0%'
}

// GET /api/checklist/[id]
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('checklist_entries')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
  return NextResponse.json({ data })
}

// PUT /api/checklist/[id]
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const supabase = createServiceClient()

  if ('alc_result' in body) {
    body.alc_result = sanitizeAlcResult(body.alc_result)
  }

  const { data, error } = await supabase
    .from('checklist_entries')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// DELETE /api/checklist/[id]
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()

  const { error } = await supabase.from('checklist_entries').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
