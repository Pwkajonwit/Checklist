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
  'ไม่มา',
  'ขอเข้า 08:30',
  'ขอเข้า 09:00',
  'ขอเข้า 09:30',
  'ขอเข้า 10:00',
  'ขอออกก่อนเวลา (16:00)',
  'ขอทำงานล่วงเวลา (OT ถึง 20:00)',
  'ขอทำงานกะดึก',
  'เข้าปฏิบัติงานตามปกติ',
]

export type ALCResult = string // e.g. '0', '>0', 'ไม่ได้ตรวจ', '0.02%', etc.

export const isAlcoholPassed = (val?: string | null): boolean => {
  if (!val) return true
  const trimmed = val.trim()
  if (!trimmed || trimmed === '0%' || trimmed === '0' || trimmed === '0.00' || trimmed === '0.00%' || trimmed === 'ไม่ได้ตรวจ') return true
  const num = parseFloat(trimmed.replace(/[%mg]/gi, '').trim())
  if (!isNaN(num)) return num === 0
  return trimmed === '0%'
}

export const isAlcoholFailed = (val?: string | null): boolean => {
  if (!val) return false
  const trimmed = val.trim()
  if (!trimmed || trimmed === 'ไม่ได้ตรวจ') return false
  return !isAlcoholPassed(val)
}

export const normalizeAlcForDb = (val?: string | null): string => {
  if (!val) return '0%'
  const trimmed = val.trim()
  if (!trimmed || trimmed === '0' || trimmed === '0%' || trimmed === '0.00' || trimmed === '0.00%') return '0%'
  if (trimmed === 'ไม่ได้ตรวจ') return 'ไม่ได้ตรวจ'
  if (isAlcoholFailed(trimmed)) return '>0%'
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
