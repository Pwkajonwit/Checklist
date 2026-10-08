import { NextResponse } from 'next/server'
import { getNotificationLogs, clearNotificationLogs } from '@/lib/settings-store'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET /api/notifications/logs
export async function GET() {
  try {
    const logs = await getNotificationLogs(50)
    return NextResponse.json({
      success: true,
      data: logs,
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

// DELETE /api/notifications/logs (Clear logs)
export async function DELETE() {
  try {
    await clearNotificationLogs()
    return NextResponse.json({
      success: true,
      message: 'ล้างประวัติการแจ้งเตือนเรียบร้อยแล้ว',
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
