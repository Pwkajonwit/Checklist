import { NextRequest, NextResponse } from 'next/server'
import { sendNotification } from '@/lib/notification-dispatcher'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const result = await sendNotification(body)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || result.message, results: result.results },
        { status: 400 }
      )
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Notification send error:', error)
    return NextResponse.json(
      { error: error.message || 'เกิดข้อผิดพลาดในการส่งข้อความ' },
      { status: 500 }
    )
  }
}
