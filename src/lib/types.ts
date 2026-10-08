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

export interface ContractorCertifications {
  insee_training_exp?: string | null
  boomlift_training_exp?: string | null
}

export interface ContractorDocuments {
  id_card: boolean        // บัตรประชาชน
  house_reg: boolean      // ทะเบียนบ้าน
  medical_cert: boolean   // ใบรับรองแพทย์
  social_security: boolean // ประกันสังคม
  consent_form: boolean   // ใบยินยอม
}

export const REQUIRED_DOCUMENT_LIST = [
  { id: 'id_card', label: 'บัตรประชาชน', shortLabel: 'บัตร ปชช.' },
  { id: 'house_reg', label: 'ทะเบียนบ้าน', shortLabel: 'ทะเบียนบ้าน' },
  { id: 'medical_cert', label: 'ใบรับรองแพทย์', shortLabel: 'ใบรับรองแพทย์' },
  { id: 'social_security', label: 'ประกันสังคม', shortLabel: 'ประกันสังคม' },
  { id: 'consent_form', label: 'ใบยินยอม', shortLabel: 'ใบยินยอม' },
] as const

export const DEFAULT_CONTRACTOR_DOCUMENTS: ContractorDocuments = {
  id_card: false,
  house_reg: false,
  medical_cert: false,
  social_security: false,
  consent_form: false,
}

export const DEFAULT_CONTRACTOR_CERTIFICATIONS: ContractorCertifications = {
  insee_training_exp: null,
  boomlift_training_exp: null,
}

export function cleanContractorPosition(pos?: string | null): string {
  if (!pos) return ''
  return pos
    .replace(/\[(?:เสี่ยง ALC|ALC_RISK|ALC)\]/gi, '')
    .replace(/\[(?:ค่าแรง|WAGE):?\s*\d+\]/gi, '')
    .replace(/\[(?:INSEE_EXP|INSEE):?[^\]]*\]/gi, '')
    .replace(/\[(?:BOOMLIFT_EXP|BOOMLIFT):?[^\]]*\]/gi, '')
    .replace(/\[(?:DOCS|DOCUMENTS):?[^\]]*\]/gi, '')
    .trim()
}

export function getContractorCertifications(c?: Partial<Contractor> | null): ContractorCertifications {
  if (!c) return { ...DEFAULT_CONTRACTOR_CERTIFICATIONS }
  
  let insee: string | null = null
  let boomlift: string | null = null

  if (c.position) {
    const inseeMatch = c.position.match(/\[(?:INSEE_EXP|INSEE):?\s*([^\]]+)\]/i)
    if (inseeMatch && inseeMatch[1].trim()) insee = inseeMatch[1].trim()

    const boomMatch = c.position.match(/\[(?:BOOMLIFT_EXP|BOOMLIFT):?\s*([^\]]+)\]/i)
    if (boomMatch && boomMatch[1].trim()) boomlift = boomMatch[1].trim()
  }

  return {
    insee_training_exp: insee,
    boomlift_training_exp: boomlift,
  }
}

export function getContractorDocuments(c?: Partial<Contractor> | null): ContractorDocuments {
  if (!c) return { ...DEFAULT_CONTRACTOR_DOCUMENTS }

  const docs = { ...DEFAULT_CONTRACTOR_DOCUMENTS }

  if (c.position) {
    const docsMatch = c.position.match(/\[(?:DOCS|DOCUMENTS):?\s*([^\]]+)\]/i)
    if (docsMatch && docsMatch[1]) {
      const tokens = docsMatch[1].split(',').map(s => s.trim().toLowerCase())
      docs.id_card = tokens.includes('id_card') || tokens.includes('id')
      docs.house_reg = tokens.includes('house_reg') || tokens.includes('house')
      docs.medical_cert = tokens.includes('medical_cert') || tokens.includes('medical')
      docs.social_security = tokens.includes('social_security') || tokens.includes('social')
      docs.consent_form = tokens.includes('consent_form') || tokens.includes('consent')
    }
  }

  return docs
}

export function getTrainingExpiryStatus(expDateStr?: string | null): {
  status: 'none' | 'valid' | 'expiring_soon' | 'expired'
  daysLeft?: number
  label: string
} {
  if (!expDateStr || !expDateStr.trim()) {
    return { status: 'none', label: 'ไม่ได้ระบุ' }
  }

  // Parse YYYY-MM-DD
  const parts = expDateStr.trim().split('-').map(Number)
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return { status: 'none', label: 'วันที่ไม่ถูกต้อง' }
  }

  const expDate = new Date(parts[0], parts[1] - 1, parts[2])
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  expDate.setHours(0, 0, 0, 0)

  const diffMs = expDate.getTime() - today.getTime()
  const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (daysLeft < 0) {
    return { status: 'expired', daysLeft, label: `หมดอายุแล้ว (${Math.abs(daysLeft)} วัน)` }
  } else if (daysLeft <= 30) {
    return { status: 'expiring_soon', daysLeft, label: `ใกล้หมดอายุ (เหลือ ${daysLeft} วัน)` }
  } else {
    return { status: 'valid', daysLeft, label: `ปกติ (เหลือ ${daysLeft} วัน)` }
  }
}

export function getDocumentStats(docs: ContractorDocuments): {
  completedCount: number
  totalCount: number
  isComplete: boolean
  missingItems: Array<{ id: string; label: string; shortLabel: string }>
} {
  const missingItems = REQUIRED_DOCUMENT_LIST.filter(item => !docs[item.id as keyof ContractorDocuments])
  const completedCount = REQUIRED_DOCUMENT_LIST.length - missingItems.length
  return {
    completedCount,
    totalCount: REQUIRED_DOCUMENT_LIST.length,
    isComplete: completedCount === REQUIRED_DOCUMENT_LIST.length,
    missingItems: missingItems.map(m => ({ id: m.id, label: m.label, shortLabel: m.shortLabel })),
  }
}

export function formatContractorPositionPayload(
  cleanPosition?: string | null,
  options?: {
    dailyWage?: number | null
    alcRisk?: boolean | null
    certifications?: ContractorCertifications | null
    documents?: ContractorDocuments | null
  }
): string | null {
  const base = cleanContractorPosition(cleanPosition) || ''
  const tags: string[] = []

  if (options?.alcRisk) {
    tags.push('[เสี่ยง ALC]')
  }
  if (options?.dailyWage !== undefined && options?.dailyWage !== null && !isNaN(options?.dailyWage)) {
    tags.push(`[ค่าแรง:${options.dailyWage}]`)
  }
  if (options?.certifications?.insee_training_exp?.trim()) {
    tags.push(`[INSEE_EXP:${options.certifications.insee_training_exp.trim()}]`)
  }
  if (options?.certifications?.boomlift_training_exp?.trim()) {
    tags.push(`[BOOMLIFT_EXP:${options.certifications.boomlift_training_exp.trim()}]`)
  }
  if (options?.documents) {
    const obtained = REQUIRED_DOCUMENT_LIST
      .filter(item => options.documents![item.id as keyof ContractorDocuments])
      .map(item => item.id)
    if (obtained.length > 0) {
      tags.push(`[DOCS:${obtained.join(',')}]`)
    } else {
      tags.push('[DOCS:none]')
    }
  }

  if (tags.length === 0) return base || null
  return `${base} ${tags.join(' ')}`.trim()
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

export interface NotificationLogEntry {
  id: string
  timestamp: string
  formatted_time: string
  channel: 'line' | 'telegram' | 'all'
  title: string
  target: string
  success: boolean
  status_code?: number
  message?: string
  error?: string
  details?: any
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
  cut_off_time: string        // เวลาตัดรอบสรุปยอดสั่งข้าว เช่น '14:30'
  catering_shop_name?: string // ชื่อร้านข้าวประจำ
  catering_phone?: string     // เบอร์โทรร้านข้าว
  line_notify_template?: string // ข้อความสำหรับส่งไลน์สั่งข้าว
}

export const DEFAULT_MEAL_CONFIG: MealConfig = {
  enabled: false,             // ปิดการทำงานไว้เป็นค่าเริ่มต้น (ซ่อนจากหน้าจอ)
  price_per_meal: 60,
  allow_ot_dinner: false,
  ot_price_per_meal: 70,
  cut_off_time: '14:30',
  catering_shop_name: '',
  catering_phone: '',
  line_notify_template: '🍱 สรุปยอดสั่งข้าวกล่อง โครงการ\nประจำวันที่: {date}\nรวมทั้งหมด: {total} กล่อง\n{breakdown}\n\nกรุณาส่งก่อน 11:45 น. ขอบคุณครับ',
}


