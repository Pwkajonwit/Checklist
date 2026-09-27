import type { ChecklistEntry, Contractor, Company, Activity } from '@/lib/types'
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
      })
    })

    const compPassed = projectGroups.reduce((sum, p) => sum + p.passedCount, 0)
    const compFailed = projectGroups.reduce((sum, p) => sum + p.failedCount, 0)
    const compAlcFailed = projectGroups.reduce((sum, p) => sum + p.alcCount, 0)
    const compPpeFailed = projectGroups.reduce((sum, p) => sum + p.ppeFailedCount, 0)

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

  return {
    date: dateStr,
    totalRegistered,
    totalCheckedIn,
    totalPassed,
    totalFailed,
    totalAlcFailed,
    totalPpeFailed,
    totalMissing,
    companies: companySummaries,
    activeProjectRows,
    inactiveCompanies,
  }
}

/**
 * สร้างข้อความแจ้งเตือนสรุปประจำวัน (LINE Text Message)
 */
export function formatDailyLineMessage(report: DailyReportData): string {
  let dText = report.date
  try {
    dText = format(new Date(report.date), 'EEEEที่ d MMMM yyyy', { locale: th })
  } catch {}

  const totalRequests = report.companies.reduce((sum, c) => sum + c.lateOrRequests.length, 0)
  const lines: string[] = []

  lines.push(`📋 [การเข้า-ออก และตรวจสอบความปลอดภัยประจำวัน]`)
  lines.push(`📅 วัน${dText}`)
  lines.push(`────────────────`)
  lines.push(`ทีมงานรวม ${report.totalPassed} | ไม่มา ${report.totalMissing} | ประสงค์ ${totalRequests}`)
  lines.push(`────────────────`)

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

  lines.push(`🕒 รายงานเมื่อ: ${format(new Date(), 'HH:mm น.')}`)
  lines.push(`🛡️ ระบบ SiteCheck PRO`)

  return lines.join('\n')
}

/**
 * สร้าง LINE Flex Message:
 * - Bubble 1: การเข้า-ออก และตรวจสอบความปลอดภัยประจำวัน (Frame 2)
 * - Bubble 2: รายการแจ้งความประสงค์ (Frame 3)
 */
export function buildDailyLineFlexMessage(report: DailyReportData): any {
  let dText = report.date
  try {
    dText = format(new Date(report.date), 'd MMM yyyy', { locale: th })
  } catch {}

  const currentTime = format(new Date(), 'HH:mm น.')
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
        backgroundColor: '#286b13',
        paddingAll: '12px',
        contents: [
          {
            type: 'text',
            text: 'การเข้า-ออก และตรวจสอบความปลอดภัยประจำวัน',
            weight: 'bold',
            color: '#ffffff',
            size: 'xs',
            wrap: true,
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
            text: `รายงานเมื่อ: ${currentTime} วันที่ ${dText}`,
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
          backgroundColor: '#286b13',
          paddingAll: '12px',
          contents: [
            {
              type: 'text',
              text: headerTitle,
              weight: 'bold',
              color: '#ffffff',
              size: 'xs',
              wrap: true,
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
              text: `รายงานเมื่อ: ${currentTime} วันที่ ${dText}`,
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
