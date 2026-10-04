export type UserRole = 'admin' | 'supervisor' | 'viewer'

export interface UserProfile {
  id: string
  email: string | null
  full_name: string | null
  role: UserRole
  phone?: string | null
  department?: string | null
  line_group?: string | null
  is_active?: boolean
  created_at: string
  updated_at: string
}

export interface Company {
  id: string
  name: string
  code: string | null
  phone?: string | null
  line_group?: string | null
  created_at: string
}

export function cleanCompanyCode(code?: string | null): string | null {
  if (!code) return null
  const cleaned = code
    .replace(/\[(?:TEL|PHONE):?\s*[^\]]+\]/gi, '')
    .replace(/\[(?:LINE|GROUP):?\s*[^\]]+\]/gi, '')
    .trim()
  return cleaned || null
}

export function getCompanyPhone(c?: Partial<Company> | null): string {
  if (!c) return ''
  if (c.phone) return c.phone
  if (c.code) {
    const match = c.code.match(/\[(?:TEL|PHONE):?\s*([^\]]+)\]/i)
    if (match) return match[1].trim()
  }
  return ''
}

export function getCompanyLineGroup(c?: Partial<Company> | null): string {
  if (!c) return ''
  if (c.line_group) return c.line_group
  if (c.code) {
    const match = c.code.match(/\[(?:LINE|GROUP):?\s*([^\]]+)\]/i)
    if (match) return match[1].trim()
  }
  return ''
}

export function formatCompanyCodePayload(
  code?: string | null,
  phone?: string | null,
  lineGroup?: string | null
): string | null {
  const baseCode = cleanCompanyCode(code) || ''
  const tags: string[] = []
  if (phone?.trim()) tags.push(`[TEL:${phone.trim()}]`)
  if (lineGroup?.trim()) tags.push(`[LINE:${lineGroup.trim()}]`)

  if (tags.length === 0) return baseCode || null
  return `${baseCode} ${tags.join(' ')}`.trim()
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
  line_liff_id?: string

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
  line_liff_id: '',
  telegram_enabled: false,
  telegram_bot_token: '',
  telegram_chat_id: '',
  schedule_enabled: true,
  schedule_times: ['08:50', '10:30'],
  schedule_mode: 'flex',
  cron_secret: 'sitecheck-cron-secret',
}

// ── Meal Allowance & Catering Configuration (Feature Toggle for future) ──
export interface MealConfig {
  enabled: boolean            // เปิดใช้งานระบบเบิกค่าอาหารและข้าวกล่องหรือไม่ (ค่าเริ่มต้น: false)
  price_per_meal: number      // อัตราค่าอาหารต่อคน/มื้อ (บาท) เช่น 60
  allow_ot_dinner: boolean    // เปิดตัวเลือกมื้อเย็น/OT หรือไม่
  ot_price_per_meal: number   // อัตราค่าอาหารมื้อเย็น/OT (บาท) เช่น 70
  cut_off_time: string        // เวลาตัดรอบสรุปยอดสั่งข้าว เช่น '10:00'
  catering_shop_name?: string // ชื่อร้านข้าวประจำ
  catering_phone?: string     // เบอร์โทรร้านข้าว
  line_notify_template?: string // ข้อความสำหรับส่งไลน์สั่งข้าว
}

export const DEFAULT_MEAL_CONFIG: MealConfig = {
  enabled: false,             // ปิดการทำงานไว้เป็นค่าเริ่มต้น (ซ่อนจากหน้าจอ)
  price_per_meal: 60,
  allow_ot_dinner: false,
  ot_price_per_meal: 70,
  cut_off_time: '10:00',
  catering_shop_name: '',
  catering_phone: '',
  line_notify_template: '🍱 สรุปยอดสั่งข้าวกล่อง โครงการ\nประจำวันที่: {date}\nรวมทั้งหมด: {total} กล่อง\n{breakdown}\n\nกรุณาส่งก่อน 11:45 น. ขอบคุณครับ',
}


