import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getSession } from '@/lib/session'

import { formatCompanyCodePayload } from '@/lib/types'

// PUT /api/companies/[id]
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const supabase = createServiceClient()

  let { data, error } = await supabase
    .from('companies')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  // Graceful fallback if phone or line_group columns are not yet added to DB
  if (error && (error.code === 'PGRST204' || error.message?.includes('column'))) {
    const fallbackBody = {
      name: body.name,
      code: formatCompanyCodePayload(body.code, body.phone, body.line_group),
    }
    const retry = await supabase
      .from('companies')
      .update(fallbackBody)
      .eq('id', id)
      .select()
      .single()
    data = retry.data
    error = retry.error
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// DELETE /api/companies/[id]
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()

  const { error } = await supabase.from('companies').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
