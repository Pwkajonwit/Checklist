import { getNotificationConfig } from '@/lib/settings-store'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import {
  buildDailyReportData,
  formatDailyLineMessage,
  buildDailyLineFlexMessage,
} from '@/lib/line-service'
import { sendNotification } from '@/lib/notification-dispatcher'
import { format } from 'date-fns'

export interface CronRunOptions {
  force?: boolean
  slot?: string
  mode?: 'flex' | 'text'
}

export async function runDailyCronNotification(options: CronRunOptions = {}) {
  const config = await getNotificationConfig()

  if (!options.force && !config.schedule_enabled) {
    return {
      executed: false,
      success: false,
      reason: 'Schedule notification is disabled in settings',
    }
  }

  const now = new Date()
  // Date in Bangkok (Asia/Bangkok)
  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)

  const formatMode = options.mode || config.schedule_mode || 'flex'

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'
  const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey)

  // Query today's data from Supabase
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

  const dispatchResult = await sendNotification({
    message: textMsg,
    flex: formatMode === 'flex' ? flexPayload : undefined,
    line_enabled: config.line_enabled,
    line_channel_access_token: config.line_channel_access_token,
    line_target_id: config.line_target_id,
    line_broadcast: config.line_broadcast,
    telegram_enabled: config.telegram_enabled,
    telegram_bot_token: config.telegram_bot_token,
    telegram_chat_id: config.telegram_chat_id,
  })

  return {
    executed: true,
    success: dispatchResult.success,
    date: todayStr,
    time: format(now, 'HH:mm:ss น.'),
    slot: options.slot || null,
    reportStats: {
      totalRegistered: report.totalRegistered,
      totalCheckedIn: report.totalCheckedIn,
      totalPassed: report.totalPassed,
      totalFailed: report.totalFailed,
      totalMissing: report.totalMissing,
      branchesCount: report.companies.length,
    },
    results: dispatchResult.results,
    message: dispatchResult.message,
    error: dispatchResult.error,
  }
}
