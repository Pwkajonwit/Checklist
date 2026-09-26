export type UserRole = 'admin' | 'supervisor' | 'viewer'

export interface UserProfile {
  id: string
  email: string | null
  full_name: string | null
  role: UserRole
  phone?: string | null
  department?: string | null
  is_active?: boolean
  created_at: string
  updated_at: string
}

export interface Company {
  id: string
  name: string
  code: string | null
  created_at: string
}

export interface Contractor {
  id: string
  name: string
  company_id: string | null
  company_name: string | null
  employee_type: 'employee' | 'contractor'
  position: string | null
  phone: string | null
  daily_wage?: number | null
  alc_risk?: boolean | null
  is_active: boolean
  created_at: string
  updated_at: string
  companies?: Company
}

export function getContractorAlcRisk(c?: Partial<Contractor> | null): boolean {
  if (!c) return false
  if (c.alc_risk === true) return true
  if (c.position && (c.position.includes('[เสี่ยง ALC]') || c.position.includes('[ALC_RISK]') || c.position.includes('[ALC]'))) return true
  return false
}

export function getContractorDailyWage(c?: Partial<Contractor> | null): number | null {
  if (!c) return null
  if (typeof c.daily_wage === 'number' && !isNaN(c.daily_wage)) return c.daily_wage
  if (c.position) {
    const match = c.position.match(/\[(?:ค่าแรง|WAGE):?\s*(\d+)\]/i)
    if (match) return parseInt(match[1], 10)
  }
  return null
}

export function cleanContractorPosition(pos?: string | null): string {
  if (!pos) return ''
  return pos
    .replace(/\[(?:เสี่ยง ALC|ALC_RISK|ALC)\]/gi, '')
    .replace(/\[(?:ค่าแรง|WAGE):?\s*\d+\]/gi, '')
    .trim()
}

export interface Activity {
  id: string
  code?: string | null
  name: string
  tasks?: string | null // กิจกรรม / ระบบงาน เช่น งานปูกระเบื้อง (ใส่ได้หลายงาน)
  location: string | null
  is_active: boolean
  created_at: string
}

export const COMMON_TASK_PRESETS = [
  'งานปูกระเบื้อง',
  'งานฝ้าเพดาน',
  'งานก่ออิฐฉาบปูน',
  'งานทาสี',
  'งานระบบไฟฟ้า',
  'งานเชื่อมโครงสร้าง',
  'งานประปา / สุขาภิบาล',
  'งานโครงสร้างเหล็ก',
  'งานเทคอนกรีต',
  'งานติดตั้งกระจก/อะลูมิเนียม',
  'งานติดตั้งแอร์',
  'งานกันซึม / หลังคา',
  'งานทั่วไป',
]

export const PURPOSE_PRESETS = [
  'เข้าปฏิบัติงานตามปกติ',
  'ไม่มา',
  'ขอเข้า 08:30',
  'ขอเข้า 09:00',
  'ขอเข้า 09:30',
  'ขอเข้า 10:00',
]

export type ALCResult = string | null // ค่าตัวเลขปกติ เช่น '0', '25', หรือค่าว่าง null/'' เมื่อยังไม่ได้ตรวจ

export const isAlcoholUnchecked = (val?: string | null): boolean => {
  if (val === null || val === undefined) return true
  const trimmed = String(val).trim()
  return !trimmed || trimmed === 'ยังไม่ได้ตรวจ' || trimmed === 'ไม่ได้ตรวจ' || trimmed === '-'
}

export const isAlcoholPassed = (val?: string | null): boolean => {
  if (isAlcoholUnchecked(val)) return false
  const trimmed = String(val).trim()
  const num = parseFloat(trimmed.replace(/[%mg]/gi, '').trim())
  if (!isNaN(num)) return num === 0
  return trimmed === '0' || trimmed === '0%'
}

export const isAlcoholFailed = (val?: string | null): boolean => {
  if (isAlcoholUnchecked(val)) return false
  const trimmed = String(val).trim()
  const num = parseFloat(trimmed.replace(/[%mg]/gi, '').trim())
  if (!isNaN(num)) return num > 0
  return trimmed.startsWith('>') || trimmed.includes('เกิน')
}

export const normalizeAlcForDb = (val?: string | null): string | null => {
  if (isAlcoholUnchecked(val)) return 'ไม่ได้ตรวจ'
  const trimmed = String(val).trim()
  if (!trimmed || trimmed === 'ไม่ได้ตรวจ') return 'ไม่ได้ตรวจ'
  if (trimmed === '0%' || trimmed === '0' || trimmed === '0.0' || trimmed === '0.00') return '0%'
  if (trimmed === '>0%' || trimmed.startsWith('>') || trimmed.includes('เกิน')) return '>0%'
  const num = parseFloat(trimmed.replace(/[%mg]/gi, '').trim())
  if (!isNaN(num)) {
    return num > 0 ? '>0%' : '0%'
  }
  return '0%'
}

export type EntryStatus = 'active' | 'checked_out' | 'cancelled'

export interface ChecklistEntry {
  id: string
  entry_date: string
  contractor_id: string | null
  contractor_name: string
  company_name: string | null
  supervisor: string | null
  purpose: string | null
  check_in_time: string | null
  check_out_time: string | null
  card_code: string | null
  card_name: string | null
  activity_id: string | null
  activity_name: string | null
  location: string | null
  alc_result: ALCResult
  ppe_helmet: boolean
  ppe_vest: boolean
  ppe_shirt: boolean
  ppe_gloves: boolean
  ppe_shoes: boolean
  is_blacklisted: boolean
  noise_area: boolean
  daily_wage: number | null
  meal_allowance: boolean
  status: EntryStatus
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  contractors?: Contractor
  activities?: Activity
}

export interface ChecklistEntryFormData {
  contractor_id?: string
  contractor_name: string
  company_name?: string
  supervisor?: string
  purpose?: string
  check_in_time?: string
  check_out_time?: string
  card_code?: string
  card_name?: string
  activity_id?: string
  activity_name?: string
  location?: string
  alc_result: ALCResult
  ppe_helmet: boolean
  ppe_vest: boolean
  ppe_shirt: boolean
  ppe_gloves: boolean
  ppe_shoes: boolean
  is_blacklisted: boolean
  noise_area: boolean
  daily_wage?: number | null
  meal_allowance: boolean
  notes?: string
}

export interface DashboardStats {
  total_today: number
  checked_out: number
  active: number
  alc_positive: number
  ppe_incomplete: number
  blacklisted: number
}

// ── Dynamic Checklist PPE Item Configuration ──
export interface ChecklistPpeItem {
  id: string          // unique key (e.g. 'helmet', 'vest', 'glasses', 'gloves', 'shoes', or custom)
  label: string       // ชื่ออุปกรณ์ (e.g. 'หมวก', 'กั๊ก', 'แว่นตา')
  icon: string        // emoji or icon string (e.g. '⛑️', '🦺', '🥽')
  required: boolean   // ต้องมีเพื่อผ่านการตรวจ
  is_active: boolean  // สถานะเปิดใช้งาน
  sort_order: number  // ลำดับการแสดงผล
}

export const DEFAULT_CHECKLIST_PPE_ITEMS: ChecklistPpeItem[] = [
  { id: 'helmet', label: 'หมวก', icon: '⛑️', required: true, is_active: true, sort_order: 1 },
  { id: 'vest', label: 'กั๊ก', icon: '🦺', required: true, is_active: true, sort_order: 2 },
  { id: 'glasses', label: 'แว่นตา', icon: '🥽', required: true, is_active: true, sort_order: 3 },
  { id: 'gloves', label: 'ถุงมือ', icon: '🧤', required: true, is_active: true, sort_order: 4 },
  { id: 'shoes', label: 'รองเท้า', icon: '👢', required: true, is_active: true, sort_order: 5 },
]

// ── Notification Configuration (LINE OA & Telegram & Schedule) ──
export interface NotificationConfig {
  line_enabled: boolean
  line_channel_access_token: string
  line_target_id: string
  line_broadcast: boolean

  telegram_enabled: boolean
  telegram_bot_token: string
  telegram_chat_id: string

  schedule_enabled: boolean
  schedule_times: string[]
  schedule_mode: 'flex' | 'text'
  cron_secret: string
}

export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
  line_enabled: true,
  line_channel_access_token: '',
  line_target_id: '',
  line_broadcast: false,
  telegram_enabled: false,
  telegram_bot_token: '',
  telegram_chat_id: '',
  schedule_enabled: true,
  schedule_times: ['09:00', '12:00', '17:00'],
  schedule_mode: 'flex',
  cron_secret: 'sitecheck-cron-secret',
}

