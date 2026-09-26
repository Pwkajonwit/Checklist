import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getSession } from '@/lib/session'

// PATCH /api/admin/users/[id] — แก้ไขผู้ใช้
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden — ต้องเป็น Admin' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const supabase = createServiceClient()

  const updatePayload: any = {
    full_name: body.full_name,
    email: body.email || null,
    role: body.role,
    department: body.department || null,
    phone: body.phone || null,
    is_active: body.is_active ?? true,
    updated_at: new Date().toISOString(),
  }

  let { data, error } = await supabase
    .from('user_profiles')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single()

  // กรณีฐานข้อมูลยังไม่มีคอลัมน์ phone/department/is_active
  if (error && error.message.includes('column')) {
    const basicPayload: any = {
      full_name: body.full_name,
      role: body.role,
      updated_at: new Date().toISOString(),
    }
    if (body.phone) {
      basicPayload.email = `${body.phone}@phone.auth`
    } else if (body.email) {
      basicPayload.email = body.email
    }
    const res = await supabase.from('user_profiles').update(basicPayload).eq('id', id).select().single()
    data = res.data ? { ...res.data, phone: body.phone, department: body.department, is_active: body.is_active ?? true } : null
    error = res.error
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// DELETE /api/admin/users/[id] — ลบผู้ใช้
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden — ต้องเป็น Admin' }, { status: 403 })
  }

  const { id } = await params
  const supabase = createServiceClient()

  const { error } = await supabase.from('user_profiles').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// PATCH /api/admin/users/[id]/toggle-active — สลับสถานะ
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const { is_active } = await req.json()
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('user_profiles')
    .update({ is_active, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
