'use client'

import { useState } from 'react'
import type { ChecklistEntry } from '@/lib/types'
import {
  MoreHorizontal, Pencil, Trash2,
  ArrowUp, ArrowDown, ArrowUpDown, HardHat, Check, X, CheckCircle2, AlertTriangle
} from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import Link from 'next/link'
import { getContractorAlcRisk, isAlcoholPassed, isAlcoholFailed } from '@/lib/types'

/* ── PPE Compact Dots with Labels ── */
const PPECompact = ({ entry }: { entry: ChecklistEntry }) => {
  const items = [
    { label: 'หมวก', v: entry.ppe_helmet, icon: '⛑' },
    { label: 'กั๊ก', v: entry.ppe_vest, icon: '🦺' },
    { label: 'เสื้อ', v: entry.ppe_shirt, icon: '👕' },
    { label: 'ถุงมือ', v: entry.ppe_gloves, icon: '🧤' },
    { label: 'รองเท้า', v: entry.ppe_shoes, icon: '👢' },
  ]
  const pass = items.filter(i => i.v).length

  return (
    <div className="flex items-center gap-1.5 justify-center">
      <div className="flex items-center gap-0.5">
        {items.map((i, idx) => (
          <span
            key={idx}
            title={`${i.label}: ${i.v ? 'ผ่าน' : 'ไม่ผ่าน'}`}
            className={`w-4 h-4 rounded-full flex items-center justify-center text-xs font-normal ${
              i.v
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-300 text-slate-600'
            }`}
          >
            {i.v ? '✓' : '—'}
          </span>
        ))}
      </div>
      <span
        className={`text-xs font-normal font-mono px-1.5 py-0.5 rounded border ${
          pass === 5
            ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
            : pass >= 3
            ? 'bg-amber-100 text-amber-900 border-amber-300'
            : 'bg-red-100 text-red-900 border-red-300'
        }`}
      >
        {pass}/5
      </span>
    </div>
  )
}

type SortKey = 'contractor_name' | 'company_name' | 'check_in_time' | 'alc_result' | 'entry_date'

interface ChecklistTableProps {
  entries: ChecklistEntry[]
  loading: boolean
  onDelete: (id: string) => void
  showDate?: boolean
}

export function ChecklistTable({ entries, loading, onDelete, showDate = false }: ChecklistTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('contractor_name')
  const [asc, setAsc] = useState(true)

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setAsc(v => !v)
    else { setSortKey(key); setAsc(true) }
  }

  const sorted = [...entries].sort((a, b) => {
    const va = (a[sortKey] ?? '') as string
    const vb = (b[sortKey] ?? '') as string
    return asc ? va.localeCompare(vb) : vb.localeCompare(va)
  })

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-2.5 h-2.5 opacity-30 inline ml-1" />
    return asc ? <ArrowUp className="w-2.5 h-2.5 text-blue-600 inline ml-1" />
               : <ArrowDown className="w-2.5 h-2.5 text-blue-600 inline ml-1" />
  }

  const SortTh = ({ col, label, className = '' }: { col: SortKey; label: string; className?: string }) => (
    <th
      onClick={() => toggleSort(col)}
      className={`py-2 px-2.5 border-r border-slate-300 cursor-pointer select-none hover:bg-slate-200/70 transition-colors ${className}`}
    >
      <span className="inline-flex items-center gap-1 font-bold">
        {label}<SortIcon col={col} />
      </span>
    </th>
  )

  if (loading) return (
    <div className="card border border-slate-300 flex items-center justify-center py-12 bg-white">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
        <div className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-blue-600 animate-spin" />
        <span>กำลังโหลดข้อมูล...</span>
      </div>
    </div>
  )

  if (!entries.length) return (
    <div className="card border border-slate-300 flex flex-col items-center justify-center py-14 gap-2 bg-white text-center">
      <HardHat className="w-8 h-8 text-slate-400" />
      <p className="text-xs font-semibold text-slate-800">ไม่พบรายการบันทึกในวันนี้</p>
      <p className="text-xs text-slate-600">สามารถตรวจ Checklist ในแท็บ &quot;ตรวจ Checklist ตามสังกัด&quot; เพื่อบันทึกข้อมูล</p>
    </div>
  )

  return (
    <div className="border border-slate-300 rounded-lg overflow-hidden bg-white shadow-2xs flex-1 min-h-0 flex flex-col h-full">
      <div className="flex-1 overflow-auto min-h-0 scrollbar-thin">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="sticky top-0 bg-slate-100 z-10 select-none">
            <tr className="border-b border-slate-300 text-slate-900 text-xs">
              <th className="py-2 px-2 w-10 text-center font-semibold border-r border-slate-300">#</th>
              {showDate && (
                <SortTh col="entry_date" label="วันที่" className="text-center min-w-[85px]" />
              )}
              <SortTh col="contractor_name" label="ชื่อลูกทีม / ผู้รับเหมา" className="min-w-[150px]" />
              <SortTh col="company_name" label="สังกัด / บริษัท" className="min-w-[130px]" />
              <th className="py-2 px-2.5 border-r border-slate-300 min-w-[90px] font-semibold">ผู้ควบคุม</th>
              <SortTh col="check_in_time" label="เวลาตรวจ" className="text-center min-w-[85px]" />
              <th className="py-2 px-2.5 border-r border-slate-300 min-w-[130px] font-semibold">งาน / กิจกรรม</th>
              <SortTh col="alc_result" label="ALC" className="text-center min-w-[65px]" />
              <th className="py-2 px-2 text-center border-r border-slate-300 min-w-[100px] font-semibold">
                <span className="inline-flex items-center gap-1">
                  <HardHat className="w-3.5 h-3.5 text-slate-600" />
                  PPE
                </span>
              </th>
              <th className="py-2 px-2 text-right border-r border-slate-300 min-w-[70px] font-semibold">ค่าแรง</th>
              <th className="py-2 px-2 text-center w-12 font-semibold">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((e, idx) => {
              const isAlcFail = isAlcoholFailed(e.alc_result)
              const hasAlcRisk = getContractorAlcRisk(e.contractors) || e.notes?.includes('[เสี่ยง ALC]') || e.purpose?.includes('[เสี่ยง ALC]')

              return (
                <tr
                  key={e.id}
                  className={`border-b border-slate-200 transition-colors ${
                    e.is_blacklisted
                      ? 'bg-red-50/40 hover:bg-red-50/70'
                      : isAlcFail
                      ? 'bg-amber-50/30 hover:bg-amber-50/60'
                      : 'bg-white hover:bg-slate-50'
                  }`}
                >
                  {/* # */}
                  <td className="py-1.5 px-2 text-center text-slate-800 font-mono font-normal text-xs border-r border-slate-200">
                    {idx + 1}
                  </td>

                  {/* Date (if showDate) */}
                  {showDate && (
                    <td className="py-1.5 px-2 text-center text-slate-900 font-mono font-normal text-xs border-r border-slate-200 whitespace-nowrap">
                      {e.entry_date}
                    </td>
                  )}

                  {/* Name (พื้นหลังสีเหลืองจางหากมีความเสี่ยง ALC) */}
                  <td className={`py-1.5 px-2.5 border-r border-slate-200 ${hasAlcRisk ? 'bg-amber-100/70' : ''}`}>
                    <span className="font-normal text-slate-950 text-xs">
                      {e.contractor_name}
                    </span>
                  </td>

                  {/* Company */}
                  <td className="py-1.5 px-2.5 text-slate-800 text-xs font-normal border-r border-slate-200 truncate">
                    {e.company_name || '—'}
                  </td>

                  {/* Supervisor */}
                  <td className="py-1.5 px-2.5 text-slate-800 text-xs font-normal border-r border-slate-200 truncate">
                    {e.supervisor || '—'}
                  </td>

                  {/* Time */}
                  <td className="py-1.5 px-2.5 text-center border-r border-slate-200 font-mono text-xs">
                    <span className="text-slate-900 font-normal">{e.check_in_time || '—'}</span>
                  </td>

                  {/* Activity & Purpose */}
                  <td className="py-1.5 px-2.5 border-r border-slate-200">
                    <div className="flex flex-col">
                      <span className="font-normal text-slate-900 text-xs truncate max-w-[140px]">
                        {e.activity_name || 'งานทั่วไป'}
                      </span>
                      {e.purpose && (
                        <span className="text-xs font-normal text-blue-900 bg-blue-100 px-1 py-0.2 rounded border border-blue-300 truncate max-w-[140px] mt-0.5 inline-block">
                          📌 {e.purpose}
                        </span>
                      )}
                      {e.location && (
                        <span className="text-xs font-normal text-slate-600 truncate">
                          📍 {e.location}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* ALC */}
                  <td className="py-1.5 px-1.5 text-center border-r border-slate-200">
                    <span
                      className={`px-1.5 py-0.5 rounded text-xs font-normal border ${
                        isAlcFail
                          ? 'bg-red-100 text-red-900 border-red-400'
                          : 'bg-emerald-100 text-emerald-900 border-emerald-400'
                      }`}
                    >
                      {e.alc_result}
                    </span>
                  </td>

                  {/* PPE */}
                  <td className="py-1.5 px-2 text-center border-r border-slate-200">
                    <PPECompact entry={e} />
                  </td>

                  {/* Wage */}
                  <td className="py-1.5 px-2 text-right border-r border-slate-200 font-mono text-xs">
                    {e.daily_wage ? (
                      <span className="font-normal text-slate-950">{e.daily_wage.toLocaleString()}</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-1.5 px-1 text-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger className="w-6 h-6 inline-flex items-center justify-center rounded hover:bg-slate-100 text-slate-500 transition-colors">
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-[130px] text-xs">
                        <DropdownMenuItem>
                          <Link href={`/checklist/${e.id}/edit`} className="flex items-center gap-1.5 w-full">
                            <Pencil className="w-3 h-3" /> แก้ไขข้อมูล
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onDelete(e.id)}
                          className="text-red-600 flex items-center gap-1.5"
                        >
                          <Trash2 className="w-3 h-3" /> ลบรายการ
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Footer Info Strip */}
      <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
        <span>
          แสดงทั้งหมด <strong className="text-slate-900 font-semibold">{entries.length}</strong> รายการ
        </span>
        <span>
          ตรวจผ่านครบ: <strong className="text-emerald-800 font-semibold">{entries.filter(e => isAlcoholPassed(e.alc_result) && e.ppe_helmet && e.ppe_vest && e.ppe_shirt && e.ppe_gloves && e.ppe_shoes).length}</strong> รายการ
        </span>
      </div>
    </div>
  )
}
