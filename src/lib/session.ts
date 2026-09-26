import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const SESSION_COOKIE = 'site_session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 วัน

// Secret ที่ใช้เซ็น JWT — อ่านจาก env หรือใช้ค่าที่ฝังไว้ในโค้ด
const BUILT_IN_SECRET = 'MAN-SiteCheck-2026-JWT-Secret-Key-f7a3d2e8b1c4f9a2d5'

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET ?? BUILT_IN_SECRET
  return new TextEncoder().encode(secret)
}

export interface SessionUser {
  userId: string
  phone: string | null
  full_name: string | null
  role: 'admin' | 'supervisor' | 'viewer'
  email?: string | null
  department?: string | null
  lineUserId?: string | null
  lineDisplayName?: string | null
  linePictureUrl?: string | null
  is_active: boolean
}

/** สร้าง JWT token จาก user payload */
export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret())
}

/** ตรวจสอบ JWT token */
export async function verifySession(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return payload as unknown as SessionUser
  } catch {
    return null
  }
}

/** อ่าน session จาก cookie (Server Component / Route Handler) */
export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null
  return verifySession(token)
}

/** ชื่อ cookie สำหรับ set ใน Route Handler */
export const SESSION_COOKIE_NAME = SESSION_COOKIE
export const SESSION_COOKIE_MAX_AGE = SESSION_MAX_AGE
