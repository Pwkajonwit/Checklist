import type { ChecklistEntry, Contractor, Company, Activity } from '@/lib/types'
import { isAlcoholPassed } from '@/lib/types'
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
}

/**
 * คำนวณสรุปข้อมูล Checklist ประจำวัน แยกตามสาขา / บริษัท
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
    const compEntries = dateEntries.filter(
      e => e.company_name === compName || members.some(m => m.id === e.contractor_id || m.name === e.contractor_name)
    )
    const location = compEntries.find(e => e.location && e.location.trim())?.location?.trim() || ''

    // ดึงชื่อกิจกรรมและรหัส (ทั้งรหัสกิจกรรม และรหัสสังกัด/บริษัท)
    const rawActivityName = compEntries.find(e => e.activity_name && e.activity_name.trim())?.activity_name?.trim() || ''
    const rawActivityId = compEntries.find(e => e.activity_id)?.activity_id
    const actObj = activities.find(a => (rawActivityId && a.id === rawActivityId) || (rawActivityName && a.name === rawActivityName))

    const actCode = actObj?.code ? actObj.code.trim() : ''
    const compCode = compObj?.code ? compObj.code.trim() : ''
    const code = actCode || compCode
    const actName = rawActivityName || actObj?.name || ''

    let activityTag = ''
    if (actName && code) {
      activityTag = `[${code}] ${actName}`
    } else if (actName) {
      activityTag = actName
    } else if (code) {
      activityTag = `[${code}]`
    }

    const checkedIn: { name: string; checkInTime?: string | null }[] = []
    const lateOrReqs: {
      name: string
      purpose: string
      checkInTime?: string | null
      location?: string | null
      companyCode?: string | null
    }[] = []
    const failedList: { name: string; reason: string; checkInTime?: string | null }[] = []
    const missingList: string[] = []
    const membersDetails: MemberStatusDetail[] = []

    let passedInComp = 0
    let failedInComp = 0
    let alcFailedInComp = 0
    let ppeFailedInComp = 0

    members.forEach(m => {
      const entry = dateEntries.find(
        e => (e.contractor_id && e.contractor_id === m.id) || e.contractor_name === m.name
      )

      if (entry) {
        const timeStr = entry.check_in_time ? entry.check_in_time.substring(0, 5) : null
        checkedIn.push({ name: m.name, checkInTime: timeStr })

        // Check if has special purpose or late request
        if (entry.purpose && entry.purpose.trim()) {
          lateOrReqs.push({
            name: m.name,
            purpose: entry.purpose.trim(),
            checkInTime: timeStr,
            location: entry.location?.trim() || location || '',
            companyCode: compCode,
          })
        }

        // Check if passed ALC and PPE
        const isAlcPass = isAlcoholPassed(entry.alc_result)
        const isPpePass =
          entry.ppe_helmet &&
          entry.ppe_vest &&
          entry.ppe_shirt &&
          entry.ppe_gloves &&
          entry.ppe_shoes

        if (isAlcPass && isPpePass) {
          passedInComp += 1
          membersDetails.push({
            name: m.name,
            position: m.position || undefined,
            status: 'passed',
            checkInTime: timeStr,
            purpose: entry.purpose || undefined,
            alcResult: entry.alc_result,
          })
        } else {
          failedInComp += 1
          if (!isAlcPass) alcFailedInComp += 1
          if (!isPpePass) ppeFailedInComp += 1

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
          failedList.push({ name: m.name, reason: failReason, checkInTime: timeStr })
          membersDetails.push({
            name: m.name,
            position: m.position || undefined,
            status: 'failed',
            checkInTime: timeStr,
            purpose: entry.purpose || undefined,
            alcResult: entry.alc_result,
            failReason,
          })
        }
      } else {
        missingList.push(m.name)
        membersDetails.push({
          name: m.name,
          position: m.position || undefined,
          status: 'missing',
        })
      }
    })

    const checkedCount = checkedIn.length
    const missingCount = regCount - checkedCount

    totalCheckedIn += checkedCount
    totalPassed += passedInComp
    totalFailed += failedInComp
    totalAlcFailed += alcFailedInComp
    totalPpeFailed += ppeFailedInComp
    totalMissing += missingCount

    companySummaries.push({
      companyName: compName,
      companyCode: compCode || null,
      activityName: actName || null,
      activityCode: code || null,
      activityTag: activityTag || null,
      location: location || null,
      totalRegistered: regCount,
      checkedInCount: checkedCount,
      passedCount: passedInComp,
      failedCount: failedInComp,
      alcCount: alcFailedInComp,
      ppeFailedCount: ppeFailedInComp,
      missingCount: missingCount,
      lateOrRequests: lateOrReqs,
      failedMembers: failedList,
      missingMembers: missingList,
      checkedInMembers: checkedIn,
      membersDetails,
    })
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
    companies: companySummaries.sort((a, b) => b.checkedInCount - a.checkedInCount),
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

  // 1. สรุปรายบริษัท
  report.companies.forEach(comp => {
    let actTag = comp.activityTag || ''
    if (!actTag) {
      if (comp.activityName && comp.companyCode) {
        actTag = `[${comp.companyCode}] ${comp.activityName}`
      } else if (comp.activityName) {
        actTag = comp.activityName
      } else if (comp.companyCode) {
        actTag = `[${comp.companyCode}]`
      }
    }
    const actStr = actTag ? `  ${actTag}` : ''
    const locStr = comp.location ? `  📍 ${comp.location}` : ''
    
    const stats: string[] = [`มา ${comp.passedCount}`]
    if (comp.alcCount > 0) stats.push(`ALC ${comp.alcCount}`)
    if (comp.ppeFailedCount > 0) stats.push(`ไม่ผ่าน ${comp.ppeFailedCount}`)
    stats.push(`ไม่มา ${comp.missingCount}`)
    if (comp.lateOrRequests.length > 0) stats.push(`แจ้งประสงค์ ${comp.lateOrRequests.length}`)

    lines.push(`🏢 ${comp.companyName}${actStr}`)
    lines.push(`   ${stats.join('  ')}${locStr}`)
  })
  lines.push(`────────────────`)

  // 2. รายการแจ้งความประสงค์
  const allRequests = report.companies.flatMap(c =>
    c.lateOrRequests.map(r => ({
      name: r.name,
      purpose: r.purpose,
      checkInTime: r.checkInTime,
      companyName: c.companyName,
      companyCode: r.companyCode || c.companyCode || '',
      location: r.location || c.location || '',
    }))
  )

  if (allRequests.length > 0) {
    lines.push(`📝 รายการแจ้งความประสงค์:`)
    allRequests.forEach(r => {
      const codeStr = r.companyCode ? ` [ ${r.companyCode} ]` : ''
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
  // Bubble 1: การเข้า-ออก และตรวจสอบความปลอดภัยประจำวัน (ตาม Frame 2)
  // ══════════════════════════════════════════════════════════════════════════
  const companyRows: any[] = []

  report.companies.slice(0, 12).forEach((comp, idx) => {
    let actTag = comp.activityTag || ''
    if (!actTag) {
      if (comp.activityName && comp.companyCode) {
        actTag = `[${comp.companyCode}] ${comp.activityName}`
      } else if (comp.activityName) {
        actTag = comp.activityName
      } else if (comp.companyCode) {
        actTag = `[${comp.companyCode}]`
      }
    }

    const statTextElements: any[] = [
      {
        type: 'text',
        text: `มา ${comp.passedCount}`,
        size: 'xs',
        weight: 'bold',
        color: '#16a34a',
        flex: 0,
      },
    ]

    if (comp.alcCount > 0) {
      statTextElements.push({
        type: 'text',
        text: `ALC ${comp.alcCount}`,
        size: 'xs',
        weight: 'bold',
        color: '#dc2626',
        flex: 0,
      })
    }

    if (comp.ppeFailedCount > 0) {
      statTextElements.push({
        type: 'text',
        text: `ไม่ผ่าน ${comp.ppeFailedCount}`,
        size: 'xs',
        weight: 'bold',
        color: '#dc2626',
        flex: 0,
      })
    }

    statTextElements.push({
      type: 'text',
      text: `ไม่มา ${comp.missingCount}`,
      size: 'xs',
      color: '#0f172a',
      flex: 0,
    })

    if (comp.lateOrRequests.length > 0) {
      statTextElements.push({
        type: 'text',
        text: `แจ้งประสงค์ ${comp.lateOrRequests.length}`,
        size: 'xs',
        color: '#2563eb',
        flex: 0,
      })
    }

    companyRows.push({
      type: 'box',
      layout: 'vertical',
      spacing: 'xs',
      contents: [
        // Line 1: Company Name (Left) | Activity / Code (Right)
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
              flex: 5,
              wrap: true,
            },
            ...(actTag
              ? [
                  {
                    type: 'text',
                    text: actTag,
                    weight: 'bold',
                    size: 'xs',
                    color: '#2563eb',
                    align: 'end',
                    flex: 5,
                    wrap: true,
                  },
                ]
              : []),
          ],
        },
        // Line 2: Attendance stats (Left) | Location (Right)
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            {
              type: 'box',
              layout: 'horizontal',
              spacing: 'md',
              flex: 7,
              contents: statTextElements,
            },
            ...(comp.location
              ? [
                  {
                    type: 'text',
                    text: comp.location,
                    size: 'xs',
                    color: '#0f172a',
                    align: 'end',
                    flex: 3,
                    wrap: true,
                  },
                ]
              : []),
          ],
        },
      ],
    })

    if (idx < Math.min(report.companies.length, 12) - 1) {
      companyRows.push({
        type: 'separator',
        margin: 'md',
      })
    }
  })

  if (report.companies.length > 12) {
    companyRows.push({
      type: 'text',
      text: `...และอีก ${report.companies.length - 12} บริษัท`,
      size: 'xxs',
      color: '#64748b',
      align: 'center',
      margin: 'sm',
    })
  }

  const overviewBubble = {
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
        // 3 Summary Badges
        {
          type: 'box',
          layout: 'horizontal',
          spacing: 'sm',
          contents: [
            {
              type: 'box',
              layout: 'vertical',
              backgroundColor: '#dcfce7',
              cornerRadius: '8px',
              paddingAll: '8px',
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              contents: [
                {
                  type: 'text',
                  text: `ทีมงานรวม ${report.totalPassed}`,
                  size: 'xs',
                  color: '#14532d',
                  weight: 'bold',
                  align: 'center',
                },
              ],
            },
            {
              type: 'box',
              layout: 'vertical',
              backgroundColor: '#fef3c7',
              cornerRadius: '8px',
              paddingAll: '8px',
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
                },
              ],
            },
            {
              type: 'box',
              layout: 'vertical',
              backgroundColor: '#dbeafe',
              cornerRadius: '8px',
              paddingAll: '8px',
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
                },
              ],
            },
          ],
        },

        // Company Rows
        {
          type: 'box',
          layout: 'vertical',
          spacing: 'md',
          margin: 'md',
          contents: companyRows,
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
      companyCode: r.companyCode || c.companyCode || '',
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
      const compLabel = r.companyCode
        ? `${r.companyName} [ ${r.companyCode} ]`
        : r.companyName

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

  // Carousel 2 bubbles: Bubble 1 (การเข้า-ออกและตรวจสอบความปลอดภัยประจำวัน) + Bubble 2 (รายการแจ้งความประสงค์)
  const totalBubbles = [overviewBubble, requestsBubble]

  return {
    type: 'flex',
    altText: `📋 สรุปรายการเช็คชื่อประจำวัน (${dText})`,
    contents: {
      type: 'carousel',
      contents: totalBubbles,
    },
  }
}
