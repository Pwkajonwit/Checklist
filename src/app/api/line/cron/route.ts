import { NextRequest, NextResponse } from 'next/server'
import { getNotificationConfig } from '@/lib/settings-store'
import { runDailyCronNotification } from '@/lib/line-cron-runner'
import { recordSchedulerRun } from '@/lib/server-scheduler'

export const dynamic = 'force-dynamic'

/**
 * Endpoint สำหรับ Supabase pg_cron / Edge Functions / Vercel Cron / Webhook
 * หรือกดทดสอบจากหน้าเว็บ เพื่อให้ระบบส่งสรุปรายงานอัตโนมัติเข้า LINE OA & Telegram
 */
export async function GET(req: NextRequest) {
  return handleCronSend(req)
}

export async function POST(req: NextRequest) {
  return handleCronSend(req)
}

async function handleCronSend(req: NextRequest) {
  try {
    const config = await getNotificationConfig()

    const { searchParams } = new URL(req.url)
    const secret = searchParams.get('secret') || req.headers.get('x-cron-secret')
    const force = searchParams.get('force') === 'true'
    const mode = (searchParams.get('mode') as 'flex' | 'text') || undefined
    const expectedSecret = config.cron_secret || process.env.CRON_SECRET || 'sitecheck-cron-secret'

    // Verify secret
    if (expectedSecret && secret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized secret' }, { status: 401 })
    }

    const result = await runDailyCronNotification({
      force: force || true, // When cron endpoint is hit explicitly, force execute
      mode,
    })

    recordSchedulerRun(result, 'manual-trigger')

    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  } catch (error: any) {
    console.error('CRON send error:', error)
    return NextResponse.json(
      { error: error.message || 'Cron dispatch failed' },
      { status: 500 }
    )
  }
}
