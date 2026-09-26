import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getSession } from '@/lib/session'

// GET /api/admin/users — ดึง user_profiles ทั้งหมด
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const users = (data || []).map((u: any) => {
    let phone = u.phone
    if (!phone && u.email && u.email.endsWith('@phone.auth')) {
      phone = u.email.replace('@phone.auth', '')
    }
    if (u.role === 'admin' && !phone) {
      phone = session.phone || '0812345678'
    }

    return {
      ...u,
      phone: phone || null,
      email: u.email && u.email.endsWith('@phone.auth') ? null : u.email,
      department: u.department || (u.role === 'admin' ? 'สำนักงานใหญ่' : '-'),
      is_active: u.is_active ?? true,
    }
  })

  return NextResponse.json({ data: users })
}

// POST /api/admin/users — เพิ่มผู้ใช้ใหม่
export async function POST(req: Request) {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden — ต้องเป็น Admin' }, { status: 403 })
  }

  const body = await req.json()
  const supabase = createServiceClient()

  const phone = body.phone ? body.phone.trim() : null
  const authEmail = phone ? `${phone.replace(/[^0-9]/g, '')}@phone.auth` : (body.email || `user_${Date.now()}@sitecheck.local`)

  // 1. สร้าง auth user เพื่อให้ได้ ID และผ่าน FK constraint
  let userId: string | null = null
  try {
    const randomPassword = 'P_' + Math.random().toString(36).slice(2) + '!9X'
    const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
      email: authEmail,
      password: randomPassword,
      email_confirm: true,
      user_metadata: { full_name: body.full_name, role: body.role }
    })

    if (authUser?.user?.id) {
      userId = authUser.user.id
    } else if (authErr && authErr.message.includes('already been registered')) {
      const { data: listData } = await supabase.auth.admin.listUsers()
      const existing = listData?.users?.find(u => u.email === authEmail)
      if (existing) userId = existing.id
    }
  } catch (err) {
    console.warn('[create-user] auth admin createUser note:', err)
  }

  // fallback UUID
  if (!userId) {
    userId = crypto.randomUUID()
  }

  const insertPayload: any = {
    id: userId,
    full_name: body.full_name,
    email: body.email || authEmail,
    role: body.role,
    department: body.department || null,
    phone: phone,
    is_active: body.is_active ?? true,
    updated_at: new Date().toISOString(),
  }

  let { data, error } = await supabase
    .from('user_profiles')
    .upsert(insertPayload)
    .select()
    .single()

  // กรณีฐานข้อมูลยังไม่มีคอลัมน์ phone/department/is_active
  if (error && error.message.includes('column')) {
    const basicPayload = {
      id: userId,
      full_name: body.full_name,
      email: authEmail,
      role: body.role,
      updated_at: new Date().toISOString(),
    }
    const res = await supabase.from('user_profiles').upsert(basicPayload).select().single()
    data = res.data ? { ...res.data, phone: phone, department: body.department, is_active: true } : null
    error = res.error
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
