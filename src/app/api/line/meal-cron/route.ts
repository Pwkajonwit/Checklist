import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getMealConfig, getNotificationConfig } from '@/lib/settings-store'
import { sendNotification } from '@/lib/notification-dispatcher'
import { buildMealLineFlexMessage, formatMealLineTextMessage } from '@/lib/line-service'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'

export const dynamic = 'force-dynamic'

/**
 * Endpoint สำหรับ Vercel Cron 14:30 น.
 * ส่ง Flex กับข้าว (เหมือนกับที่กดส่งจากหน้า Settings) อัตโนมัติ
 * GET /api/line/meal-cron?secret=...
 */
export async function GET(req: NextRequest) {
  return handleMealCron(req)
}

export async function POST(req: NextRequest) {
  return handleMealCron(req)
}

async function handleMealCron(req: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────
    const notifConfig = await getNotificationConfig()
    const { searchParams } = new URL(req.url)
    const secret = searchParams.get('secret') || req.headers.get('x-cron-secret')
    const expectedSecret = process.env.CRON_SECRET || notifConfig.cron_secret || 'sitecheck-cron-secret'
    const userAgent = req.headers.get('user-agent') || ''
    const isVercelCron = userAgent.includes('vercel-cron') || Boolean(req.headers.get('x-vercel-cron'))

    if (!isVercelCron && expectedSecret && secret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized secret' }, { status: 401 })
    }

    // ── Meal config ────────────────────────────────────────────────────────
    const mealConfig = await getMealConfig()

    if (!mealConfig.enabled) {
      return NextResponse.json({ executed: false, reason: 'Meal system is disabled in settings' })
    }

    // ── Today's date (Bangkok) ─────────────────────────────────────────────
    const now = new Date()
    const todayStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(now)

    // ── Fetch checklist entries with meal_allowance = true ─────────────────
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    )

    const { data: entries, error } = await supabase
      .from('checklist_entries')
      .select('company_name, meal_allowance, status')
      .eq('entry_date', todayStr)
      .eq('meal_allowance', true)

    if (error) throw new Error(`Supabase query error: ${error.message}`)

    // ── Count meals per company ────────────────────────────────────────────
    const mealsByCompany: Record<string, number> = {}
    for (const entry of entries ?? []) {
      const co = (entry.company_name as string) || 'ไม่ระบุ'
      mealsByCompany[co] = (mealsByCompany[co] || 0) + 1
    }
    const totalMeals = Object.values(mealsByCompany).reduce((s, n) => s + n, 0)

    // ── Build Flex & Text Message ────────────────────────────────────────
    const reportData = {
      date: todayStr,
      totalMeals,
      mealsByCompany,
    } as any

    const flexMessage = buildMealLineFlexMessage(reportData, mealConfig)
    const textMsg = formatMealLineTextMessage(reportData, mealConfig)

    // ── Send ──────────────────────────────────────────────────────────────
    const result = await sendNotification({
      message: textMsg,
      flex: notifConfig.line_enabled ? flexMessage : undefined,
      line_enabled: notifConfig.line_enabled,
      line_channel_access_token: notifConfig.line_channel_access_token,
      line_target_id: notifConfig.line_target_id,
      line_broadcast: notifConfig.line_broadcast,
      telegram_enabled: notifConfig.telegram_enabled,
      telegram_bot_token: notifConfig.telegram_bot_token,
      telegram_chat_id: notifConfig.telegram_chat_id,
    })

    return NextResponse.json({
      executed: true,
      success: result.success,
      date: todayStr,
      totalMeals,
      mealsByCompany,
      results: result.results,
      message: result.message,
    }, { status: result.success ? 200 : 400 })

  } catch (err: any) {
    console.error('[meal-cron] Error:', err)
    return NextResponse.json({ error: err.message || 'Meal cron failed' }, { status: 500 })
  }
}
