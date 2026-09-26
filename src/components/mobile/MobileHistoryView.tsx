'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { ChecklistEntry } from '@/lib/types'
import { isAlcoholFailed, isAlcoholPassed, isAlcoholUnchecked } from '@/lib/types'
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns'
import {
  History, Search, RefreshCw, Calendar, AlertTriangle, ShieldAlert,
  CheckCircle2, XCircle, Trash2, Clock, MapPin, HardHat
} from 'lucide-react'
import { extractUserNote } from '@/lib/utils'

interface MobileHistoryViewProps {
  onOpenAuth?: () => void
  mobileUser?: { name?: string; role?: string } | null
}

export function MobileHistoryView({ onOpenAuth, mobileUser }: MobileHistoryViewProps) {
  const supabase = useMemo(() => createClient(), [])
  const [entries, setEntries] = useState<ChecklistEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [preset, setPreset] = useState<'today' | '7d' | '30d' | 'thisMonth'>('7d')
  
  const [dateFrom, setDateFrom] = useState(
    format(subDays(new Date(), 7), 'yyyy-MM-dd')
  )
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'))

  const fetchEntries = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true)
    else setRefreshing(true)

    try {
      const params = new URLSearchParams()
      if (dateFrom) params.set('from', dateFrom)
      if (dateTo) params.set('to', dateTo)
      if (search.trim()) params.set('search', search.trim())

      const res = await fetch(`/api/checklist?${params.toString()}`)
      const { data, error } = await res.json()
      if (error) throw new Error(error)
      setEntries(data ?? [])
    } catch (err: unknown) {
      console.error('Fetch history error:', err)
      toast.error('โหลดข้อมูลประวัติไม่สำเร็จ')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [dateFrom, dateTo, search])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  const setPresetRange = (type: 'today' | '7d' | '30d' | 'thisMonth') => {
    setPreset(type)
    const now = new Date()
    if (type === 'today') {
      const todayStr = format(now, 'yyyy-MM-dd')
      setDateFrom(todayStr)
      setDateTo(todayStr)
    } else if (type === '7d') {
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

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`ต้องการลบรายการของ "${name}" หรือไม่?`)) return
    try {
      const { error } = await supabase.from('checklist_entries').delete().eq('id', id)
      if (error) throw error
      toast.success('ลบรายการประวัติแล้ว')
      setEntries(prev => prev.filter(e => e.id !== id))
    } catch {
      toast.error('ลบไม่สำเร็จ')
    }
  }

  // Summary stats
  const stats = useMemo(() => {
    const total = entries.length
    const alcFail = entries.filter(e => isAlcoholFailed(e.alc_result)).length
    const blacklisted = entries.filter(e => e.is_blacklisted).length
    const ppeFail = entries.filter(
      e => !e.ppe_helmet || !e.ppe_vest || !e.ppe_shoes
    ).length
    const passed = entries.filter(
      e => !isAlcoholFailed(e.alc_result) && !e.is_blacklisted && e.ppe_helmet && e.ppe_vest && e.ppe_shoes
    ).length
    return { total, alcFail, blacklisted, ppeFail, passed }
  }, [entries])

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full bg-slate-100 overflow-hidden">
      {/* ── Mobile Header (Premium Dark Gradient) ── */}
      <header className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-white px-3.5 py-2.5 shrink-0 flex items-center justify-between border-b border-slate-800 shadow-md">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 border border-blue-400/30 flex items-center justify-center text-white shadow-sm shrink-0">
            <History className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold tracking-tight text-white truncate leading-tight">
              ประวัติการตรวจ
            </h1>
            <p className="text-xs text-slate-300 font-normal leading-tight mt-0.5">
              รวม <span className="font-semibold text-white">{stats.total}</span> รายการ ({stats.passed} ผ่าน)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => fetchEntries(true)}
            disabled={refreshing || loading}
            className="h-8 px-2.5 flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white border border-white/20 transition-all text-xs font-semibold disabled:opacity-50 active:scale-95"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing || loading ? 'animate-spin text-blue-400' : ''}`} />
            <span className="hidden sm:inline">รีเฟรช</span>
          </button>
        </div>
      </header>

      {/* ── Filter Controls (Height h-9 for Search & Presets) ── */}
      <div className="bg-white p-2.5 border-b border-slate-300 shadow-2xs space-y-2 shrink-0">
        {/* Quick Date Presets & Date Pickers (h-9) */}
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5">
            <button
              onClick={() => setPresetRange('today')}
              className={`h-9 text-xs px-3 rounded-lg transition-all shrink-0 flex items-center ${
                preset === 'today'
                  ? 'bg-blue-600 text-white font-semibold shadow-2xs'
                  : 'bg-slate-100 text-slate-800 hover:bg-slate-200 font-normal border border-slate-300'
              }`}
            >
              วันนี้
            </button>
            <button
              onClick={() => setPresetRange('7d')}
              className={`h-9 text-xs px-3 rounded-lg transition-all shrink-0 flex items-center ${
                preset === '7d'
                  ? 'bg-blue-600 text-white font-semibold shadow-2xs'
                  : 'bg-slate-100 text-slate-800 hover:bg-slate-200 font-normal border border-slate-300'
              }`}
            >
              7 วัน
            </button>
            <button
              onClick={() => setPresetRange('30d')}
              className={`h-9 text-xs px-3 rounded-lg transition-all shrink-0 flex items-center ${
                preset === '30d'
                  ? 'bg-blue-600 text-white font-semibold shadow-2xs'
                  : 'bg-slate-100 text-slate-800 hover:bg-slate-200 font-normal border border-slate-300'
              }`}
            >
              30 วัน
            </button>
            <button
              onClick={() => setPresetRange('thisMonth')}
              className={`h-9 text-xs px-3 rounded-lg transition-all shrink-0 flex items-center ${
                preset === 'thisMonth'
                  ? 'bg-blue-600 text-white font-semibold shadow-2xs'
                  : 'bg-slate-100 text-slate-800 hover:bg-slate-200 font-normal border border-slate-300'
              }`}
            >
              เดือนนี้
            </button>
          </div>

          {/* Date range picker (h-9) */}
          <div className="h-9 flex items-center gap-1 text-xs text-slate-900 bg-slate-50 border border-slate-300 px-2 rounded-lg shrink-0 font-normal">
            <Calendar className="w-3.5 h-3.5 text-slate-600 shrink-0" />
            <input
              type="date"
              value={dateFrom}
              onChange={e => {
                setDateFrom(e.target.value)
                setPreset('today')
              }}
              className="text-xs bg-transparent border-none outline-none cursor-pointer w-24 text-slate-900 font-normal"
            />
            <span className="text-slate-500">-</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => {
                setDateTo(e.target.value)
                setPreset('today')
              }}
              className="text-xs bg-transparent border-none outline-none cursor-pointer w-24 text-slate-900 font-normal"
            />
          </div>
        </div>

        {/* Search Input (h-9) */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            type="search"
            placeholder="ค้นหาชื่อช่าง, สังกัด, กิจกรรม..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-9 text-xs pl-9 pr-3 rounded-lg border border-slate-300 bg-white text-slate-900 font-normal focus:outline-none focus:ring-1 focus:ring-blue-600 placeholder:text-slate-500"
          />
        </div>

        {/* High Contrast Summary Badges Strip */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pt-0.5 text-xs">
          <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-900 border border-slate-300 font-semibold shrink-0">
            รวม {stats.total} รายการ
          </span>
          <span className="px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-950 border border-emerald-300 font-semibold shrink-0 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-700" /> ผ่าน {stats.passed}
          </span>
          {stats.alcFail > 0 && (
            <span className="px-2.5 py-1 rounded-md bg-red-100 text-red-950 border border-red-300 font-semibold shrink-0 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-red-700" /> ALC เกิน {stats.alcFail}
            </span>
          )}
          {stats.ppeFail > 0 && (
            <span className="px-2.5 py-1 rounded-md bg-rose-100 text-rose-950 border border-rose-300 font-semibold shrink-0 flex items-center gap-1">
              <XCircle className="w-3 h-3 text-rose-700" /> PPE ไม่ครบ {stats.ppeFail}
            </span>
          )}
          {stats.blacklisted > 0 && (
            <span className="px-2.5 py-1 rounded-md bg-purple-100 text-purple-950 border border-purple-300 font-semibold shrink-0 flex items-center gap-1">
              <ShieldAlert className="w-3 h-3 text-purple-700" /> บัญชีดำ {stats.blacklisted}
            </span>
          )}
        </div>
      </div>

      {/* ── History Card List (mini-Compact Layout) ── */}
      <div className="flex-1 overflow-y-auto min-h-0 p-2 space-y-2">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-xs font-normal">กำลังโหลดประวัติ...</span>
          </div>
        ) : entries.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-300 p-8 text-center flex flex-col items-center justify-center gap-2">
            <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-500">
              <History className="w-5 h-5" />
            </div>
            <p className="text-xs font-semibold text-slate-900">ไม่พบประวัติการตรวจ</p>
            <p className="text-xs text-slate-600 font-normal">
              ลองเปลี่ยนช่วงวันที่หรือพิมพ์ค้นหาใหม่
            </p>
          </div>
        ) : (
          entries.map(entry => {
            const hasAlcFail = isAlcoholFailed(entry.alc_result)
            const isBlack = entry.is_blacklisted
            const ppeOk = entry.ppe_helmet && entry.ppe_vest && entry.ppe_shoes
            const isPass = !hasAlcFail && !isBlack && ppeOk

            return (
              <div
                key={entry.id}
                className={`bg-white rounded-xl border p-2.5 shadow-2xs space-y-2 transition-all ${
                  isBlack
                    ? 'border-purple-300 bg-purple-50/30'
                    : hasAlcFail
                    ? 'border-red-300 bg-red-50/30'
                    : !isPass
                    ? 'border-amber-300 bg-amber-50/30'
                    : 'border-slate-300 hover:border-slate-400'
                }`}
              >
                {/* Card Top: Contractor name, date badge, delete button */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                        isBlack
                          ? 'bg-purple-200 text-purple-950 border border-purple-300'
                          : hasAlcFail
                          ? 'bg-red-200 text-red-950 border border-red-300'
                          : !isPass
                          ? 'bg-amber-200 text-amber-950 border border-amber-300'
                          : 'bg-emerald-100 text-emerald-950 border border-emerald-300'
                      }`}
                    >
                      {entry.contractor_name?.trim().charAt(0) || <HardHat className="w-4 h-4" />}
                    </div>

                    <div className="min-w-0">
                      <h2 className="text-xs font-semibold text-slate-900 truncate leading-tight">
                        {entry.contractor_name || 'ไม่ระบุชื่อ'}
                      </h2>
                      <div className="flex items-center gap-1.5 text-xs text-slate-700 font-normal mt-0.5">
                        {entry.company_name && (
                          <span className="bg-slate-100 text-slate-900 border border-slate-300 px-1.5 py-0.2 rounded truncate max-w-[140px] font-normal">
                            {entry.company_name}
                          </span>
                        )}
                        {entry.supervisor && (
                          <span className="truncate max-w-[110px] text-slate-600 font-normal">
                            • หน. {entry.supervisor}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Date & Time pill */}
                  <div className="flex items-center gap-1 shrink-0">
                    <div className="text-right">
                      <span className="text-xs font-semibold text-slate-900 block leading-tight">
                        {entry.entry_date ? format(new Date(entry.entry_date), 'dd/MM/yyyy') : '-'}
                      </span>
                      {entry.created_at && (
                        <span className="text-xs text-slate-600 font-normal flex items-center justify-end gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          {format(new Date(entry.created_at), 'HH:mm')}
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => handleDelete(entry.id, entry.contractor_name || '')}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-red-700 hover:bg-red-50 transition-colors ml-0.5"
                      title="ลบรายการ"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Activity & Location row */}
                {(entry.activity_name || entry.location) && (
                  <div className="flex items-center gap-2 flex-wrap text-xs bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                    {entry.activity_name && (
                      <span className="font-semibold text-purple-950 flex items-center gap-1">
                        🎯 {entry.activity_name}
                      </span>
                    )}
                    {entry.location && (
                      <span className="text-slate-700 font-normal flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-500" />
                        {entry.location}
                      </span>
                    )}
                  </div>
                )}

                {/* Checklist Badges Result */}
                <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-200 text-xs">
                  {/* Alcohol Result */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-700 font-normal">ALC:</span>
                    {isAlcoholUnchecked(entry.alc_result) ? (
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-normal text-xs border border-slate-300">
                        ยังไม่ได้ตรวจ
                      </span>
                    ) : hasAlcFail ? (
                      <span className="px-2 py-0.5 rounded bg-red-100 text-red-950 font-bold text-xs border border-red-300">
                        {entry.alc_result || 'ไม่ผ่าน'} (เกินเกณฑ์)
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-950 font-semibold text-xs border border-emerald-300">
                        {entry.alc_result || '0'} mg% (ปกติ)
                      </span>
                    )}
                  </div>

                  {/* Safety / Status Badge */}
                  <div className="flex items-center gap-1">
                    {isBlack ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-950 border border-purple-300 font-bold text-xs flex items-center gap-1">
                        <ShieldAlert className="w-3.5 h-3.5 text-purple-700" /> บัญชีดำ
                      </span>
                    ) : isPass ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-950 border border-emerald-300 font-bold text-xs flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" /> ผ่านตรวจ
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-950 border border-rose-300 font-bold text-xs flex items-center gap-1">
                        <XCircle className="w-3.5 h-3.5 text-rose-700" /> ไม่ผ่าน
                      </span>
                    )}
                  </div>
                </div>

                {/* Purpose or Notes if any */}
                {(() => {
                  const userNote = extractUserNote(entry.notes)
                  if (!entry.purpose && !userNote) return null
                  return (
                    <div className="text-xs text-slate-700 font-normal bg-slate-50 px-2 py-1 rounded border border-slate-200 space-y-0.5">
                      {entry.purpose && <p><strong className="text-slate-900 font-semibold">ความประสงค์:</strong> {entry.purpose}</p>}
                      {userNote && <p><strong className="text-slate-900 font-semibold">หมายเหตุ:</strong> {userNote}</p>}
                    </div>
                  )
                })()}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
