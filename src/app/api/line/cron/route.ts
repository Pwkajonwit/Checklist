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
    const authHeader = req.headers.get('authorization')
    const bearerSecret = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : null
    const secret =
      searchParams.get('secret') ||
      req.headers.get('x-cron-secret') ||
      bearerSecret

    const expectedSecret =
      process.env.CRON_SECRET ||
      config.cron_secret ||
      'sitecheck-cron-secret'

    const userAgent = req.headers.get('user-agent') || ''
    const isVercelCron =
      userAgent.includes('vercel-cron') ||
      Boolean(req.headers.get('x-vercel-cron'))

    // Verify secret (Allow Vercel Cron or matching secret)
    if (!isVercelCron && expectedSecret && secret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized secret' }, { status: 401 })
    }

    const forceParam = searchParams.get('force')
    // If not explicitly set to 'false', Vercel cron or secret request executes if schedule is enabled
    const force = forceParam === 'true'
    const mode = (searchParams.get('mode') as 'flex' | 'text') || config.schedule_mode || undefined

    const now = new Date()
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000
    const bkk = new Date(utcMs + 7 * 3600000)
    const currentSlot = `${String(bkk.getHours()).padStart(2, '0')}:${String(bkk.getMinutes()).padStart(2, '0')}`

    const result = await runDailyCronNotification({
      force: force || !config.schedule_enabled ? force : true,
      slot: searchParams.get('slot') || currentSlot,
      mode,
    })

    recordSchedulerRun(result, 'vercel-cron')

    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  } catch (error: any) {
    console.error('CRON send error:', error)
    return NextResponse.json(
      { error: error.message || 'Cron dispatch failed' },
      { status: 500 }
    )
  }
}
