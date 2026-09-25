'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ChecklistEntry } from '@/lib/types'
import { format } from 'date-fns'
import { toast } from 'sonner'

import { ChecklistTable } from '@/components/checklist/ChecklistTable'
import { ChecklistCards } from '@/components/checklist/ChecklistCards'
import { QuickTeamChecklist } from '@/components/checklist/QuickTeamChecklist'
import {
  Plus, Search, RefreshCw, LayoutGrid, TableProperties,
  ChevronLeft, ChevronRight, CalendarDays, AlertTriangle,
  Zap, FileText, MessageSquare, Smartphone
} from 'lucide-react'
import Link from 'next/link'

export default function ChecklistPage() {
  const supabase = createClient()
  const [entries, setEntries] = useState<ChecklistEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'team' | 'list'>('team')
  const [view, setView] = useState<'table' | 'cards'>('table')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('checklist_entries').select('*')
      .eq('entry_date', date).order('created_at', { ascending: true })
    if (search) q = q.or(
      `contractor_name.ilike.%${search}%,company_name.ilike.%${search}%,supervisor.ilike.%${search}%,activity_name.ilike.%${search}%`
    )
    const { data, error } = await q
    if (error) toast.error('โหลดข้อมูลไม่สำเร็จ')
    else setEntries(data ?? [])
    setLoading(false)
  }, [date, search])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  useEffect(() => {
    const ch = supabase.channel('cl_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_entries' }, fetchEntries)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [fetchEntries])

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('checklist_entries').delete().eq('id', id)
    if (error) toast.error('ลบไม่สำเร็จ')
    else { toast.success('ลบรายการแล้ว'); fetchEntries() }
  }

  const shiftDate = (d: -1 | 1) => {
    const dt = new Date(date); dt.setDate(dt.getDate() + d)
    setDate(format(dt, 'yyyy-MM-dd'))
  }

  const isToday = date === format(new Date(), 'yyyy-MM-dd')

  const stats = {
    total: entries.length,
    fail: entries.filter(e => e.alc_result === '>0%').length,
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full gap-2">

      {/* ── Compact Top Controls Bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 p-2 bg-white rounded-lg border border-slate-300 shadow-2xs">
        {/* Left: Mode Tabs & Stats */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center p-0.5 rounded-md bg-slate-100 border border-slate-300">
            <button
              onClick={() => setActiveTab('team')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition-all ${
                activeTab === 'team'
                  ? 'bg-white text-blue-900 shadow-2xs'
                  : 'text-slate-700 hover:text-slate-950 font-semibold'
              }`}
            >
              <Zap className={`w-3.5 h-3.5 ${activeTab === 'team' ? 'text-amber-500 fill-amber-400' : 'text-slate-500'}`} />
              <span className="hidden sm:inline">ตรวจ Checklist ตามสังกัด</span>
              <span className="sm:hidden">ตรวจตามสังกัด</span>
            </button>

            <button
              onClick={() => setActiveTab('list')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition-all ${
                activeTab === 'list'
                  ? 'bg-white text-blue-900 shadow-2xs'
                  : 'text-slate-700 hover:text-slate-950 font-semibold'
              }`}
            >
              <FileText className={`w-3.5 h-3.5 ${activeTab === 'list' ? 'text-blue-700' : 'text-slate-500'}`} />
              <span className="hidden sm:inline">รายการบันทึก ({entries.length})</span>
              <span className="sm:hidden">บันทึกแล้ว ({entries.length})</span>
            </button>
          </div>

          {/* Inline Stats Badges */}
          <div className="hidden sm:flex items-center gap-1.5 text-[11px]">
            <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-900 font-bold border border-blue-300">
              รวม {stats.total} รายการ
            </span>
            {stats.fail > 0 && (
              <span className="px-2 py-0.5 rounded bg-red-100 text-red-900 font-bold border border-red-300 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-red-700" />
                ALC เกิน {stats.fail} คน
              </span>
            )}
          </div>
        </div>

        {/* Right: Date Navigator & Refresh & Add */}
        <div className="flex items-center gap-1.5 ml-auto">
          <div className="flex items-center h-8 border border-slate-300 rounded-md bg-slate-50 overflow-hidden">
            <button
              onClick={() => shiftDate(-1)}
              className="w-7 h-full flex items-center justify-center hover:bg-slate-200 text-slate-700 transition-colors"
              title="วันก่อนหน้า"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <div className="flex items-center gap-1.5 px-2 border-x border-slate-300 bg-white h-full">
              <CalendarDays className="w-3.5 h-3.5 text-blue-700 shrink-0" />
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="text-xs font-bold text-slate-950 bg-transparent border-none outline-none cursor-pointer"
              />
            </div>

            <button
              onClick={() => shiftDate(1)}
              className="w-7 h-full flex items-center justify-center hover:bg-slate-200 text-slate-700 transition-colors"
              title="วันถัดไป"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {!isToday && (
            <button
              onClick={() => setDate(format(new Date(), 'yyyy-MM-dd'))}
              className="h-8 px-2 text-[11px] font-bold text-blue-900 bg-blue-100 border border-blue-300 rounded-md hover:bg-blue-200"
            >
              วันนี้
            </button>
          )}

          <button
            onClick={fetchEntries}
            className="w-8 h-8 flex items-center justify-center rounded-md border border-slate-300 hover:bg-slate-100 text-slate-700 transition-colors"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <Link
            href="/line-oa"
            className="h-8 px-2.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-2xs transition-colors"
            title="สรุปผลและส่งแจ้งเตือนเข้า LINE OA"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">แจ้งเตือน LINE</span>
          </Link>
        </div>
      </div>

      {/* ── MAIN CONTENT BASED ON ACTIVE TAB ── */}
      {activeTab === 'team' ? (
        <QuickTeamChecklist
          date={date}
          entries={entries}
          onRefreshEntries={fetchEntries}
        />
      ) : (
        <div className="flex flex-col flex-1 min-h-0 h-full gap-2">
          <div className="flex items-center justify-between gap-2 p-1.5 bg-white border border-slate-300 rounded-lg shadow-2xs shrink-0">
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                type="search"
                className="w-full text-xs pl-8 pr-3 py-1 rounded border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 font-normal placeholder:text-slate-400"
                placeholder="ค้นหาชื่อ, บริษัท, กิจกรรม..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* View toggle */}
            <div className="flex items-center gap-0.5 p-0.5 rounded bg-slate-100 border border-slate-300">
              <button
                className={`p-1 rounded transition-colors ${view === 'table' ? 'bg-white text-blue-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => setView('table')}
                title="มุมมองตาราง"
              >
                <TableProperties className="w-3.5 h-3.5" />
              </button>
              <button
                className={`p-1 rounded transition-colors ${view === 'cards' ? 'bg-white text-blue-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => setView('cards')}
                title="มุมมองการ์ด"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {view === 'table'
            ? <ChecklistTable entries={entries} loading={loading} onDelete={handleDelete} />
            : <ChecklistCards entries={entries} loading={loading} onDelete={handleDelete} />
          }
        </div>
      )}
    </div>
  )
}
