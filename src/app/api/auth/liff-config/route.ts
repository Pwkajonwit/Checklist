import { NextResponse } from 'next/server'
import { getNotificationConfig } from '@/lib/settings-store'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const envLiffId = process.env.NEXT_PUBLIC_LIFF_ID?.trim() || ''
    if (envLiffId) {
      return NextResponse.json({ success: true, liffId: envLiffId })
    }

    const cfg = await getNotificationConfig()
    return NextResponse.json({
      success: true,
      liffId: cfg.line_liff_id?.trim() || '',
    })
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      liffId: '',
      error: err.message,
    })
  }
}
