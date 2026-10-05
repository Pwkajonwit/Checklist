import { getNotificationConfig } from '@/lib/settings-store'
import { runDailyCronNotification } from '@/lib/line-cron-runner'

interface SchedulerGlobalState {
  __lineCronTimer?: NodeJS.Timeout
  __sentSlotsToday?: Set<string>
  __lastSentDate?: string
  __schedulerStarted?: boolean
  __startedAt?: string
  __lastRunStatus?: {
    time: string
    slot: string
    success: boolean
    message?: string
    results?: any
  }
}

const g = globalThis as unknown as SchedulerGlobalState

if (!g.__sentSlotsToday) {
  g.__sentSlotsToday = new Set<string>()
}

/**
 * Returns Bangkok date (YYYY-MM-DD) and time (HH:mm)
 */
export function getBangkokDateTime(): { dateStr: string; timeStr: string; fullStr: string } {
  const now = new Date()
  const dateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)

  const timeStr = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now)

  return {
    dateStr,
    timeStr,
    fullStr: `${dateStr} ${timeStr}`,
  }
}

/**
 * Check schedule and trigger if current Bangkok minute matches a slot
 */
export async function checkAndTriggerSchedule(): Promise<{
  triggered: boolean
  slot?: string
  reason?: string
  result?: any
}> {
  return { triggered: false, reason: 'Disabled: Using Vercel Cron exclusively' }
}

async function _legacyCheckAndTriggerSchedule(): Promise<{
  triggered: boolean
  slot?: string
  reason?: string
  result?: any
}> {
  const { dateStr, timeStr, fullStr } = getBangkokDateTime()

  // Reset sent slots on new day
  if (g.__lastSentDate !== dateStr) {
    g.__sentSlotsToday = new Set<string>()
    g.__lastSentDate = dateStr
  }

  const config = await getNotificationConfig().catch(() => null)
  if (!config) {
    return { triggered: false, reason: 'Failed to read notification config' }
  }

  if (!config.schedule_enabled) {
    return { triggered: false, reason: 'Schedule notifications are disabled in settings' }
  }

  if (!config.schedule_times || config.schedule_times.length === 0) {
    return { triggered: false, reason: 'No schedule times configured' }
  }

  // Check if current Bangkok time matches any slot
  if (!config.schedule_times.includes(timeStr)) {
    return { triggered: false, reason: `Current time ${timeStr} does not match any scheduled slots` }
  }

  // Check if already sent today for this slot
  if (g.__sentSlotsToday?.has(fullStr)) {
    return { triggered: false, slot: timeStr, reason: `Slot ${fullStr} already sent today` }
  }

  // Mark as sent immediately to prevent race conditions
  g.__sentSlotsToday?.add(fullStr)
  console.log(`[SiteCheck Scheduler] 🚀 Triggering automatic daily report for slot: ${fullStr}`)

  try {
    const runResult = await runDailyCronNotification({
      force: true,
      slot: timeStr,
      mode: config.schedule_mode,
    })

    g.__lastRunStatus = {
      time: fullStr,
      slot: timeStr,
      success: runResult.success,
      message: runResult.message || (runResult.success ? 'ส่งสำเร็จ' : 'ส่งไม่สำเร็จ'),
      results: runResult.results,
    }

    console.log(`[SiteCheck Scheduler] ✅ Slot ${fullStr} completed. Success: ${runResult.success}`)
    return { triggered: true, slot: timeStr, result: runResult }
  } catch (err: any) {
    console.error(`[SiteCheck Scheduler] ❌ Slot ${fullStr} failed:`, err)
    g.__lastRunStatus = {
      time: fullStr,
      slot: timeStr,
      success: false,
      message: err.message || 'Cron execution error',
    }
    return { triggered: false, slot: timeStr, reason: err.message }
  }
}

/**
 * Server Background Scheduler is disabled.
 * The system now relies exclusively on Vercel Cron.
 */
export function startServerScheduler() {
  if (g.__lineCronTimer) {
    clearInterval(g.__lineCronTimer)
    g.__lineCronTimer = undefined
  }
  g.__schedulerStarted = false
}

/**
 * Record a manual or cron run into the scheduler diagnostics
 */
export function recordSchedulerRun(runResult: any, slotName?: string) {
  const { fullStr, timeStr } = getBangkokDateTime()
  g.__lastRunStatus = {
    time: fullStr,
    slot: slotName || timeStr,
    success: !!runResult?.success,
    message: runResult?.message || (runResult?.success ? 'ส่งสำเร็จ' : 'เกิดข้อผิดพลาด'),
    results: runResult?.results,
  }
}

/**
 * Query current scheduler status for UI / diagnostic endpoints
 */
export async function getSchedulerDiagnostics() {
  const { dateStr, timeStr, fullStr } = getBangkokDateTime()
  const config = await getNotificationConfig().catch(() => null)

  const slots = config?.schedule_times || []
  const sortedSlots = [...slots].sort()

  // Find next upcoming slot today or tomorrow
  let nextSlot: string | null = null
  for (const s of sortedSlots) {
    if (s >= timeStr) {
      nextSlot = s
      break
    }
  }
  if (!nextSlot && sortedSlots.length > 0) {
    nextSlot = `${sortedSlots[0]} (พรุ่งนี้)`
  }

  return {
    serverActive: !!g.__schedulerStarted,
    startedAt: g.__startedAt || null,
    serverBangkokTime: timeStr,
    serverBangkokDate: dateStr,
    scheduleEnabled: !!config?.schedule_enabled,
    configuredSlots: sortedSlots,
    nextScheduledSlot: nextSlot,
    sentSlotsToday: Array.from(g.__sentSlotsToday || []),
    lastRun: g.__lastRunStatus || null,
  }
}
