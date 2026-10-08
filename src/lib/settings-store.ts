import { promises as fs } from 'fs'
import path from 'path'
import { createServiceClient } from '@/lib/supabase/service'
import {
  ChecklistPpeItem,
  DEFAULT_CHECKLIST_PPE_ITEMS,
  NotificationConfig,
  DEFAULT_NOTIFICATION_CONFIG,
  MealConfig,
  DEFAULT_MEAL_CONFIG,
  NotificationLogEntry,
} from '@/lib/types'

const SETTINGS_FILE = path.join(process.cwd(), 'data', 'settings.json')

interface SettingsData {
  checklist_ppe_items?: ChecklistPpeItem[]
  notification_config?: NotificationConfig
  meal_config?: MealConfig
  notification_logs?: NotificationLogEntry[]
  [key: string]: any
}

// ── In-memory cache for speed ──
let memoryCache: SettingsData | null = null

async function readLocalSettings(): Promise<SettingsData> {
  try {
    const raw = await fs.readFile(SETTINGS_FILE, 'utf-8')
    memoryCache = JSON.parse(raw)
    return memoryCache || {}
  } catch {
    return {
      checklist_ppe_items: DEFAULT_CHECKLIST_PPE_ITEMS,
      notification_config: DEFAULT_NOTIFICATION_CONFIG,
      meal_config: DEFAULT_MEAL_CONFIG,
    }
  }
}

async function writeLocalSettings(data: SettingsData): Promise<void> {
  memoryCache = data
  try {
    const dir = path.dirname(SETTINGS_FILE)
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(data, null, 2), 'utf-8')
  } catch (err) {
    console.warn('[settings-store] writeLocalSettings error:', err)
  }
}

// ── Get Checklist PPE Items ──
export async function getPpeChecklistItems(): Promise<ChecklistPpeItem[]> {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('settings')
      .select('data')
      .eq('id', 'checklist_ppe_items')
      .maybeSingle()

    if (!error && data && Array.isArray(data.data) && data.data.length > 0) {
      return data.data as ChecklistPpeItem[]
    }
  } catch (err) {
    // Supabase table may not exist yet, fallback to local
  }

  const local = await readLocalSettings()
  if (local.checklist_ppe_items && local.checklist_ppe_items.length > 0) {
    return local.checklist_ppe_items
  }

  return DEFAULT_CHECKLIST_PPE_ITEMS
}

// ── Save Checklist PPE Items ──
export async function savePpeChecklistItems(items: ChecklistPpeItem[]): Promise<ChecklistPpeItem[]> {
  // 1. Save to local fallback first
  const current = await readLocalSettings()
  current.checklist_ppe_items = items
  await writeLocalSettings(current)

  // 2. Try saving to Supabase settings table
  try {
    const supabase = createServiceClient()
    await supabase
      .from('settings')
      .upsert({
        id: 'checklist_ppe_items',
        data: items,
        updated_at: new Date().toISOString(),
      })
  } catch (err) {
    console.warn('[settings-store] Supabase upsert error (using local fallback):', err)
  }

  return items
}

function applyEnvFallbacks(config: NotificationConfig): NotificationConfig {
  return {
    ...config,
    line_channel_access_token:
      config.line_channel_access_token || process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
    line_target_id:
      config.line_target_id || process.env.LINE_TARGET_ID || '',
    line_liff_id:
      config.line_liff_id || process.env.NEXT_PUBLIC_LIFF_ID || '',
    telegram_bot_token:
      config.telegram_bot_token || process.env.TELEGRAM_BOT_TOKEN || '',
    telegram_chat_id:
      config.telegram_chat_id || process.env.TELEGRAM_CHAT_ID || '',
  }
}

// ── Get Notification Config ──
export async function getNotificationConfig(): Promise<NotificationConfig> {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('settings')
      .select('data')
      .eq('id', 'notification_config')
      .maybeSingle()

    if (!error && data && data.data && typeof data.data === 'object') {
      return applyEnvFallbacks({ ...DEFAULT_NOTIFICATION_CONFIG, ...data.data } as NotificationConfig)
    }
  } catch (err) {
    // Supabase error, fallback to local
  }

  const local = await readLocalSettings()
  if (local.notification_config && typeof local.notification_config === 'object') {
    return applyEnvFallbacks({ ...DEFAULT_NOTIFICATION_CONFIG, ...local.notification_config })
  }

  return applyEnvFallbacks(DEFAULT_NOTIFICATION_CONFIG)
}

// ── Save Notification Config ──
export async function saveNotificationConfig(cfg: Partial<NotificationConfig>): Promise<NotificationConfig> {
  const merged: NotificationConfig = { ...DEFAULT_NOTIFICATION_CONFIG, ...cfg }

  // 1. Save to local fallback first
  const current = await readLocalSettings()
  current.notification_config = merged
  await writeLocalSettings(current)

  // 2. Try saving to Supabase settings table
  try {
    const supabase = createServiceClient()
    const { error } = await supabase
      .from('settings')
      .upsert({
        id: 'notification_config',
        data: merged,
        updated_at: new Date().toISOString(),
      })
    if (error) {
      console.warn('[settings-store] Supabase upsert notification_config error:', error.message)
    }
  } catch (err: any) {
    console.warn('[settings-store] Supabase upsert notification_config error:', err?.message || err)
  }

  return merged
}

// ── Get Meal Allowance Config ──
export async function getMealConfig(): Promise<MealConfig> {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('settings')
      .select('data')
      .eq('id', 'meal_config')
      .maybeSingle()

    if (!error && data && data.data && typeof data.data === 'object') {
      return { ...DEFAULT_MEAL_CONFIG, ...data.data } as MealConfig
    }
  } catch (err) {
    // Supabase error, fallback to local
  }

  const local = await readLocalSettings()
  if (local.meal_config && typeof local.meal_config === 'object') {
    return { ...DEFAULT_MEAL_CONFIG, ...local.meal_config }
  }

  return DEFAULT_MEAL_CONFIG
}

// ── Save Meal Allowance Config ──
export async function saveMealConfig(cfg: Partial<MealConfig>): Promise<MealConfig> {
  const merged: MealConfig = { ...DEFAULT_MEAL_CONFIG, ...cfg }

  // 1. Save to local fallback first
  const current = await readLocalSettings()
  current.meal_config = merged
  await writeLocalSettings(current)

  // 2. Try saving to Supabase settings table
  try {
    const supabase = createServiceClient()
    await supabase
      .from('settings')
      .upsert({
        id: 'meal_config',
        data: merged,
        updated_at: new Date().toISOString(),
      })
  } catch (err) {
    console.warn('[settings-store] Supabase upsert meal_config error:', err)
  }

  return merged
}

// ── Notification Logs Store ──
export async function getNotificationLogs(limit = 30): Promise<NotificationLogEntry[]> {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('settings')
      .select('data')
      .eq('id', 'notification_logs')
      .maybeSingle()

    if (!error && data && Array.isArray(data.data)) {
      return (data.data as NotificationLogEntry[]).slice(0, limit)
    }
  } catch (err) {
    // Supabase fallback to local
  }

  const local = await readLocalSettings()
  if (Array.isArray(local.notification_logs)) {
    return local.notification_logs.slice(0, limit)
  }

  return []
}

export async function addNotificationLog(
  entry: Omit<NotificationLogEntry, 'id' | 'timestamp' | 'formatted_time'>
): Promise<NotificationLogEntry> {
  const now = new Date()
  const bkkTime = new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(now)

  const newLog: NotificationLogEntry = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: now.toISOString(),
    formatted_time: bkkTime,
    ...entry,
  }

  // 1. Save to local fallback first
  const current = await readLocalSettings()
  const currentLogs: NotificationLogEntry[] = Array.isArray(current.notification_logs)
    ? current.notification_logs
    : []
  const updatedLogs = [newLog, ...currentLogs].slice(0, 50)
  current.notification_logs = updatedLogs
  await writeLocalSettings(current)

  // 2. Save to Supabase settings table
  try {
    const supabase = createServiceClient()
    await supabase
      .from('settings')
      .upsert({
        id: 'notification_logs',
        data: updatedLogs,
        updated_at: now.toISOString(),
      })
  } catch (err) {
    console.warn('[settings-store] Supabase upsert notification_logs error:', err)
  }

  return newLog
}

export async function clearNotificationLogs(): Promise<void> {
  const current = await readLocalSettings()
  current.notification_logs = []
  await writeLocalSettings(current)

  try {
    const supabase = createServiceClient()
    await supabase
      .from('settings')
      .upsert({
        id: 'notification_logs',
        data: [],
        updated_at: new Date().toISOString(),
      })
  } catch (err) {
    console.warn('[settings-store] Supabase clear notification_logs error:', err)
  }
}


