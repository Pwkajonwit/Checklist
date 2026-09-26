import { promises as fs } from 'fs'
import path from 'path'
import { createServiceClient } from '@/lib/supabase/service'
import { ChecklistPpeItem, DEFAULT_CHECKLIST_PPE_ITEMS, NotificationConfig, DEFAULT_NOTIFICATION_CONFIG } from '@/lib/types'

const SETTINGS_FILE = path.join(process.cwd(), 'data', 'settings.json')

interface SettingsData {
  checklist_ppe_items?: ChecklistPpeItem[]
  notification_config?: NotificationConfig
  [key: string]: any
}

// ── In-memory cache for speed ──
let memoryCache: SettingsData | null = null

async function readLocalSettings(): Promise<SettingsData> {
  if (memoryCache) return memoryCache
  try {
    const raw = await fs.readFile(SETTINGS_FILE, 'utf-8')
    memoryCache = JSON.parse(raw)
    return memoryCache || {}
  } catch {
    return {
      checklist_ppe_items: DEFAULT_CHECKLIST_PPE_ITEMS,
      notification_config: DEFAULT_NOTIFICATION_CONFIG,
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
      return { ...DEFAULT_NOTIFICATION_CONFIG, ...data.data } as NotificationConfig
    }
  } catch (err) {
    // Supabase error, fallback to local
  }

  const local = await readLocalSettings()
  if (local.notification_config && typeof local.notification_config === 'object') {
    return { ...DEFAULT_NOTIFICATION_CONFIG, ...local.notification_config }
  }

  return DEFAULT_NOTIFICATION_CONFIG
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
    await supabase
      .from('settings')
      .upsert({
        id: 'notification_config',
        data: merged,
        updated_at: new Date().toISOString(),
      })
  } catch (err) {
    console.warn('[settings-store] Supabase upsert notification_config error:', err)
  }

  return merged
}

