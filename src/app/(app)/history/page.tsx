'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { ChecklistEntry } from '@/lib/types'
import { isAlcoholFailed } from '@/lib/types'
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns'

import { ChecklistTable } from '@/components/checklist/ChecklistTable'
import { ChecklistCards } from '@/components/checklist/ChecklistCards'
import {
  Search, RefreshCw, LayoutGrid, TableProperties,
  Calendar, History, AlertTriangle, ShieldAlert
} from 'lucide-react'

export default function HistoryPage() {
  const supabase = useMemo(() => createClient(), [])
  const [entries, setEntries] = useState<ChecklistEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')
  const [dateFrom, setDateFrom] = useState(
    format(subDays(new Date(), 7), 'yyyy-MM-dd')
  )
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'))

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ from: dateFrom, to: dateTo })
      if (search.trim()) params.set('search', search.trim())
      const res = await fetch(`/api/checklist?${params.toString()}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setEntries(json.data ?? [])
    } catch {
      toast.error('โหลดข้อมูลไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, search])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/checklist/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('ลบไม่สำเร็จ')
      toast.success('ลบรายการแล้ว')
      fetchEntries()
    } catch {
      toast.error('ลบไม่สำเร็จ')
    }
  }

  const setPresetRange = (type: '7d' | '30d' | 'thisMonth') => {
    const now = new Date()
    if (type === '7d') {
      setDateFrom(format(subDays(now, 7), 'yyyy-MM-dd'))
      setDateTo(format(now, 'yyyy-MM-dd'))
    } else if (type === '30d') {
      setDateFrom(format(subDays(now, 30), 'yyyy-MM-dd'))
      setDateTo(format(now, 'yyyy-MM-dd'))
    } else if (type === 'thisMonth') {
      setDateFrom(format(startOfMonth(now), 'yyyy-MM-dd'))
      setDateTo(format(endOfMonth(now), 'yyyy-MM-dd'))
    }
  }

  const totalDays = [...new Set(entries.map(e => e.entry_date))].length
  const alcFailCount = entries.filter(e => isAlcoholFailed(e.alc_result)).length
  const blackCount = entries.filter(e => e.is_blacklisted).length

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full gap-2 overflow-hidden">

      {/* ── Compact Controls Toolbar ── */}
      <div className="p-2 bg-white rounded-lg border border-slate-300 shadow-2xs flex flex-wrap items-center justify-between gap-2 shrink-0">
        
        {/* Left: Title & Date Range */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-100 text-slate-800 text-xs font-bold shrink-0">
            <History className="w-3.5 h-3.5 text-blue-600" />
            <span>ประวัติย้อนหลัง</span>
          </div>

          {/* Date Range Picker */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-slate-200 bg-slate-50 text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="text-xs font-bold text-slate-800 bg-transparent border-none outline-none cursor-pointer"
            />
            <span className="text-slate-400">-</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="text-xs font-bold text-slate-800 bg-transparent border-none outline-none cursor-pointer"
            />
          </div>

          {/* Quick presets */}
          <div className="hidden sm:flex items-center gap-1 text-[11px]">
            <button
              onClick={() => setPresetRange('7d')}
              className="px-2 py-0.5 rounded border border-slate-200 hover:bg-slate-100 text-slate-600"
            >
              7 วัน
            </button>
            <button
              onClick={() => setPresetRange('30d')}
              className="px-2 py-0.5 rounded border border-slate-200 hover:bg-slate-100 text-slate-600"
            >
              30 วัน
            </button>
            <button
              onClick={() => setPresetRange('thisMonth')}
              className="px-2 py-0.5 rounded border border-slate-200 hover:bg-slate-100 text-slate-600"
            >
              เดือนนี้
            </button>
          </div>

          {/* Inline Summary Badges */}
          <div className="hidden md:flex items-center gap-1.5 text-[11px]">
            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold border border-blue-200">
              รวม {entries.length} รายการ
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
              {totalDays} วัน
            </span>
            {alcFailCount > 0 && (
              <span className="px-2 py-0.5 rounded bg-red-50 text-red-700 font-bold border border-red-200 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                ALC เกิน {alcFailCount}
              </span>
            )}
            {blackCount > 0 && (
              <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-bold border border-purple-200 flex items-center gap-1">
                <ShieldAlert className="w-3 h-3" />
                บัญชีดำ {blackCount}
              </span>
            )}
          </div>
        </div>

        {/* Right: Search + View toggle + Refresh */}
        <div className="flex items-center gap-1.5 ml-auto">
          {/* Search */}
          <div className="relative w-44 sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="search"
              placeholder="ค้นหาชื่อ, บริษัท, งาน..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full text-xs pl-8 pr-2.5 py-1 rounded border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-0.5 p-0.5 rounded bg-slate-100 border border-slate-200">
            <button
              className={`p-1 rounded transition-colors ${viewMode === 'table' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'}`}
              onClick={() => setViewMode('table')}
              title="มุมมองตาราง"
            >
              <TableProperties className="w-3.5 h-3.5" />
            </button>
            <button
              className={`p-1 rounded transition-colors ${viewMode === 'cards' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'}`}
              onClick={() => setViewMode('cards')}
              title="มุมมองการ์ด"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Refresh */}
          <button
            onClick={fetchEntries}
            className="w-7 h-7 flex items-center justify-center rounded border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Table Grid / Cards (Fills Full Height) ── */}
      {viewMode === 'table' ? (
        <ChecklistTable
          entries={entries}
          loading={loading}
          onDelete={handleDelete}
          showDate={true}
        />
      ) : (
        <div className="flex-1 overflow-auto min-h-0">
          <ChecklistCards
            entries={entries}
            loading={loading}
            onDelete={handleDelete}
          />
        </div>
      )}
    </div>
  )
}
