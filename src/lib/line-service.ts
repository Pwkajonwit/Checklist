import type { ChecklistEntry, Contractor, Company, Activity, MealConfig } from '@/lib/types'
import { isAlcoholPassed, cleanCompanyCode } from '@/lib/types'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'

export interface MemberStatusDetail {
  name: string
  position?: string
  status: 'passed' | 'failed' | 'missing'
  checkInTime?: string | null
  purpose?: string | null
  alcResult?: string | null
  failReason?: string | null
}

export interface CompanyProjectGroup {
  activityId?: string | null
  activityName: string
  activityCode?: string | null
  activityTag?: string | null
  location?: string | null
  checkedInCount: number
  passedCount: number
  failedCount: number
  alcCount: number
  ppeFailedCount: number
  lateOrRequestsCount: number
  lateOrRequests: {
    name: string
    purpose: string
    checkInTime?: string | null
    location?: string | null
    companyCode?: string | null
  }[]
  failedMembers: { name: string; reason: string; checkInTime?: string | null }[]
  checkedInMembers: { name: string; checkInTime?: string | null }[]
  membersDetails: MemberStatusDetail[]
  mealCount?: number
}

export interface ActiveProjectRow {
  companyName: string
  companyCode?: string | null
  activityId?: string | null
  activityName: string
  activityCode?: string | null
  activityTag?: string | null
  location?: string | null
  checkedInCount: number
  passedCount: number
  failedCount: number
  alcCount: number
  ppeFailedCount: number
  lateOrRequestsCount: number
  lateOrRequests: {
    name: string
    purpose: string
    checkInTime?: string | null
    location?: string | null
    companyCode?: string | null
  }[]
  failedMembers: { name: string; reason: string; checkInTime?: string | null }[]
  mealCount?: number
}

export interface InactiveCompanySummary {
  companyName: string
  companyCode?: string | null
  totalRegistered: number
}

export interface CompanySummary {
  companyName: string
  companyCode?: string | null
  activityName?: string | null
  activityCode?: string | null
  activityTag?: string | null
  location?: string | null
  totalRegistered: number
  checkedInCount: number
  passedCount: number
  failedCount: number
  alcCount: number
  ppeFailedCount: number
  missingCount: number
  lateOrRequests: {
    name: string
    purpose: string
    checkInTime?: string | null
    location?: string | null
    companyCode?: string | null
  }[]
  failedMembers: { name: string; reason: string; checkInTime?: string | null }[]
  missingMembers: string[]
  checkedInMembers: { name: string; checkInTime?: string | null }[]
  membersDetails: MemberStatusDetail[]
  projects: CompanyProjectGroup[]
  mealCount?: number
}

export interface DailyReportData {
  date: string
  totalRegistered: number
  totalCheckedIn: number
  totalPassed: number
  totalFailed: number
  totalAlcFailed: number
  totalPpeFailed: number
  totalMissing: number
  totalMeals: number
  mealsByCompany: Record<string, number>
  companies: CompanySummary[]
  activeProjectRows: ActiveProjectRow[]
  inactiveCompanies: InactiveCompanySummary[]
}

/**
 * คำนวณสรุปข้อมูล Checklist ประจำวัน แยกตามสาขา / บริษัท และแยกตามโครงการที่ลงทะเบียนปฏิบัติงาน
 */
export function buildDailyReportData(
  dateStr: string,
  entries: ChecklistEntry[],
  contractors: Contractor[],
  companies: Company[],
  activities: Activity[] = []
): DailyReportData {
  // Map company names
  const companyMap = new Map<string, Contractor[]>()

  contractors
    .filter(c => c.employee_type !== 'employee' && c.is_active)
    .forEach(c => {
      const compName = (c.company_name || 'รับจ้างอิสระ').trim()
      if (!companyMap.has(compName)) {
        companyMap.set(compName, [])
      }
      companyMap.get(compName)!.push(c)
    })

  // Entries map for target date
  const dateEntries = entries.filter(e => e.entry_date === dateStr)

  const companySummaries: CompanySummary[] = []

  let totalRegistered = 0
  let totalCheckedIn = 0
  let totalPassed = 0
  let totalFailed = 0
  let totalAlcFailed = 0
  let totalPpeFailed = 0
  let totalMissing = 0

  Array.from(companyMap.entries()).forEach(([compName, members]) => {
    const regCount = members.length
    totalRegistered += regCount

    const compObj = companies.find(c => c.name === compName || (c.code && c.code === compName))
    const compCode = cleanCompanyCode(compObj?.code) || ''

    // จัดกลุ่มพนักงานที่เข้างานตามโครงการ (activity + location)
    const projectMap = new Map<
      string,
      {
        activityId?: string | null
        activityName: string
        location: string
        membersWithEntry: { m: Contractor; entry: ChecklistEntry }[]
      }
    >()

    const missingList: string[] = []
    const allMembersDetails: MemberStatusDetail[] = []
    const allCheckedIn: { name: string; checkInTime?: string | null }[] = []
    const allLateOrReqs: {
      name: string
      purpose: string
      checkInTime?: string | null
      location?: string | null
      companyCode?: string | null
    }[] = []
    const allFailedList: { name: string; reason: string; checkInTime?: string | null }[] = []

    members.forEach(m => {
      const entry = dateEntries.find(
        e => (e.contractor_id && e.contractor_id === m.id) || e.contractor_name === m.name
      )

      if (entry) {
        const timeStr = entry.check_in_time ? entry.check_in_time.substring(0, 5) : null
        allCheckedIn.push({ name: m.name, checkInTime: timeStr })

        const actId = entry.activity_id || null
        const actName = entry.activity_name?.trim() || ''
        const loc = entry.location?.trim() || ''
        const projKey = `${actId || ''}:::${actName}:::${loc}`

        if (!projectMap.has(projKey)) {
          projectMap.set(projKey, {
            activityId: actId,
            activityName: actName,
            location: loc,
            membersWithEntry: [],
          })
        }
        projectMap.get(projKey)!.membersWithEntry.push({ m, entry })
      } else {
        missingList.push(m.name)
        allMembersDetails.push({
          name: m.name,
          position: m.position || undefined,
          status: 'missing',
        })
      }
    })

    const compCheckedCount = allCheckedIn.length
    const compMissingCount = regCount - compCheckedCount

    // ประมวลผลรายละเอียดแต่ละโครงการย่อยภายใต้ทีมนี้
    const projectGroups: CompanyProjectGroup[] = []

    projectMap.forEach(projData => {
      const actObj = activities.find(
        a =>
          (projData.activityId && a.id === projData.activityId) ||
          (projData.activityName && a.name === projData.activityName)
      )
      const actCode = actObj?.code ? actObj.code.trim() : ''
      const code = actCode || compCode
      const finalActName = projData.activityName || actObj?.name || compName
      const finalLocation = projData.location || actObj?.location?.trim() || ''

      let activityTag = ''
      if (finalActName && code) {
        activityTag = `[${code}] ${finalActName}`
      } else if (finalActName) {
        activityTag = finalActName
      } else if (code) {
        activityTag = `[${code}]`
      }

      let projPassed = 0
      let projFailed = 0
      let projAlcFailed = 0
      let projPpeFailed = 0
      let projMeals = 0
      const projCheckedIn: { name: string; checkInTime?: string | null }[] = []
      const projLateOrReqs: {
        name: string
        purpose: string
        checkInTime?: string | null
        location?: string | null
        companyCode?: string | null
      }[] = []
      const projFailedList: { name: string; reason: string; checkInTime?: string | null }[] = []
      const projMembersDetails: MemberStatusDetail[] = []

      projData.membersWithEntry.forEach(({ m, entry }) => {
        const timeStr = entry.check_in_time ? entry.check_in_time.substring(0, 5) : null
        projCheckedIn.push({ name: m.name, checkInTime: timeStr })

        if (entry.meal_allowance) {
          projMeals += 1
        }

        if (entry.purpose && entry.purpose.trim()) {
          const reqItem = {
            name: m.name,
            purpose: entry.purpose.trim(),
            checkInTime: timeStr,
            location: finalLocation || null,
            companyCode: compCode || null,
          }
          projLateOrReqs.push(reqItem)
          allLateOrReqs.push(reqItem)
        }

        const isAlcPass = isAlcoholPassed(entry.alc_result)
        const isPpePass =
          entry.ppe_helmet &&
          entry.ppe_vest &&
          entry.ppe_shirt &&
          entry.ppe_gloves &&
          entry.ppe_shoes

        if (isAlcPass && isPpePass) {
          projPassed += 1
          const memDetail: MemberStatusDetail = {
            name: m.name,
            position: m.position || undefined,
            status: 'passed',
            checkInTime: timeStr,
            purpose: entry.purpose || undefined,
            alcResult: entry.alc_result,
          }
          projMembersDetails.push(memDetail)
          allMembersDetails.push(memDetail)
        } else {
          projFailed += 1
          if (!isAlcPass) projAlcFailed += 1
          if (!isPpePass) projPpeFailed += 1

          const reasons: string[] = []
          if (!isAlcPass) reasons.push(`ALC ${entry.alc_result}`)
          if (!isPpePass) {
            const missingPpe: string[] = []
            if (!entry.ppe_helmet) missingPpe.push('หมวก')
            if (!entry.ppe_vest) missingPpe.push('กั๊ก')
            if (!entry.ppe_shirt) missingPpe.push('แว่นตา')
            if (!entry.ppe_gloves) missingPpe.push('ถุงมือ')
            if (!entry.ppe_shoes) missingPpe.push('รองเท้า')
            reasons.push(`ขาด ${missingPpe.join('/')}`)
          }
          const failReason = reasons.join(', ')
          const failItem = { name: m.name, reason: failReason, checkInTime: timeStr }
          projFailedList.push(failItem)
          allFailedList.push(failItem)

          const memDetail: MemberStatusDetail = {
            name: m.name,
            position: m.position || undefined,
            status: 'failed',
            checkInTime: timeStr,
            purpose: entry.purpose || undefined,
            alcResult: entry.alc_result,
            failReason,
          }
          projMembersDetails.push(memDetail)
          allMembersDetails.push(memDetail)
        }
      })

      projectGroups.push({
        activityId: projData.activityId,
        activityName: finalActName,
        activityCode: code || null,
        activityTag: activityTag || null,
        location: finalLocation || null,
        checkedInCount: projCheckedIn.length,
        passedCount: projPassed,
        failedCount: projFailed,
        alcCount: projAlcFailed,
        ppeFailedCount: projPpeFailed,
        lateOrRequestsCount: projLateOrReqs.length,
        lateOrRequests: projLateOrReqs,
        failedMembers: projFailedList,
        checkedInMembers: projCheckedIn,
        membersDetails: projMembersDetails,
        mealCount: projMeals,
      })
    })

    const compPassed = projectGroups.reduce((sum, p) => sum + p.passedCount, 0)
    const compFailed = projectGroups.reduce((sum, p) => sum + p.failedCount, 0)
    const compAlcFailed = projectGroups.reduce((sum, p) => sum + p.alcCount, 0)
    const compPpeFailed = projectGroups.reduce((sum, p) => sum + p.ppeFailedCount, 0)
    const compMealCount = projectGroups.reduce((sum, p) => sum + (p.mealCount || 0), 0)

    totalCheckedIn += compCheckedCount
    totalPassed += compPassed
    totalFailed += compFailed
    totalAlcFailed += compAlcFailed
    totalPpeFailed += compPpeFailed
    totalMissing += compMissingCount

    const primaryProj = projectGroups[0]
    const compActivityTag = primaryProj?.activityTag || (compCode ? `[${compCode}]` : null)
    const compLocation = primaryProj?.location || null
    const compActivityName = primaryProj?.activityName || null
    const compActivityCode = primaryProj?.activityCode || (compCode || null)

    companySummaries.push({
      companyName: compName,
      companyCode: compCode || null,
      activityName: compActivityName,
      activityCode: compActivityCode,
      activityTag: compActivityTag,
      location: compLocation,
      totalRegistered: regCount,
      checkedInCount: compCheckedCount,
      passedCount: compPassed,
      failedCount: compFailed,
      alcCount: compAlcFailed,
      ppeFailedCount: compPpeFailed,
      missingCount: compMissingCount,
      lateOrRequests: allLateOrReqs,
      failedMembers: allFailedList,
      missingMembers: missingList,
      checkedInMembers: allCheckedIn,
      membersDetails: allMembersDetails,
      projects: projectGroups,
      mealCount: compMealCount,
    })
  })

  // เรียงลำดับ: ทีมที่เข้างานจริงขึ้นก่อน ตามด้วยทีมที่ไม่มา
  companySummaries.sort((a, b) => {
    if (b.checkedInCount !== a.checkedInCount) {
      return b.checkedInCount - a.checkedInCount
    }
    return a.companyName.localeCompare(b.companyName)
  })

  // แตกรายการกลุ่มงานที่ปฏิบัติจริง (Active Project Rows) และสรุปทีมที่ไม่มา (Inactive Companies)
  const activeProjectRows: ActiveProjectRow[] = []
  const inactiveCompanies: InactiveCompanySummary[] = []

  companySummaries.forEach(comp => {
    if (comp.checkedInCount > 0 && comp.projects && comp.projects.length > 0) {
      comp.projects.forEach(proj => {
        activeProjectRows.push({
          companyName: comp.companyName,
          companyCode: comp.companyCode,
          activityId: proj.activityId,
          activityName: proj.activityName,
          activityCode: proj.activityCode,
          activityTag: proj.activityTag,
          location: proj.location,
          checkedInCount: proj.checkedInCount,
          passedCount: proj.passedCount,
          failedCount: proj.failedCount,
          alcCount: proj.alcCount,
          ppeFailedCount: proj.ppeFailedCount,
          lateOrRequestsCount: proj.lateOrRequestsCount,
          lateOrRequests: proj.lateOrRequests,
          failedMembers: proj.failedMembers,
          mealCount: proj.mealCount,
        })
      })
    } else {
      inactiveCompanies.push({
        companyName: comp.companyName,
        companyCode: comp.companyCode,
        totalRegistered: comp.totalRegistered,
      })
    }
  })

  const totalMeals = companySummaries.reduce((sum, c) => sum + (c.mealCount || 0), 0)
  const mealsByCompany: Record<string, number> = {}
  companySummaries.forEach(c => {
    if (c.mealCount && c.mealCount > 0) {
      mealsByCompany[c.companyName] = c.mealCount
    }
  })

  return {
    date: dateStr,
    totalRegistered,
    totalCheckedIn,
    totalPassed,
    totalFailed,
    totalAlcFailed,
    totalPpeFailed,
    totalMissing,
    totalMeals,
    mealsByCompany,
    companies: companySummaries,
    activeProjectRows,
    inactiveCompanies,
  }
}

// ── Vercel Cron Fixed Rounds Definition & Helpers ──
export interface RoundInfo {
  slot: string
  name: string
  shortLabel: string
  icon: string
  headerTitle: string
  description: string
  color: string
  bgColor: string
  focusMeal?: boolean
}

export const VERCEL_CRON_ROUNDS: RoundInfo[] = [
  {
    slot: '08:50',
    name: 'เช็คชื่อ & ตรวจความปลอดภัย (ครั้งที่ 1)',
    shortLabel: 'เช็คครั้งแรก 08:50 น.',
    icon: '🌅',
    headerTitle: '🌅 เช็คชื่อ & ตรวจความปลอดภัย ครั้งที่ 1 (08:50 น.)',
    description: 'สรุปยอดคนเข้างาน ตรวจความพร้อม PPE และแอลกอฮอล์ช่วงเช้า',
    color: '#15803d',
    bgColor: '#166534',
  },
  {
    slot: '10:30',
    name: 'เช็คชื่อ & ติดตามหน้างาน (ครั้งที่ 2)',
    shortLabel: 'เช็คครั้งที่ 2 (10:30 น.)',
    icon: '📋',
    headerTitle: '📋 เช็คชื่อ & ติดตามหน้างาน ครั้งที่ 2 (10:30 น.)',
    description: 'อัปเดตยอดคนเข้างานเพิ่มเติม ติดตามผู้มาสายและความคืบหน้าหน้างาน',
    color: '#1d4ed8',
    bgColor: '#1e40af',
  },
  {
    slot: '14:30',
    name: 'สรุปยอดสั่งข้าวกล่อง (กับข้าว)',
    shortLabel: 'ตัดยอดข้าว 14:30 น.',
    icon: '🍱',
    headerTitle: '🍱 สรุปยอดสั่งข้าวกล่อง (กับข้าว)',
    description: 'สรุปยอดข้าวกล่องประจำวันแยกตามทีมช่าง ตัดรอบส่งร้านอาหาร',
    color: '#b45309',
    bgColor: '#9a3412',
    focusMeal: true,
  },
]

export function getRoundInfo(slotOrTime?: string | null): RoundInfo {
  let timeStr = slotOrTime ? slotOrTime.trim().substring(0, 5) : ''
  if (!timeStr || !/^\d{1,2}:\d{2}/.test(timeStr)) {
    const now = new Date()
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000
    const bkk = new Date(utcMs + 7 * 3600000)
    timeStr = `${String(bkk.getHours()).padStart(2, '0')}:${String(bkk.getMinutes()).padStart(2, '0')}`
  }

  // 1. Exact match with configured Vercel cron rounds
  const exact = VERCEL_CRON_ROUNDS.find(r => r.slot === timeStr)
  if (exact) return exact

  // 2. Fuzzy match based on time window
  const [hStr, mStr] = timeStr.split(':')
  const totalMinutes = parseInt(hStr, 10) * 60 + parseInt(mStr, 10)

  // 07:00 - 09:30 -> morning kickoff round (เช็คครั้งแรก)
  if (totalMinutes <= 9 * 60 + 30) {
    return {
      ...VERCEL_CRON_ROUNDS[0],
      shortLabel: `เช็คครั้งแรก (${timeStr} น.)`,
      headerTitle: `🌅 เช็คชื่อ & ตรวจความปลอดภัย ครั้งที่ 1 (${timeStr} น.)`,
    }
  }

  // 09:31 - 12:30 -> follow-up round (เช็คครั้งที่ 2)
  if (totalMinutes > 9 * 60 + 30 && totalMinutes <= 12 * 60 + 30) {
    return {
      ...VERCEL_CRON_ROUNDS[1],
      shortLabel: `เช็คครั้งที่ 2 (${timeStr} น.)`,
      headerTitle: `📋 เช็คชื่อ & ติดตามหน้างาน ครั้งที่ 2 (${timeStr} น.)`,
    }
  }

  // 12:31 - 16:30 -> afternoon meal round (14:30 น. สั่งข้าวกล่อง)
  if (totalMinutes > 12 * 60 + 30 && totalMinutes <= 16 * 60 + 30) {
    return {
      ...VERCEL_CRON_ROUNDS[2],
      shortLabel: `สั่งข้าว (${timeStr} น.)`,
      headerTitle: `🍱 สรุปยอดสั่งข้าวกล่อง (${timeStr} น.)`,
    }
  }



  // 3. Fallback for manual or custom execution
  return {
    slot: timeStr,
    name: `รอบอัปเดตหน้างาน (${timeStr} น.)`,
    shortLabel: `อัปเดต ${timeStr} น.`,
    icon: '📋',
    headerTitle: `📋 สรุปรายงานหน้างานประจำวัน (${timeStr} น.)`,
    description: 'รายงานสรุปสถานะการเข้างานและความปลอดภัยหน้างาน',
    color: '#0f172a',
    bgColor: '#1e293b',
  }
}

/**
 * สร้างข้อความแจ้งเตือนสรุปประจำวัน (LINE Text Message)
 */
export function formatDailyLineMessage(report: DailyReportData, slotOrTime?: string | null): string {
  let dText = report.date
  try {
    dText = format(new Date(report.date), 'EEEEที่ d MMMM yyyy', { locale: th })
  } catch {}

  const round = getRoundInfo(slotOrTime)
  const totalRequests = report.companies.reduce((sum, c) => sum + c.lateOrRequests.length, 0)
  const lines: string[] = []

  lines.push(`📋 [${round.headerTitle}]`)
  lines.push(`🎯 ${round.description}`)
  lines.push(`📅 วัน${dText}`)
  lines.push(`────────────────`)
  lines.push(`ทีมงานรวม ${report.totalPassed} | ไม่มา ${report.totalMissing} | ประสงค์ ${totalRequests}`)
  lines.push(`────────────────`)

  // หากเป็นรอบตัดยอดสั่งข้าวกล่อง (10:30 น.) ให้แสดงส่วนสรุปยอดข้าวขึ้นก่อนอย่างเด่นชัด
  if (round.focusMeal) {
    lines.push(`🍱 *** ยอดสั่งข้าวกล่องกลางวัน: รวม ${report.totalMeals || 0} กล่อง ***`)
    if (report.mealsByCompany && Object.keys(report.mealsByCompany).length > 0) {
      Object.entries(report.mealsByCompany).forEach(([comp, count]) => {
        lines.push(`   • ${comp}: ${count} กล่อง`)
      })
    } else {
      lines.push(`   (ยังไม่มียอดสั่งข้าวในรอบนี้)`)
    }
    lines.push(`────────────────`)
  }

  // 1. สรุปรายทีมที่ปฏิบัติงานจริง
  const activeCompanies = (report.companies || []).filter(c => c.checkedInCount > 0)

  if (activeCompanies.length > 0) {
    activeCompanies.forEach(comp => {
      if (comp.projects && comp.projects.length > 1) {
        lines.push(`🏢 ${comp.companyName} (แยก ${comp.projects.length} โครงการ • มา ${comp.passedCount} คน)`)
        comp.projects.forEach(proj => {
          const actStr = proj.activityTag ? ` ${proj.activityTag}` : ''
          const locStr = proj.location ? ` [📍 ${proj.location}]` : ''
          const stats: string[] = [`✓ มา ${proj.passedCount} คน`]
          if (proj.failedCount > 0) {
            const alcTag = proj.alcCount > 0 ? ' (ALC)' : ''
            stats.push(`⚠️ ไม่ผ่าน ${proj.failedCount} คน${alcTag}`)
          }
          if (proj.lateOrRequestsCount > 0) {
            stats.push(`📝 ประสงค์ ${proj.lateOrRequestsCount} คน`)
          }
          lines.push(`   •${actStr}${locStr} : ${stats.join(' | ')}`)
        })
      } else {
        const proj = comp.projects && comp.projects.length > 0 ? comp.projects[0] : null
        const actStr = proj?.activityTag || comp.activityTag ? `\n   🏗️ ${proj?.activityTag || comp.activityTag}` : ''
        const locStr = (proj?.location || comp.location) ? ` (📍 ${proj?.location || comp.location})` : ''
        const stats: string[] = [`✓ มา ${comp.passedCount} คน`]
        if (comp.failedCount > 0) {
          const alcTag = comp.alcCount > 0 ? ' (ALC)' : ''
          stats.push(`⚠️ ไม่ผ่าน ${comp.failedCount} คน${alcTag}`)
        }
        if (comp.lateOrRequests.length > 0) {
          stats.push(`📝 ประสงค์ ${comp.lateOrRequests.length} คน`)
        }
        lines.push(`🏢 ${comp.companyName}${locStr}${actStr}`)
        lines.push(`   ${stats.join(' | ')}`)
      }
    })
  } else {
    lines.push(`⏳ ยังไม่มีข้อมูลการเข้างานในวันนี้`)
  }
  lines.push(`────────────────`)

  // 2. สรุปทีมที่ไม่มีคนเข้างาน
  if (report.inactiveCompanies && report.inactiveCompanies.length > 0) {
    const inactiveNames = report.inactiveCompanies.map(c => c.companyName).join(', ')
    lines.push(`💤 ยังไม่มีคนเข้างาน (${report.inactiveCompanies.length} ทีม):`)
    lines.push(`   ${inactiveNames}`)
    lines.push(`────────────────`)
  }

  // 3. รายการแจ้งความประสงค์
  const allRequests = report.companies.flatMap(c =>
    c.lateOrRequests.map(r => ({
      name: r.name,
      purpose: r.purpose,
      checkInTime: r.checkInTime,
      companyName: c.companyName,
      companyCode: cleanCompanyCode(r.companyCode || c.companyCode) || '',
      location: r.location || c.location || '',
    }))
  )

  if (allRequests.length > 0) {
    lines.push(`📝 รายการแจ้งความประสงค์:`)
    allRequests.forEach(r => {
      const cleanCode = cleanCompanyCode(r.companyCode)
      const codeStr = cleanCode ? ` [${cleanCode}]` : ''
      const locStr = r.location ? ` | ${r.location}` : ''
      lines.push(`• ${r.companyName}${codeStr}: ${r.name}  ${r.purpose}${locStr}`)
    })
    lines.push(`────────────────`)
  }

  // 4. สรุปยอดสั่งข้าวกล่องประจำวัน (ถ้าไม่ได้แสดงที่ด้านบนไปแล้ว และมียอดข้าว)
  if (!round.focusMeal && report.totalMeals && report.totalMeals > 0) {
    lines.push(`🍱 สรุปยอดสั่งข้าวกล่อง: รวม ${report.totalMeals} กล่อง`)
    if (report.mealsByCompany) {
      Object.entries(report.mealsByCompany).forEach(([comp, count]) => {
        lines.push(`   • ${comp}: ${count} กล่อง`)
      })
    }
    lines.push(`────────────────`)
  }

  const now = new Date()
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000
  const bkk = new Date(utcMs + 7 * 3600000)
  const bangkokTime = `${String(bkk.getHours()).padStart(2, '0')}:${String(bkk.getMinutes()).padStart(2, '0')} น.`

  lines.push(`🕒 รายงานเมื่อ: ${bangkokTime} (${round.shortLabel})`)
  lines.push(`🛡️ ระบบ SiteCheck PRO`)

  return lines.join('\n')
}

/**
 * สร้าง LINE Flex Message:
 * - Bubble 1: การเข้า-ออก และตรวจสอบความปลอดภัยประจำวัน (Frame 2)
 * - Bubble 2: รายการแจ้งความประสงค์ (Frame 3)
 */
export function buildDailyLineFlexMessage(report: DailyReportData, slotOrTime?: string | null): any {
  let dText = report.date
  try {
    dText = format(new Date(report.date), 'd MMM yyyy', { locale: th })
  } catch {}

  const round = getRoundInfo(slotOrTime)
  const now = new Date()
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000
  const bkk = new Date(utcMs + 7 * 3600000)
  const currentTime = `${String(bkk.getHours()).padStart(2, '0')}:${String(bkk.getMinutes()).padStart(2, '0')} น.`
  const totalRequests = report.companies.reduce((sum, c) => sum + c.lateOrRequests.length, 0)

  // ══════════════════════════════════════════════════════════════════════════
  // 3 Summary Badges Box (แสดงบน Bubble แรก)
  // ══════════════════════════════════════════════════════════════════════════
  const summaryBadgesBox = {
    type: 'box',
    layout: 'horizontal',
    spacing: 'sm',
    contents: [
      {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#dcfce7',
        cornerRadius: '8px',
        paddingAll: '6px',
        paddingStart: '4px',
        paddingEnd: '4px',
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        contents: [
          {
            type: 'text',
            text: `เข้างาน ${report.totalPassed}`,
            size: 'xs',
            color: '#14532d',
            weight: 'bold',
            align: 'center',
            wrap: true,
          },
        ],
      },
      {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#fef3c7',
        cornerRadius: '8px',
        paddingAll: '6px',
        paddingStart: '4px',
        paddingEnd: '4px',
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        contents: [
          {
            type: 'text',
            text: `ไม่มา ${report.totalMissing}`,
            size: 'xs',
            color: '#92400e',
            weight: 'bold',
            align: 'center',
            wrap: true,
          },
        ],
      },
      {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#dbeafe',
        cornerRadius: '8px',
        paddingAll: '6px',
        paddingStart: '4px',
        paddingEnd: '4px',
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        contents: [
          {
            type: 'text',
            text: `ประสงค์ ${totalRequests}`,
            size: 'xs',
            color: '#1e40af',
            weight: 'bold',
            align: 'center',
            wrap: true,
          },
        ],
      },
    ],
  }


  // ══════════════════════════════════════════════════════════════════════════
  // Helper: วาดกล่องข้อมูลทีม (รองรับทั้งแบบโครงการเดียว และแยกหลายโครงการ)
  // ══════════════════════════════════════════════════════════════════════════
  const renderCompanyBox = (comp: CompanySummary) => {
    if (comp.projects && comp.projects.length > 1) {
      const subProjectsContents: any[] = comp.projects.map((proj, pIdx) => {
        const statElements: any[] = [
          {
            type: 'text',
            text: `✓ มา ${proj.passedCount}`,
            size: 'xs',
            weight: 'bold',
            color: '#16a34a',
            flex: 0,
          },
        ]

        if (proj.failedCount > 0) {
          const alcTag = proj.alcCount > 0 ? ' (ALC)' : ''
          statElements.push({
            type: 'text',
            text: `✕ ไม่ผ่าน ${proj.failedCount}${alcTag}`,
            size: 'xs',
            weight: 'bold',
            color: '#dc2626',
            flex: 0,
          })
        }

        if (proj.lateOrRequestsCount > 0) {
          statElements.push({
            type: 'text',
            text: `ประสงค์ ${proj.lateOrRequestsCount}`,
            size: 'xs',
            weight: 'bold',
            color: '#2563eb',
            flex: 0,
          })
        }

        if (proj.mealCount && proj.mealCount > 0) {
          statElements.push({
            type: 'text',
            text: `🍱 ข้าว ${proj.mealCount}`,
            size: 'xs',
            weight: 'bold',
            color: '#b45309',
            flex: 0,
          })
        }

        return {
          type: 'box',
          layout: 'vertical',
          spacing: 'xs',
          margin: pIdx > 0 ? 'sm' : 'none',
          contents: [
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                {
                  type: 'text',
                  text: proj.activityTag || proj.activityName,
                  weight: 'bold',
                  size: 'xs',
                  color: '#2563eb',
                  flex: 7,
                  wrap: true,
                },
                ...(proj.location
                  ? [
                      {
                        type: 'text',
                        text: `📍 ${proj.location}`,
                        size: 'xs',
                        color: '#475569',
                        align: 'end',
                        flex: 5,
                        wrap: false,
                      },
                    ]
                  : []),
              ],
            },
            {
              type: 'box',
              layout: 'horizontal',
              spacing: 'md',
              contents: statElements,
            },
          ],
        }
      })

      return {
        type: 'box',
        layout: 'vertical',
        spacing: 'xs',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            alignItems: 'center',
            contents: [
              {
                type: 'text',
                text: comp.companyName,
                weight: 'bold',
                size: 'sm',
                color: '#0f172a',
                flex: 7,
                wrap: false,
              },
              {
                type: 'text',
                text: `แยก ${comp.projects.length} โครงการ (มา ${comp.passedCount})`,
                size: 'xxs',
                weight: 'bold',
                color: '#0284c7',
                align: 'end',
                flex: 6,
              },
            ],
          },
          {
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#f8fafc',
            cornerRadius: '6px',
            paddingAll: '8px',
            margin: 'xs',
            contents: subProjectsContents,
          },
        ],
      }
    }

    // กรณีทีมทำโครงการเดียวตามปกติ
    const proj = comp.projects && comp.projects.length > 0 ? comp.projects[0] : null
    const actTag = proj?.activityTag || comp.activityTag || ''
    const loc = proj?.location || comp.location || ''

    const statElements: any[] = [
      {
        type: 'text',
        text: `✓ มา ${comp.passedCount}`,
        size: 'xs',
        weight: 'bold',
        color: '#16a34a',
        flex: 0,
      },
    ]

    if (comp.failedCount > 0) {
      const alcTag = comp.alcCount > 0 ? ' (ALC)' : ''
      statElements.push({
        type: 'text',
        text: `✕ ไม่ผ่าน ${comp.failedCount}${alcTag}`,
        size: 'xs',
        weight: 'bold',
        color: '#dc2626',
        flex: 0,
      })
    }

    if (comp.lateOrRequests.length > 0) {
      statElements.push({
        type: 'text',
        text: `ประสงค์ ${comp.lateOrRequests.length}`,
        size: 'xs',
        weight: 'bold',
        color: '#2563eb',
        flex: 0,
      })
    }

    if (comp.mealCount && comp.mealCount > 0) {
      // meal stat removed — handled by Settings Flex card only
    }

    return {
      type: 'box',
      layout: 'vertical',
      spacing: 'xs',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            {
              type: 'text',
              text: comp.companyName,
              weight: 'bold',
              size: 'sm',
              color: '#0f172a',
              flex: 7,
              wrap: false,
            },
            ...(loc
              ? [
                  {
                    type: 'text',
                    text: `📍 ${loc}`,
                    size: 'xs',
                    color: '#475569',
                    align: 'end',
                    flex: 5,
                    wrap: false,
                  },
                ]
              : []),
          ],
        },
        ...(actTag
          ? [
              {
                type: 'text',
                text: actTag,
                weight: 'bold',
                size: 'xs',
                color: '#2563eb',
                wrap: true,
              },
            ]
          : []),
        {
          type: 'box',
          layout: 'horizontal',
          spacing: 'md',
          contents: statElements,
        },
      ],
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // สร้าง Bubble สรุปการเข้างาน (แบ่งหลาย Bubble อัตโนมัติ หากทีมเกิน CHUNK_SIZE)
  // ══════════════════════════════════════════════════════════════════════════
  const CHUNK_SIZE = 7 // จำกัด 7 ทีมต่อ 1 Bubble เพื่อความสวยงาม สบายตา ไม่ล้นจอ
  const activeCompanies = (report.companies || []).filter(c => c.checkedInCount > 0)
  const overviewBubbles: any[] = []

  if (activeCompanies.length === 0) {
    overviewBubbles.push({
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: round.bgColor,
        paddingAll: '12px',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            alignItems: 'center',
            contents: [
              {
                type: 'text',
                text: round.shortLabel,
                size: 'xxs',
                weight: 'bold',
                color: '#ffffff',
                flex: 0,
              },
              {
                type: 'text',
                text: `🕒 ${currentTime}`,
                size: 'xxs',
                color: '#f8fafc',
                align: 'end',
              },
            ],
          },
          {
            type: 'text',
            text: round.headerTitle,
            weight: 'bold',
            color: '#ffffff',
            size: 'xs',
            wrap: true,
            margin: 'xs',
          },
          {
            type: 'text',
            text: round.description,
            size: 'xxs',
            color: '#f1f5f9',
            wrap: true,
            margin: 'xs',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '12px',
        spacing: 'md',
        contents: [
          summaryBadgesBox,
          {
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#f1f5f9',
            cornerRadius: '8px',
            paddingAll: '16px',
            alignItems: 'center',
            contents: [
              {
                type: 'text',
                text: '⏳ ยังไม่มีข้อมูลการเข้างานในวันนี้',
                size: 'sm',
                weight: 'bold',
                color: '#475569',
              },
              {
                type: 'text',
                text: 'ระบบจะอัปเดตอัตโนมัติเมื่อทีมงานเริ่มเช็คชื่อ',
                size: 'xs',
                color: '#94a3b8',
                margin: 'xs',
              },
            ],
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '10px',
        backgroundColor: '#f8fafc',
        contents: [
          {
            type: 'text',
            text: `รายงานเมื่อ: ${currentTime} วันที่ ${dText} • ${round.shortLabel}`,
            size: 'xxs',
            color: '#64748b',
            align: 'center',
          },
        ],
      },
    })
  } else {
    // แบ่งกลุ่มทีมที่เข้างานเป็น Chunks ทีละ 7 ทีม
    const companyChunks: CompanySummary[][] = []
    for (let i = 0; i < activeCompanies.length; i += CHUNK_SIZE) {
      companyChunks.push(activeCompanies.slice(i, i + CHUNK_SIZE))
    }

    const totalChunks = companyChunks.length

    companyChunks.forEach((chunk, chunkIdx) => {
      const isFirst = chunkIdx === 0
      const isLast = chunkIdx === totalChunks - 1

      const headerTitle =
        totalChunks > 1
          ? `การเข้า-ออก และตรวจสอบความปลอดภัย (${chunkIdx + 1}/${totalChunks})`
          : 'การเข้า-ออก และตรวจสอบความปลอดภัยประจำวัน'

      const chunkRows: any[] = []

      chunk.forEach((comp, idx) => {
        chunkRows.push(renderCompanyBox(comp))
        if (idx < chunk.length - 1) {
          chunkRows.push({
            type: 'separator',
            margin: 'sm',
          })
        }
      })

      // หากเป็น Bubble สุดท้าย และมีทีมที่ไม่มา ให้ใส่กล่องสรุปทีมที่ยังไม่เข้างานด้านล่าง
      if (isLast && report.inactiveCompanies && report.inactiveCompanies.length > 0) {
        const inactiveNames = report.inactiveCompanies
          .slice(0, 8)
          .map(c => c.companyName)
          .join(', ')
        const remainingCount = report.inactiveCompanies.length - 8
        const inactiveSummaryText =
          remainingCount > 0 ? `${inactiveNames} ...และอีก ${remainingCount} ทีม` : inactiveNames

        chunkRows.push({
          type: 'box',
          layout: 'vertical',
          backgroundColor: '#f8fafc',
          cornerRadius: '6px',
          paddingAll: '8px',
          margin: 'md',
          contents: [
            {
              type: 'text',
              text: `💤 ยังไม่มีคนเข้างาน (${report.inactiveCompanies.length} ทีม)`,
              size: 'xxs',
              weight: 'bold',
              color: '#64748b',
            },
            {
              type: 'text',
              text: inactiveSummaryText,
              size: 'xxs',
              color: '#94a3b8',
              wrap: true,
              margin: 'xs',
            },
          ],
        })
      }

      const bodyContents: any[] = []
      if (isFirst) {
        bodyContents.push(summaryBadgesBox)
      }

      bodyContents.push({
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        margin: isFirst ? 'md' : 'none',
        contents: chunkRows,
      })

      overviewBubbles.push({
        type: 'bubble',
        size: 'mega',
        header: {
          type: 'box',
          layout: 'vertical',
          backgroundColor: round.bgColor,
          paddingAll: '12px',
          contents: [
            {
              type: 'box',
              layout: 'horizontal',
              alignItems: 'center',
              contents: [
                {
                  type: 'text',
                  text: round.shortLabel,
                  size: 'xxs',
                  weight: 'bold',
                  color: '#ffffff',
                  flex: 0,
                },
                {
                  type: 'text',
                  text: `🕒 ${currentTime}`,
                  size: 'xxs',
                  color: '#f8fafc',
                  align: 'end',
                },
              ],
            },
            {
              type: 'text',
              text:
                totalChunks > 1
                  ? `${round.headerTitle} (${chunkIdx + 1}/${totalChunks})`
                  : round.headerTitle,
              weight: 'bold',
              color: '#ffffff',
              size: 'xs',
              wrap: true,
              margin: 'xs',
            },
            {
              type: 'text',
              text: round.description,
              size: 'xxs',
              color: '#f1f5f9',
              wrap: true,
              margin: 'xs',
            },
          ],
        },
        body: {
          type: 'box',
          layout: 'vertical',
          paddingAll: '12px',
          spacing: 'md',
          contents: bodyContents,
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          paddingAll: '10px',
          backgroundColor: '#f8fafc',
          contents: [
            {
              type: 'text',
              text: `รายงานเมื่อ: ${currentTime} วันที่ ${dText} • ${round.shortLabel}`,
              size: 'xxs',
              color: '#64748b',
              align: 'center',
            },
          ],
        },
      })
    })
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Bubble 2: รายการแจ้งความประสงค์ (ตาม Frame 3)
  // ══════════════════════════════════════════════════════════════════════════
  const allRequests = report.companies.flatMap(c =>
    c.lateOrRequests.map(r => ({
      name: r.name,
      purpose: r.purpose,
      checkInTime: r.checkInTime,
      companyName: c.companyName,
      companyCode: cleanCompanyCode(r.companyCode || c.companyCode) || '',
      location: r.location || c.location || '',
    }))
  )

  const requestRows: any[] = []

  if (allRequests.length === 0) {
    requestRows.push({
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#f0fdf4',
      cornerRadius: '8px',
      paddingAll: '16px',
      alignItems: 'center',
      contents: [
        {
          type: 'text',
          text: '✅ ทุกคนเข้าปฏิบัติงานตามปกติ',
          size: 'sm',
          weight: 'bold',
          color: '#15803d',
        },
        {
          type: 'text',
          text: 'ไม่มีผู้แจ้งความประสงค์พิเศษในวันนี้',
          size: 'xs',
          color: '#166534',
          margin: 'xs',
        },
      ],
    })
  } else {
    allRequests.slice(0, 10).forEach((r, idx) => {
      const compLabel = r.companyName

      requestRows.push({
        type: 'box',
        layout: 'vertical',
        spacing: 'xs',
        contents: [
          // Row 1: Company [ Code ] (Left) | สถานที่ (Right)
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: compLabel,
                weight: 'bold',
                size: 'sm',
                color: '#0f172a',
                flex: 7,
                wrap: true,
              },
              {
                type: 'text',
                text: 'สถานที่',
                weight: 'bold',
                size: 'sm',
                color: '#0f172a',
                align: 'end',
                flex: 3,
              },
            ],
          },
          // Row 2: Worker Name + Purpose (Left) | Location (Right)
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: `${r.name}   ${r.purpose}`,
                size: 'xs',
                color: '#0f172a',
                flex: 7,
                wrap: true,
              },
              {
                type: 'text',
                text: r.location || '-',
                size: 'xs',
                color: '#0f172a',
                align: 'end',
                flex: 3,
                wrap: true,
              },
            ],
          },
        ],
      })

      if (idx < Math.min(allRequests.length, 10) - 1) {
        requestRows.push({
          type: 'separator',
          margin: 'md',
        })
      }
    })

    if (allRequests.length > 10) {
      requestRows.push({
        type: 'text',
        text: `...และอีก ${allRequests.length - 10} รายการ`,
        size: 'xxs',
        color: '#64748b',
        align: 'center',
        margin: 'xs',
      })
    }
  }

  const requestsBubble = {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#e0f2fe',
      paddingAll: '12px',
      contents: [
        {
          type: 'text',
          text: 'รายการแจ้งความประสงค์',
          weight: 'bold',
          color: '#0f172a',
          size: 'sm',
        },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '12px',
      spacing: 'md',
      contents: requestRows,
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '10px',
      backgroundColor: '#f8fafc',
      contents: [
        {
          type: 'text',
          text: `รายงานเมื่อ: ${currentTime} วันที่ ${dText}`,
          size: 'xxs',
          color: '#64748b',
          align: 'center',
        },
      ],
    },
  }

  // รวม Bubble สรุปการเข้างาน (แบ่งหน้าอัตโนมัติ) + Bubble รายการแจ้งความประสงค์
  const totalBubbles = [...overviewBubbles, requestsBubble]

  return {
    type: 'flex',
    altText: `📋 สรุปรายการเช็คชื่อประจำวัน (${dText})`,
    contents: {
      type: 'carousel',
      contents: totalBubbles,
    },
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. FLEX MESSAGE & TEXT GENERATOR: สรุปยอดสั่งข้าวกล่อง (รอบ 14:30 น.)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * สร้าง LINE Flex Message สำหรับสรุปยอดสั่งข้าวกล่อง ยอดจริงแยกตามทีมช่าง
 */
export function buildMealLineFlexMessage(
  report: DailyReportData,
  mealConfig?: Partial<MealConfig> | null
): any {
  let dText = report.date
  try {
    dText = format(new Date(report.date), 'd MMMM yyyy', { locale: th })
  } catch {}

  const pricePerMeal = mealConfig?.price_per_meal ?? 60
  const shopName = mealConfig?.catering_shop_name || 'ร้านข้าวประจำ'
  const totalMeals = report.totalMeals || 0
  const totalCost = totalMeals * pricePerMeal

  // Build breakdown rows from real report.mealsByCompany
  const breakdownRows = Object.entries(report.mealsByCompany || {}).map(([name, cnt], idx) => ({
    type: 'box',
    layout: 'horizontal',
    justifyContent: 'space-between',
    margin: idx === 0 ? 'none' : 'sm',
    contents: [
      { type: 'text', text: `${idx + 1}. ${name}`, size: 'sm', color: '#451a03', flex: 7, wrap: true },
      { type: 'text', text: `${cnt} กล่อง`, size: 'sm', color: '#b45309', weight: 'bold', align: 'end', flex: 3 },
    ],
  }))

  return {
    type: 'flex',
    altText: `🍱 สรุปยอดสั่งข้าวกล่อง ${totalMeals} กล่อง (ตัดยอด 14:30 น.)`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#9a3412',
        paddingAll: '14px',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            alignItems: 'center',
            contents: [
              { type: 'text', text: '🍱', size: 'md', flex: 0 },
              {
                type: 'text',
                text: 'สรุปยอดสั่งข้าวกล่อง (กับข้าว)',
                weight: 'bold',
                color: '#ffffff',
                size: 'sm',
                flex: 7,
                wrap: true,
              },
              { type: 'text', text: 'FLEX BUBBLE', size: 'xxs', color: '#fca5a5', align: 'end', flex: 3 },
            ],
          },
          {
            type: 'text',
            text: `รอบ 14:30 น. • ${shopName}`,
            size: 'xxs',
            color: '#fecaca',
            margin: 'xs',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '14px',
        spacing: 'md',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            justifyContent: 'space-between',
            alignItems: 'center',
            contents: [
              { type: 'text', text: 'ประจำวันที่:', size: 'sm', color: '#6b7280' },
              { type: 'text', text: dText, size: 'sm', color: '#111827', weight: 'bold', align: 'end' },
            ],
          },
          {
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#fffbeb',
            borderColor: '#f59e0b',
            borderWidth: '1.5px',
            cornerRadius: '10px',
            paddingAll: '12px',
            contents: [
              {
                type: 'box',
                layout: 'horizontal',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                contents: [
                  {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                      { type: 'text', text: 'ยอดสั่งข้าวกล่องรวม', size: 'xs', color: '#92400e', weight: 'bold' },
                      { type: 'text', text: `${totalMeals} กล่อง`, size: 'xxl', color: '#78350f', weight: 'bold' },
                    ],
                  },
                  {
                    type: 'box',
                    layout: 'vertical',
                    alignItems: 'flex-end',
                    contents: [
                      { type: 'text', text: `@${pricePerMeal} บาท/กล่อง`, size: 'xxs', color: '#b45309' },
                      { type: 'text', text: `รวม ${totalCost.toLocaleString()} ฿`, size: 'sm', color: '#b45309', weight: 'bold' },
                    ],
                  },
                ],
              },
            ],
          },
          ...(breakdownRows.length > 0
            ? [
                { type: 'text', text: 'รายละเอียดแยกตามทีมช่าง:', size: 'xs', color: '#374151', weight: 'bold', margin: 'none' },
                {
                  type: 'box',
                  layout: 'vertical',
                  backgroundColor: '#fafafa',
                  cornerRadius: '8px',
                  paddingAll: '10px',
                  contents: breakdownRows,
                },
              ]
            : [
                {
                  type: 'box',
                  layout: 'vertical',
                  backgroundColor: '#fef3c7',
                  cornerRadius: '8px',
                  paddingAll: '12px',
                  alignItems: 'center',
                  contents: [
                    { type: 'text', text: '(ไม่มีรายการสั่งข้าวในวันนี้)', size: 'sm', color: '#92400e' },
                  ],
                },
              ]),
          {
            type: 'box',
            layout: 'horizontal',
            backgroundColor: '#fef9c3',
            cornerRadius: '6px',
            paddingAll: '8px',
            alignItems: 'center',
            contents: [
              { type: 'text', text: '⏰', size: 'xs', flex: 0 },
              { type: 'text', text: 'กรุณาส่งก่อน 11:45 น.', size: 'xs', color: '#854d0e', weight: 'bold', margin: 'sm' },
            ],
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '10px',
        backgroundColor: '#f8fafc',
        contents: [
          {
            type: 'text',
            text: `ส่งอัตโนมัติ 14:30 น. วันที่ ${dText}`,
            size: 'xxs',
            color: '#64748b',
            align: 'center',
          },
        ],
      },
    },
  }
}

/**
 * สร้างข้อความธรรมดา (Text) สำหรับสรุปยอดสั่งข้าวกล่อง (Telegram / Clipboard)
 */
export function formatMealLineTextMessage(
  report: DailyReportData,
  mealConfig?: Partial<MealConfig> | null
): string {
  let dText = report.date
  try {
    dText = format(new Date(report.date), 'd MMMM yyyy', { locale: th })
  } catch {}

  const pricePerMeal = mealConfig?.price_per_meal ?? 60
  const totalMeals = report.totalMeals || 0
  const totalCost = totalMeals * pricePerMeal

  const breakdownText = Object.entries(report.mealsByCompany || {})
    .map(([name, cnt], idx) => `   ${idx + 1}. ${name}: ${cnt} กล่อง`)
    .join('\n')

  return [
    `🍱 [สรุปยอดสั่งข้าวกล่อง รอบ 14:30 น.]`,
    `📅 ประจำวันที่: ${dText}`,
    `──────────────────`,
    `ยอดสั่งข้าวกล่องรวม: ${totalMeals} กล่อง (@${pricePerMeal} บาท = ${totalCost.toLocaleString()} บาท)`,
    breakdownText || '   (ไม่มีรายการสั่งข้าวในวันนี้)',
    `──────────────────`,
    `⏰ กรุณาส่งก่อน 11:45 น.`,
  ].join('\n')
}
