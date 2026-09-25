import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import {
  Users, UserCheck, AlertTriangle, ShieldAlert,
  HardHat, ClipboardCheck, ArrowUpRight, Plus,
  Calendar, Check, ShieldCheck, Zap, MessageSquare
} from 'lucide-react'
import Link from 'next/link'
import { isAlcoholFailed } from '@/lib/types'

async function getDashboardData(today: string) {
  const supabase = await createClient()
  const { data: entries } = await supabase
    .from('checklist_entries')
    .select('*')
    .eq('entry_date', today)
    .order('created_at', { ascending: false })

  const list = entries ?? []
  return {
    total: list.length,
    active: list.filter(e => e.status === 'active').length,
    out: list.filter(e => e.status === 'checked_out').length,
    alc: list.filter(e => isAlcoholFailed(e.alc_result)).length,
    ppeIncomplete: list.filter(e => !e.ppe_helmet || !e.ppe_vest || !e.ppe_shirt || !e.ppe_gloves || !e.ppe_shoes).length,
    black: list.filter(e => e.is_blacklisted).length,
    recent: list.slice(0, 15),
    allToday: list,
  }
}

const ppeFields = [
  { key: 'ppe_helmet' as const, label: 'หมวกนิรภัย', icon: '⛑' },
  { key: 'ppe_vest' as const,   label: 'เสื้อกั๊กสะท้อนแสง', icon: '🦺' },
  { key: 'ppe_shirt' as const,  label: 'เสื้อแขนยาว', icon: '👕' },
  { key: 'ppe_gloves' as const, label: 'ถุงมือเซฟตี้', icon: '🧤' },
  { key: 'ppe_shoes' as const,  label: 'รองเท้าเซฟตี้', icon: '👢' },
]

export default async function DashboardPage() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const todayThai = format(new Date(), 'EEEEที่ d MMMM yyyy', { locale: th })
  const data = await getDashboardData(today)

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
    <div className="flex flex-col flex-1 min-h-0 h-full gap-2.5 overflow-hidden">

      {/* ── 1. Compact Top Bar: Date & Quick Actions ── */}
      <div className="p-2 bg-white rounded-lg border border-slate-300 shadow-2xs flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 text-slate-700 text-xs font-semibold">
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
            <span>{todayThai}</span>
          </div>
          <span className="text-[11px] text-slate-400 hidden sm:inline">•</span>
          <span className="text-xs text-slate-600 hidden sm:inline">
            ภาพรวมการเข้า-ออก และตรวจสอบความปลอดภัยประจำวัน
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Link
            href="/checklist"
            className="h-7 px-2.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold inline-flex items-center gap-1 shadow-2xs transition-colors"
          >
            <Zap className="w-3 h-3 text-amber-300 fill-amber-300" />
            <span>ตรวจ Checklist วันนี้</span>
          </Link>
          <Link
            href="/line-oa"
            className="h-7 px-2.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold inline-flex items-center gap-1 shadow-2xs transition-colors"
          >
            <MessageSquare className="w-3 h-3" />
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
                <span className="text-[10px] font-bold text-slate-500 block truncate uppercase tracking-wider">
                  {tile.label}
                </span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-lg font-bold text-slate-900 leading-none">
                    {tile.value}
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    {tile.unit}
                  </span>
                </div>
              </div>
              <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${tile.iconBg}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
          )
        })}
      </div>

      {/* ── 3. Main Split Grid (Full Height: Spreadsheet Table + Side Summary) ── */}
      <div className="flex flex-col lg:flex-row items-stretch gap-2.5 flex-1 min-h-0 overflow-hidden">

        {/* ── Left Area (2/3 width): Spreadsheet Grid of Recent Checklists ── */}
        <div className="flex-1 min-w-0 flex flex-col border border-slate-300 rounded-lg overflow-hidden bg-white shadow-2xs h-full">
          {/* Table Header Strip */}
          <div className="px-3 py-2 bg-slate-100 border-b border-slate-300 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
              <ClipboardCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>รายการบันทึกเข้าโครงการวันนี้ ({data.recent.length})</span>
            </div>
            <Link
              href="/checklist"
              className="text-[11px] font-bold text-blue-700 hover:text-blue-900 inline-flex items-center gap-0.5"
            >
              <span>ดูและตรวจทั้งหมด</span>
              <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Table Container */}
          <div className="flex-1 overflow-auto min-h-0 scrollbar-thin">
            {data.recent.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center py-12 gap-2 text-slate-400 text-xs">
                <HardHat className="w-8 h-8 text-slate-300" />
                <p className="font-semibold text-slate-600">ยังไม่มีรายการบันทึกในวันนี้</p>
                <Link
                  href="/checklist"
                  className="mt-1 px-3 py-1 bg-blue-600 text-white rounded text-[11px] font-bold hover:bg-blue-700"
                >
                  เริ่มตรวจ Checklist ตอนนี้
                </Link>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-100 z-10 select-none">
                  <tr className="border-b border-slate-300 text-slate-700 text-[11px]">
                    <th className="py-1.5 px-2 w-10 text-center font-bold border-r border-slate-300">#</th>
                    <th className="py-1.5 px-2.5 min-w-[140px] font-bold border-r border-slate-300">ชื่อลูกทีม / ช่าง</th>
                    <th className="py-1.5 px-2 min-w-[120px] font-bold border-r border-slate-300">สังกัด</th>
                    <th className="py-1.5 px-2 text-center min-w-[85px] font-bold border-r border-slate-300">เข้า / ออก</th>
                    <th className="py-1.5 px-2 min-w-[110px] font-bold border-r border-slate-300">งานที่ปฏิบัติ</th>
                    <th className="py-1.5 px-1.5 text-center min-w-[65px] font-bold border-r border-slate-300">ALC</th>
                    <th className="py-1.5 px-2 text-center min-w-[70px] font-bold border-r border-slate-300">PPE</th>
                    <th className="py-1.5 px-2 text-center min-w-[85px] font-bold">สถานะ</th>
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
                            ? 'bg-red-50/50 hover:bg-red-50/70'
                            : e.alc_result === '>0%'
                            ? 'bg-amber-50/40 hover:bg-amber-50/70'
                            : 'bg-white hover:bg-slate-50'
                        }`}
                      >
                        {/* # */}
                        <td className="py-1.5 px-2 text-center text-slate-400 font-mono text-[11px] border-r border-slate-200">
                          {idx + 1}
                        </td>

                        {/* Name */}
                        <td className="py-1.5 px-2.5 border-r border-slate-200">
                          <span className="font-semibold text-slate-900 text-xs">
                            {e.contractor_name}
                          </span>
                        </td>

                        {/* Company */}
                        <td className="py-1.5 px-2 text-slate-600 text-[11px] border-r border-slate-200 truncate">
                          {e.company_name || '—'}
                        </td>

                        {/* Time */}
                        <td className="py-1.5 px-2 text-center border-r border-slate-200 font-mono text-[11px]">
                          <span className="text-emerald-700 font-bold">{e.check_in_time || '—'}</span>
                          {e.check_out_time && (
                            <span className="text-slate-400 ml-1">/ {e.check_out_time}</span>
                          )}
                        </td>

                        {/* Activity */}
                        <td className="py-1.5 px-2 text-slate-700 text-[11px] border-r border-slate-200 truncate">
                          {e.activity_name || 'งานทั่วไป'}
                        </td>

                        {/* ALC */}
                        <td className="py-1.5 px-1.5 text-center border-r border-slate-200">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                              e.alc_result === '>0%'
                                ? 'bg-red-100 text-red-700 border-red-300'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}
                          >
                            {e.alc_result}
                          </span>
                        </td>

                        {/* PPE */}
                        <td className="py-1.5 px-2 text-center border-r border-slate-200">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                              ppeCount === 5
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {ppeCount}/5
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-1.5 px-2 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              e.status === 'active'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
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
          <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
            <span>แสดง {data.recent.length} รายการล่าสุด</span>
            <span>บันทึกทั้งหมดวันนี้: <strong className="text-slate-800 font-bold">{data.total}</strong> คน</span>
          </div>
        </div>

        {/* ── Right Area (1/3 width): PPE Compliance Summary & Quick Links ── */}
        <div className="w-full lg:w-72 xl:w-80 shrink-0 flex flex-col gap-2.5 h-full">

          {/* PPE Compliance Card */}
          <div className="p-3 bg-white rounded-lg border border-slate-300 shadow-2xs flex flex-col gap-2 shrink-0">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <HardHat className="w-3.5 h-3.5 text-amber-600" />
                <span>การสวมใส่อุปกรณ์ PPE วันนี้</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                ({data.allToday.length} คน)
              </span>
            </div>

            <div className="space-y-2 pt-1 text-xs">
              {ppeFields.map(field => {
                const passedCount = data.allToday.filter(e => e[field.key]).length
                const total = data.allToday.length
                const pct = total > 0 ? Math.round((passedCount / total) * 100) : 0

                return (
                  <div key={field.key} className="space-y-0.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-700 flex items-center gap-1 font-medium">
                        <span>{field.icon}</span>
                        <span>{field.label}</span>
                      </span>
                      <span className="text-[10px] font-mono font-bold text-slate-600">
                        {passedCount}/{total} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          pct === 100
                            ? 'bg-emerald-500'
                            : pct >= 80
                            ? 'bg-blue-500'
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

          {/* Quick Nav Shortcuts Card */}
          <div className="p-3 bg-white rounded-lg border border-slate-300 shadow-2xs flex-1 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-slate-800 block pb-1.5 border-b border-slate-200">
                เมนูลัดของระบบ
              </span>
              <div className="mt-2 space-y-1 text-xs">
                <Link
                  href="/checklist"
                  className="p-2 rounded border border-slate-200 hover:bg-slate-50 flex items-center justify-between text-slate-700 transition-colors"
                >
                  <span className="flex items-center gap-1.5 font-semibold">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    ตรวจ Checklist ตามสังกัด
                  </span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
                </Link>

                <Link
                  href="/contractors"
                  className="p-2 rounded border border-slate-200 hover:bg-slate-50 flex items-center justify-between text-slate-700 transition-colors"
                >
                  <span className="flex items-center gap-1.5 font-semibold">
                    <Users className="w-3.5 h-3.5 text-blue-600" />
                    จัดการรายชื่อผู้รับเหมา/ช่าง
                  </span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
                </Link>

                <Link
                  href="/activities"
                  className="p-2 rounded border border-slate-200 hover:bg-slate-50 flex items-center justify-between text-slate-700 transition-colors"
                >
                  <span className="flex items-center gap-1.5 font-semibold">
                    <HardHat className="w-3.5 h-3.5 text-emerald-600" />
                    กำหนดกิจกรรม / ระบบงาน
                  </span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
                </Link>

                <Link
                  href="/history"
                  className="p-2 rounded border border-slate-200 hover:bg-slate-50 flex items-center justify-between text-slate-700 transition-colors"
                >
                  <span className="flex items-center gap-1.5 font-semibold">
                    <ClipboardCheck className="w-3.5 h-3.5 text-purple-600" />
                    ดูประวัติย้อนหลังและรายงาน
                  </span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
                </Link>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
              <span>สถานะระบบ: ปกติ</span>
              <span>เวอร์ชันล่าสุด</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
