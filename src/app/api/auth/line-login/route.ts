import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  signSession,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_MAX_AGE,
  type SessionUser,
} from '@/lib/session'

/**
 * POST /api/auth/line-login
 * Body: { lineUserId: string, displayName: string, pictureUrl?: string }
 *
 * Flow:
 * 1. ค้นหา user_profile จาก line_user_id
 * 2. ถ้าพบ → login ทันที
 * 3. ถ้าไม่พบ → return { linked: false } ให้ client ถามเบอร์โทรเพื่อผูกบัญชี
 */
export async function POST(req: Request) {
  try {
    const { lineUserId, displayName, pictureUrl } = await req.json()

    if (!lineUserId || typeof lineUserId !== 'string') {
      return NextResponse.json({ error: 'ข้อมูล LINE ไม่ถูกต้อง' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // ค้นหาจาก line_user_id
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('line_user_id', lineUserId)
      .maybeSingle()

    if (!profile) {
      // ยังไม่ได้ผูกบัญชี → ให้ client ถามเบอร์โทร
      return NextResponse.json(
        { ok: false, linked: false, lineUserId, displayName, pictureUrl },
        { status: 200 }
      )
    }

    if (profile.is_active === false) {
      return NextResponse.json(
        { error: 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแล' },
        { status: 403 }
      )
    }

    // อัพเดต LINE display name / picture ถ้าเปลี่ยน
    if (
      displayName !== profile.line_display_name ||
      pictureUrl !== profile.line_picture_url
    ) {
      await supabase
        .from('user_profiles')
        .update({
          line_display_name: displayName,
          line_picture_url: pictureUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id)
    }

    const sessionUser: SessionUser = {
      userId: profile.id,
      phone: profile.phone,
      full_name: profile.line_display_name ?? profile.full_name,
      role: profile.role,
      email: profile.email,
      department: profile.department,
      lineUserId: profile.line_user_id,
      lineDisplayName: displayName,
      linePictureUrl: pictureUrl,
      is_active: profile.is_active ?? true,
    }

    const token = await signSession(sessionUser)

    const response = NextResponse.json({ ok: true, linked: true, user: sessionUser }, { status: 200 })
    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_COOKIE_MAX_AGE,
      path: '/',
    })

    return response
  } catch (err) {
    console.error('[line-login] unexpected error', err)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }, { status: 500 })
  }
}
