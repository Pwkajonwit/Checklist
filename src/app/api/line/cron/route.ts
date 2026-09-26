import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getNotificationConfig } from '@/lib/settings-store'
import { format } from 'date-fns'
import {
  buildDailyReportData,
  formatDailyLineMessage,
  buildDailyLineFlexMessage,
} from '@/lib/line-service'

export const dynamic = 'force-dynamic'

/**
 * Endpoint สำหรับ Supabase pg_cron / Edge Functions / Vercel Cron / Webhook
 * เรียก GET หรือ POST เพื่อให้ระบบดึงข้อมูลวันนี้และส่งสรุปเข้า LINE OA & Telegram อัตโนมัติ
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
    const expectedSecret = config.cron_secret || process.env.CRON_SECRET || 'sitecheck-cron-secret'

    // Verify secret if provided or configured
    if (expectedSecret && secret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized secret' }, { status: 401 })
    }

    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const formatMode = searchParams.get('mode') || config.schedule_mode || 'flex' // 'flex' or 'text'

    // Query today's data from Supabase
    const supabase = await createClient()
    const [{ data: entries }, { data: contractors }, { data: companies }, { data: activities }] =
      await Promise.all([
        supabase.from('checklist_entries').select('*').eq('entry_date', todayStr),
        supabase.from('contractors').select('*').eq('is_active', true).order('name'),
        supabase.from('companies').select('*').order('name'),
        supabase.from('activities').select('*').eq('is_active', true).order('name'),
      ])

    const report = buildDailyReportData(
      todayStr,
      entries ?? [],
      contractors ?? [],
      companies ?? [],
      activities ?? []
    )

    const textMsg = formatDailyLineMessage(report)
    const flexPayload = buildDailyLineFlexMessage(report)

    // Dispatch message via /api/line/send
    const sendRes = await fetch(`${req.nextUrl.origin}/api/line/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: textMsg,
        flex: formatMode === 'flex' ? flexPayload : undefined,
        line_enabled: config.line_enabled,
        line_channel_access_token: config.line_channel_access_token,
        line_target_id: config.line_target_id,
        line_broadcast: config.line_broadcast,
        telegram_enabled: config.telegram_enabled,
        telegram_bot_token: config.telegram_bot_token,
        telegram_chat_id: config.telegram_chat_id,
      }),
    })

    const sendData = await sendRes.json()

    return NextResponse.json({
      success: sendRes.ok,
      date: todayStr,
      time: format(new Date(), 'HH:mm:ss น.'),
      reportStats: {
        totalRegistered: report.totalRegistered,
        totalCheckedIn: report.totalCheckedIn,
        totalPassed: report.totalPassed,
        totalFailed: report.totalFailed,
        totalMissing: report.totalMissing,
        branchesCount: report.companies.length,
      },
      results: sendData,
    })
  } catch (error: any) {
    console.error('CRON send error:', error)
    return NextResponse.json(
      { error: error.message || 'Cron dispatch failed' },
      { status: 500 }
    )
  }
}

