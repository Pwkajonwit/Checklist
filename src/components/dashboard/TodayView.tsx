'use client'

import Link from 'next/link'
import {
  Users, UserCheck, AlertTriangle, ShieldAlert,
  HardHat, ClipboardCheck, ArrowUpRight,
  Calendar, Zap, MessageSquare, UtensilsCrossed,
  Copy, Check
} from 'lucide-react'
import type { ChecklistEntry, MealConfig } from '@/lib/types'
import { toast } from 'sonner'
import { useState } from 'react'

interface TodayData {
  total: number
  active: number
  out: number
  alc: number
  ppeIncomplete: number
  black: number
  recent: ChecklistEntry[]
  allToday: ChecklistEntry[]
}

interface TodayViewProps {
  todayThai: string
  data: TodayData
  mealConfig?: MealConfig
}

const ppeFields = [
  { key: 'ppe_helmet' as const, label: 'หมวกนิรภัย', icon: '⛑' },
  { key: 'ppe_vest' as const,   label: 'เสื้อกั๊กสะท้อนแสง', icon: '🦺' },
  { key: 'ppe_shirt' as const,  label: 'แว่นตา', icon: '🥽' },
  { key: 'ppe_gloves' as const, label: 'ถุงมือเซฟตี้', icon: '🧤' },
  { key: 'ppe_shoes' as const,  label: 'รองเท้าเซฟตี้', icon: '👢' },
]

export function TodayView({ todayThai, data, mealConfig }: TodayViewProps) {
  const [copiedLine, setCopiedLine] = useState(false)

  // Meal Allowance calculations for today
  const mealOrders = data.allToday.filter(e => e.meal_allowance)
  const totalMeals = mealOrders.length
  const pricePerMeal = mealConfig?.price_per_meal || 60
  const totalMealCost = totalMeals * pricePerMeal

  // Group meals by company
  const mealsByCompany: Record<string, number> = {}
  mealOrders.forEach(e => {
    const c = e.company_name?.trim() || 'ไม่ระบุสังกัด'
    mealsByCompany[c] = (mealsByCompany[c] || 0) + 1
  })

  const handleCopyLine = () => {
    const breakdownStr = Object.entries(mealsByCompany)
      .map(([c, count]) => `• ${c}: ${count} กล่อง`)
      .join('\n')

    const defaultTpl = '🍱 สรุปยอดสั่งข้าวกล่อง โครงการ\nประจำวันที่: {date}\nรวมทั้งหมด: {total} กล่อง\n{breakdown}\n\nกรุณาส่งก่อน 11:45 น. ขอบคุณครับ'
    const template = mealConfig?.line_notify_template || defaultTpl
    const text = template
      .replace('{date}', todayThai)
      .replace('{total}', String(totalMeals))
      .replace('{breakdown}', breakdownStr || '• ไม่มีรายการ')

    navigator.clipboard.writeText(text)
    setCopiedLine(true)
    toast.success('คัดลอกข้อความสำหรับส่ง LINE ร้านข้าวแล้ว!')
    setTimeout(() => setCopiedLine(false), 2500)
  }

  const statTiles = [
    {
      label: 'คนเข้าวันนี้',
      value: data.total,
      unit: 'คน',
      icon: Users,
      badgeCls: 'bg-blue-50 text-blue-700 border-blue-200',
      iconBg: 'bg-blue-100 text-blue-700',
    },
    {
      label: 'อยู่ในโครงการ',
      value: data.active,
      unit: 'คน',
      icon: UserCheck,
      badgeCls: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      iconBg: 'bg-emerald-100 text-emerald-700',
    },
    {
      label: 'ออกงานแล้ว',
      value: data.out,
      unit: 'คน',
      icon: ClipboardCheck,
      badgeCls: 'bg-slate-100 text-slate-700 border-slate-200',
      iconBg: 'bg-slate-200 text-slate-700',
    },
    {
      label: 'ALC ผิดปกติ',
      value: data.alc,
      unit: 'คน',
      icon: AlertTriangle,
      badgeCls: data.alc > 0 ? 'bg-red-100 text-red-700 border-red-300 font-bold' : 'bg-slate-50 text-slate-600 border-slate-200',
      iconBg: data.alc > 0 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500',
    },
    {
      label: 'PPE ไม่ครบ',
      value: data.ppeIncomplete,
      unit: 'คน',
      icon: HardHat,
      badgeCls: data.ppeIncomplete > 0 ? 'bg-amber-50 text-amber-800 border-amber-300 font-bold' : 'bg-slate-50 text-slate-600 border-slate-200',
      iconBg: data.ppeIncomplete > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500',
    },
    {
      label: 'บัญชีดำ',
      value: data.black,
      unit: 'คน',
      icon: ShieldAlert,
      badgeCls: data.black > 0 ? 'bg-purple-100 text-purple-700 border-purple-300 font-bold' : 'bg-slate-50 text-slate-600 border-slate-200',
      iconBg: data.black > 0 ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-500',
    },
  ]

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full gap-2 overflow-hidden">
      
      {/* ── 1. Compact Top Bar: Date & Quick Actions (ความสูง h-9) ── */}
      <div className="p-2 bg-white rounded-lg border border-slate-300 shadow-2xs flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center h-8 gap-1.5 px-2.5 rounded-md bg-slate-100 text-slate-800 text-xs font-semibold border border-slate-300">
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
            <span>{todayThai}</span>
          </div>
          <span className="text-slate-400 hidden sm:inline">•</span>
          <span className="text-xs text-slate-800 hidden sm:inline font-normal">
            ภาพรวมการเข้า-ออก และตรวจสอบความปลอดภัยประจำวัน
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Link
            href="/checklist"
            className="h-8 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
            <span>ตรวจ Checklist วันนี้</span>
          </Link>
          <Link
            href="/line-oa"
            className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>แจ้งเตือน LINE</span>
          </Link>
        </div>
      </div>

      {/* ── 2. Stat Tiles Strip (6 Compact Tiles in 1 Row) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 shrink-0">
        {statTiles.map((tile, i) => {
          const Icon = tile.icon
          return (
            <div
              key={i}
              className="p-2 bg-white rounded-lg border border-slate-300 shadow-2xs flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <span className="text-[11px] font-semibold text-slate-700 block truncate uppercase tracking-wide">
                  {tile.label}
                </span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-lg font-bold text-slate-900 leading-none">
                    {tile.value}
                  </span>
                  <span className="text-[11px] text-slate-700 font-normal">
                    {tile.unit}
                  </span>
                </div>
              </div>
              <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 border border-slate-200 ${tile.iconBg}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
          )
        })}
      </div>

      {/* ── 3. Main Split Grid (Full Height: Spreadsheet Table + Side Summary) ── */}
      <div className="flex flex-col lg:flex-row items-stretch gap-2 flex-1 min-h-0 overflow-hidden">

        {/* ── Left Area (2/3 width): Spreadsheet Grid of Recent Checklists ── */}
        <div className="flex-1 min-w-0 flex flex-col border border-slate-300 rounded-lg overflow-hidden bg-white shadow-2xs h-full">
          {/* Table Header Strip */}
          <div className="px-3 py-1.5 bg-slate-100 border-b border-slate-300 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
              <ClipboardCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>รายการบันทึกเข้าโครงการวันนี้ ({data.recent.length})</span>
            </div>
            <Link
              href="/checklist"
              className="text-[11px] font-semibold text-blue-700 hover:text-blue-900 inline-flex items-center gap-0.5 cursor-pointer"
            >
              <span>ดูและตรวจทั้งหมด</span>
              <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Table Container */}
          <div className="flex-1 overflow-auto min-h-0 scrollbar-thin">
            {data.recent.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center py-10 gap-2 text-slate-600 text-xs">
                <HardHat className="w-8 h-8 text-slate-400" />
                <p className="font-semibold text-slate-800">ยังไม่มีรายการบันทึกในวันนี้</p>
                <Link
                  href="/checklist"
                  className="mt-1 px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs font-semibold hover:bg-blue-700"
                >
                  เริ่มตรวจ Checklist ตอนนี้
                </Link>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-100 z-10 select-none">
                  <tr className="border-b border-slate-300 text-slate-800 text-[11px]">
                    <th className="py-1.5 px-2 w-10 text-center font-semibold border-r border-slate-300">#</th>
                    <th className="py-1.5 px-2.5 min-w-[140px] font-semibold border-r border-slate-300">ชื่อลูกทีม / ช่าง</th>
                    <th className="py-1.5 px-2 min-w-[120px] font-semibold border-r border-slate-300">สังกัด</th>
                    <th className="py-1.5 px-2 text-center min-w-[85px] font-semibold border-r border-slate-300">เข้า / ออก</th>
                    <th className="py-1.5 px-2 min-w-[110px] font-semibold border-r border-slate-300">งานที่ปฏิบัติ</th>
                    <th className="py-1.5 px-1.5 text-center min-w-[65px] font-semibold border-r border-slate-300">ALC</th>
                    <th className="py-1.5 px-2 text-center min-w-[70px] font-semibold border-r border-slate-300">PPE</th>
                    <th className="py-1.5 px-2 text-center min-w-[85px] font-semibold">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent.map((e, idx) => {
                    const ppeCount = [
                      e.ppe_helmet,
                      e.ppe_vest,
                      e.ppe_shirt,
                      e.ppe_gloves,
                      e.ppe_shoes,
                    ].filter(Boolean).length

                    return (
                      <tr
                        key={e.id}
                        className={`border-b border-slate-200 transition-colors ${
                          e.is_blacklisted
                            ? 'bg-red-50/60 hover:bg-red-50/80'
                            : e.alc_result === '>0%'
                            ? 'bg-amber-50/50 hover:bg-amber-50/80'
                            : 'bg-white hover:bg-slate-50'
                        }`}
                      >
                        {/* # */}
                        <td className="py-1.5 px-2 text-center text-slate-700 text-[11px] font-normal border-r border-slate-200">
                          {idx + 1}
                        </td>

                        {/* Name */}
                        <td className="py-1.5 px-2.5 border-r border-slate-200">
                          <span className="font-normal text-slate-900 text-xs">
                            {e.contractor_name}
                          </span>
                        </td>

                        {/* Company */}
                        <td className="py-1.5 px-2 text-slate-800 text-[11px] font-normal border-r border-slate-200 truncate">
                          {e.company_name || '—'}
                        </td>

                        {/* Time */}
                        <td className="py-1.5 px-2 text-center border-r border-slate-200 text-[11px] font-normal">
                          <span className="text-emerald-800 font-semibold">{e.check_in_time || '—'}</span>
                          {e.check_out_time && (
                            <span className="text-slate-600 ml-1">/ {e.check_out_time}</span>
                          )}
                        </td>

                        {/* Activity */}
                        <td className="py-1.5 px-2 text-slate-800 text-[11px] font-normal border-r border-slate-200 truncate">
                          {e.activity_name || 'งานทั่วไป'}
                        </td>

                        {/* ALC */}
                        <td className="py-1.5 px-1.5 text-center border-r border-slate-200">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[11px] font-semibold border ${
                              e.alc_result === '>0%'
                                ? 'bg-red-100 text-red-900 border-red-300'
                                : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                            }`}
                          >
                            {e.alc_result}
                          </span>
                        </td>

                        {/* PPE */}
                        <td className="py-1.5 px-2 text-center border-r border-slate-200">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[11px] font-semibold border ${
                              ppeCount === 5
                                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                : 'bg-amber-100 text-amber-900 border-amber-300'
                            }`}
                          >
                            {ppeCount}/5
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-1.5 px-2 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                              e.status === 'active'
                                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                : 'bg-slate-100 text-slate-800 border-slate-300'
                            }`}
                          >
                            {e.status === 'active' ? 'อยู่ในโครงการ' : 'ออกงานแล้ว'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Table Bottom Strip */}
          <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-700 shrink-0">
            <span>แสดง {data.recent.length} รายการล่าสุด</span>
            <span>บันทึกทั้งหมดวันนี้: <strong className="text-slate-900 font-bold">{data.total}</strong> คน</span>
          </div>
        </div>

        {/* ── Right Area (1/3 width): PPE Compliance Summary & Quick Links ── */}
        <div className="w-full lg:w-72 xl:w-80 shrink-0 flex flex-col gap-2 h-full">

          {/* PPE Compliance Card */}
          <div className="p-2.5 bg-white rounded-lg border border-slate-300 shadow-2xs flex flex-col gap-2 shrink-0">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <HardHat className="w-3.5 h-3.5 text-amber-600" />
                <span>การสวมใส่อุปกรณ์ PPE วันนี้</span>
              </div>
              <span className="text-[11px] text-slate-700 font-normal">
                ({data.allToday.length} คน)
              </span>
            </div>

            <div className="space-y-1.5 pt-0.5 text-xs">
              {ppeFields.map(field => {
                const passedCount = data.allToday.filter(e => e[field.key]).length
                const total = data.allToday.length
                const pct = total > 0 ? Math.round((passedCount / total) * 100) : 0

                return (
                  <div key={field.key} className="space-y-0.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-800 flex items-center gap-1 font-normal">
                        <span>{field.icon}</span>
                        <span>{field.label}</span>
                      </span>
                      <span className="text-[11px] font-semibold text-slate-800">
                        {passedCount}/{total} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          pct === 100
                            ? 'bg-emerald-600'
                            : pct >= 80
                            ? 'bg-blue-600'
                            : pct >= 50
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Meal Catering Box (SHOW ONLY WHEN mealConfig.enabled === true) ── */}
          {mealConfig?.enabled && (
            <div className="p-2.5 bg-amber-50/80 rounded-lg border border-amber-300 shadow-2xs flex flex-col gap-1.5 shrink-0 animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-1.5 border-b border-amber-300">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-950">
                  <UtensilsCrossed className="w-3.5 h-3.5 text-amber-700" />
                  <span>สรุปยอดสั่งข้าวกล่องวันนี้</span>
                </div>
                <span className="text-[11px] font-semibold text-amber-900 bg-amber-200 px-1.5 py-0.2 rounded border border-amber-300">
                  ตัดรอบ {mealConfig.cut_off_time || '10:00'} น.
                </span>
              </div>

              <div className="flex items-baseline justify-between pt-0.5">
                <div>
                  <span className="text-xl font-bold text-amber-950 leading-none">
                    {totalMeals}
                  </span>
                  <span className="text-xs text-amber-900 ml-1 font-normal">กล่อง</span>
                </div>
                <div className="text-right text-[11px] text-amber-900 font-normal">
                  รวม <strong className="font-semibold">฿{totalMealCost.toLocaleString()}</strong> (@{pricePerMeal}.-)
                </div>
              </div>

              {/* Breakdown by Company */}
              <div className="space-y-1 pt-0.5 max-h-20 overflow-y-auto pr-0.5 text-xs">
                {Object.keys(mealsByCompany).length === 0 ? (
                  <span className="text-[11px] text-amber-800 block italic">
                    ยังไม่มีช่างติ๊กรับอาหารในวันนี้
                  </span>
                ) : (
                  Object.entries(mealsByCompany).map(([comp, count]) => (
                    <div key={comp} className="flex items-center justify-between text-[11px] text-amber-950">
                      <span className="truncate pr-1 font-normal">• {comp}</span>
                      <span className="font-semibold">{count} กล่อง</span>
                    </div>
                  ))
                )}
              </div>

              {/* Action Button: Copy LINE */}
              <button
                type="button"
                onClick={handleCopyLine}
                className="mt-1 w-full h-8 px-2 bg-amber-700 hover:bg-amber-800 text-white rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
              >
                {copiedLine ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>คัดลอกแล้ว!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>คัดลอกข้อความส่ง LINE ร้านข้าว</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Quick Nav Shortcuts Card */}
          <div className="p-2.5 bg-white rounded-lg border border-slate-300 shadow-2xs flex-1 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-slate-900 block pb-1.5 border-b border-slate-200">
                เมนูลัดของระบบ
              </span>
              <div className="mt-1.5 space-y-1 text-xs">
                <Link
                  href="/checklist"
                  className="p-1.5 rounded-md border border-slate-200 hover:bg-slate-50 flex items-center justify-between text-slate-800 transition-colors"
                >
                  <span className="flex items-center gap-1.5 font-normal">
                    <Zap className="w-3.5 h-3.5 text-amber-600" />
                    ตรวจ Checklist ตามทีมช่าง
                  </span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-500" />
                </Link>

                <Link
                  href="/contractors"
                  className="p-1.5 rounded-md border border-slate-200 hover:bg-slate-50 flex items-center justify-between text-slate-800 transition-colors"
                >
                  <span className="flex items-center gap-1.5 font-normal">
                    <Users className="w-3.5 h-3.5 text-blue-600" />
                    จัดการรายชื่อผู้รับเหมา/ช่าง
                  </span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-500" />
                </Link>

                <Link
                  href="/activities"
                  className="p-1.5 rounded-md border border-slate-200 hover:bg-slate-50 flex items-center justify-between text-slate-800 transition-colors"
                >
                  <span className="flex items-center gap-1.5 font-normal">
                    <HardHat className="w-3.5 h-3.5 text-emerald-600" />
                    กำหนดกิจกรรม / ระบบงาน
                  </span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-500" />
                </Link>

                <Link
                  href="/history"
                  className="p-1.5 rounded-md border border-slate-200 hover:bg-slate-50 flex items-center justify-between text-slate-800 transition-colors"
                >
                  <span className="flex items-center gap-1.5 font-normal">
                    <ClipboardCheck className="w-3.5 h-3.5 text-purple-600" />
                    ดูประวัติย้อนหลังและรายงาน
                  </span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-500" />
                </Link>
              </div>
            </div>

            <div className="pt-1.5 border-t border-slate-200 text-[11px] text-slate-600 flex items-center justify-between font-normal">
              <span>สถานะระบบ: ปกติ</span>
              <span>เวอร์ชันล่าสุด</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
