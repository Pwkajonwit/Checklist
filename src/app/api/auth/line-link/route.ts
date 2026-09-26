import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  signSession,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_MAX_AGE,
  type SessionUser,
} from '@/lib/session'

/**
 * POST /api/auth/line-link
 * Body: { phone: string, lineUserId: string, displayName: string, pictureUrl?: string }
 *
 * ผูก LINE account กับ user_profile ที่มีเบอร์โทรตรงกัน
 * จากนั้น login ทันที
 */
export async function POST(req: Request) {
  try {
    const { phone, lineUserId, displayName, pictureUrl } = await req.json()

    if (!phone || !lineUserId) {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบถ้วน' }, { status: 400 })
    }

    const normalized = normalizePhone(phone)
    if (!normalized) {
      return NextResponse.json({ error: 'รูปแบบเบอร์โทรไม่ถูกต้อง' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // ค้นหา user จากเบอร์โทร
    const variants = getPhoneVariants(normalized)
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .in('phone', variants)
      .maybeSingle()

    if (!profile) {
      return NextResponse.json(
        { error: 'ไม่พบเบอร์โทรนี้ในระบบ กรุณาติดต่อผู้ดูแล' },
        { status: 404 }
      )
    }

    if (profile.is_active === false) {
      return NextResponse.json(
        { error: 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแล' },
        { status: 403 }
      )
    }

    // ผูก LINE user id กับ profile
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        line_user_id: lineUserId,
        line_display_name: displayName,
        line_picture_url: pictureUrl ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id)

    if (updateError) {
      console.error('[line-link]', updateError)
      return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการผูก LINE' }, { status: 500 })
    }

    const sessionUser: SessionUser = {
      userId: profile.id,
      phone: profile.phone,
      full_name: displayName ?? profile.full_name,
      role: profile.role,
      email: profile.email,
      department: profile.department,
      lineUserId,
      lineDisplayName: displayName,
      linePictureUrl: pictureUrl,
      is_active: profile.is_active ?? true,
    }

    const token = await signSession(sessionUser)

    const response = NextResponse.json(
      { ok: true, user: sessionUser },
      { status: 200 }
    )
    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_COOKIE_MAX_AGE,
      path: '/',
    })

    return response
  } catch (err) {
    console.error('[line-link] unexpected error', err)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }, { status: 500 })
  }
}

function normalizePhone(raw: string): string | null {
  let p = raw.replace(/[\s\-().+]/g, '')
  if (p.startsWith('66')) p = '0' + p.slice(2)
  if (!/^0[0-9]{8,9}$/.test(p)) return null
  return p
}

function getPhoneVariants(phone: string): string[] {
  const variants = new Set<string>()
  variants.add(phone)
  if (phone.length === 10) {
    variants.add(`${phone.slice(0, 3)}-${phone.slice(3, 6)}-${phone.slice(6)}`)
  }
  variants.add('+66' + phone.slice(1))
  variants.add('66' + phone.slice(1))
  return Array.from(variants)
}
