import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const session = await getSession()
    return NextResponse.json({
      success: true,
      user: session,
      isAdmin: session?.role === 'admin',
    })
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      user: null,
      isAdmin: false,
    })
  }
}
