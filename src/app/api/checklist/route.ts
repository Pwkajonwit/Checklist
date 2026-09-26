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

// GET /api/checklist
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const contractorId = searchParams.get('contractor_id')
  const status = searchParams.get('status')
  const search = searchParams.get('search')

  const supabase = createServiceClient()
  let query = supabase.from('checklist_entries').select('*')

  if (date) {
    query = query.eq('entry_date', date)
  } else {
    if (from) query = query.gte('entry_date', from)
    if (to) query = query.lte('entry_date', to)
  }

  if (contractorId) query = query.eq('contractor_id', contractorId)
  if (status) query = query.eq('status', status)
  if (search && search.trim()) {
    const q = search.trim()
    query = query.or(`contractor_name.ilike.%${q}%,company_name.ilike.%${q}%,activity_name.ilike.%${q}%,supervisor.ilike.%${q}%`)
  }

  query = query.order('entry_date', { ascending: false }).order('created_at', { ascending: false })

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

// POST /api/checklist (supports single object or array for batch)
export async function POST(req: Request) {
  const body = await req.json()
  const supabase = createServiceClient()

  const items = Array.isArray(body) ? body : [body]
  const results: any[] = []

  for (const rawItem of items) {
    const item = { ...rawItem }
    if ('alc_result' in item) {
      item.alc_result = sanitizeAlcResult(item.alc_result)
    }

    // Check if an entry already exists for this contractor on this date
    if (item.entry_date && (item.contractor_id || item.contractor_name)) {
      let existingQuery = supabase
        .from('checklist_entries')
        .select('id')
        .eq('entry_date', item.entry_date)

      if (item.contractor_id) {
        existingQuery = existingQuery.eq('contractor_id', item.contractor_id)
      } else {
        existingQuery = existingQuery.eq('contractor_name', item.contractor_name)
      }

      const { data: existing } = await existingQuery.limit(1).maybeSingle()

      if (existing?.id) {
        // Update existing entry instead of duplicate
        const { data: updated, error: uErr } = await supabase
          .from('checklist_entries')
          .update(item)
          .eq('id', existing.id)
          .select()
          .single()

        if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 })
        results.push(updated)
        continue
      }
    }

    // Insert new entry
    const { data: inserted, error: iErr } = await supabase
      .from('checklist_entries')
      .insert(item)
      .select()
      .single()

    if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 })
    results.push(inserted)
  }

  return NextResponse.json(
    { data: Array.isArray(body) ? results : results[0] },
    { status: 201 }
  )
}
