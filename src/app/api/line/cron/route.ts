import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import {
  buildDailyReportData,
  formatDailyLineMessage,
  buildDailyLineFlexMessage,
} from '@/lib/line-service'

export const dynamic = 'force-dynamic'

/**
 * Endpoint สำหรับ Vercel Cron หรือ External Cron / Webhook
 * เรียก GET หรือ POST เพื่อให้ระบบดึงข้อมูลวันนี้และส่งสรุปเข้า LINE OA อัตโนมัติ
 */
export async function GET(req: NextRequest) {
  return handleCronSend(req)
}

export async function POST(req: NextRequest) {
  return handleCronSend(req)
}

async function handleCronSend(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const secret = searchParams.get('secret') || req.headers.get('x-cron-secret')
    const expectedSecret = process.env.CRON_SECRET || 'sitecheck-cron-secret'

    // Verify secret if CRON_SECRET is configured
    if (process.env.CRON_SECRET && secret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized secret' }, { status: 401 })
    }

    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const formatMode = searchParams.get('mode') || 'flex' // 'flex' or 'text'
    const targetId = searchParams.get('targetId') || process.env.LINE_TARGET_ID
    const channelToken = process.env.LINE_CHANNEL_ACCESS_TOKEN
    const notifyToken = process.env.LINE_NOTIFY_TOKEN

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

    // Dispatch message
    const sendRes = await fetch(`${req.nextUrl.origin}/api/line/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: textMsg,
        flex: formatMode === 'flex' ? flexPayload : undefined,
        channelAccessToken: channelToken,
        targetId: targetId,
        broadcast: !targetId,
        notifyToken: notifyToken,
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
      lineResult: sendData,
    })
  } catch (error: any) {
    console.error('CRON send error:', error)
    return NextResponse.json(
      { error: error.message || 'Cron dispatch failed' },
      { status: 500 }
    )
  }
}
