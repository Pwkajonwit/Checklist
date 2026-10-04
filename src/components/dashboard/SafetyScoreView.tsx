'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Award, AlertTriangle, ShieldCheck, Search, Filter,
  Calendar, RefreshCw, ChevronRight, ChevronDown, User, Building2,
  CheckCircle2, XCircle, TrendingUp, HelpCircle, X,
  ArrowUpDown, ExternalLink, ChevronsUpDown
} from 'lucide-react'
import { format, subDays, startOfMonth, endOfMonth, parseISO } from 'date-fns'
import { th } from 'date-fns/locale'
import type { ChecklistEntry } from '@/lib/types'
import { isAlcoholPassed } from '@/lib/types'

export interface WorkerSafetyScore {
  id: string
  name: string
  company: string
  passedDays: number
  failedCount: number
  totalDays: number
  netScore: number
  passRate: number
  failedEntries: {
    date: string
    reason: string
    alcResult?: string | null
    missingPpe: string[]
  }[]
  passedDates: string[]
}

export interface CompanyGroup {
  name: string
  workers: WorkerSafetyScore[]
  totalWorkers: number
  totalPassedDays: number
  totalFailedCount: number
  totalNetScore: number
  avgScore: number
  passRate: number
}

export function SafetyScoreView() {
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'))
  const [periodPreset, setPeriodPreset] = useState<'thisMonth' | '30d' | '7d'>('thisMonth')
  const [entries, setEntries] = useState<ChecklistEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCompany, setSelectedCompany] = useState<string>('all')
  const [collapsedCompanies, setCollapsedCompanies] = useState<Set<string>>(new Set())
  const [selectedWorker, setSelectedWorker] = useState<WorkerSafetyScore | null>(null)

  // Fetch entries within date range
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ from: dateFrom, to: dateTo })
      const res = await fetch(`/api/checklist?${params.toString()}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setEntries(json.data ?? [])
    } catch (err) {
      console.error('Error fetching safety score data:', err)
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Handle Preset Changes
  const handlePreset = (type: 'thisMonth' | '30d' | '7d') => {
    setPeriodPreset(type)
    const now = new Date()
    if (type === 'thisMonth') {
      setDateFrom(format(startOfMonth(now), 'yyyy-MM-dd'))
      setDateTo(format(endOfMonth(now), 'yyyy-MM-dd'))
    } else if (type === '30d') {
      setDateFrom(format(subDays(now, 29), 'yyyy-MM-dd'))
      setDateTo(format(now, 'yyyy-MM-dd'))
    } else if (type === '7d') {
      setDateFrom(format(subDays(now, 6), 'yyyy-MM-dd'))
      setDateTo(format(now, 'yyyy-MM-dd'))
    }
  }

  // Calculate Scores per Worker (+1 for pass, -5 for fail)
  const workerScores: WorkerSafetyScore[] = useMemo(() => {
    const map = new Map<string, WorkerSafetyScore>()

    entries.forEach(e => {
      const wId = e.contractor_id || e.contractor_name
      if (!wId) return

      if (!map.has(wId)) {
        map.set(wId, {
          id: wId,
          name: e.contractor_name,
          company: e.company_name?.trim() || 'ไม่ระบุสังกัด',
          passedDays: 0,
          failedCount: 0,
          totalDays: 0,
          netScore: 0,
          passRate: 100,
          failedEntries: [],
          passedDates: [],
        })
      }

      const item = map.get(wId)!
      item.totalDays += 1

      const isAlcPass = isAlcoholPassed(e.alc_result)
      const isPpePass = Boolean(
        e.ppe_helmet && e.ppe_vest && e.ppe_shirt && e.ppe_gloves && e.ppe_shoes
      )

      if (isAlcPass && isPpePass) {
        item.passedDays += 1
        item.netScore += 1 // +1 คะแนน เมื่อมาทำงานและตรวจผ่านครบ
        if (!item.passedDates.includes(e.entry_date)) {
          item.passedDates.push(e.entry_date)
        }
      } else {
        item.failedCount += 1
        item.netScore -= 5 // -5 คะแนน เมื่อตรวจไม่ผ่าน

        const missingPpe: string[] = []
        if (!e.ppe_helmet) missingPpe.push('หมวก')
        if (!e.ppe_vest) missingPpe.push('เสื้อกั๊ก')
        if (!e.ppe_shirt) missingPpe.push('แว่นตา')
        if (!e.ppe_gloves) missingPpe.push('ถุงมือ')
        if (!e.ppe_shoes) missingPpe.push('รองเท้า')

        const reasons: string[] = []
        if (!isAlcPass) reasons.push(`ALC ${e.alc_result || 'ไม่ผ่าน'}`)
        if (missingPpe.length > 0) reasons.push(`ขาด ${missingPpe.join('/')}`)

        item.failedEntries.push({
          date: e.entry_date,
          reason: reasons.join(', ') || 'ไม่ผ่านเกณฑ์ความปลอดภัย',
          alcResult: e.alc_result,
          missingPpe,
        })
      }
    })

    const list = Array.from(map.values()).map(w => {
      w.passRate = w.totalDays > 0 ? Math.round((w.passedDays / w.totalDays) * 100) : 100
      return w
    })

    return list.sort((a, b) => b.netScore - a.netScore || b.passedDays - a.passedDays)
  }, [entries])

  // Group Workers by Company (แยกแต่ละบริษัทให้ดูง่ายๆ)
  const companyGroups: CompanyGroup[] = useMemo(() => {
    const compMap = new Map<string, WorkerSafetyScore[]>()

    workerScores.forEach(w => {
      const comp = w.company || 'ไม่ระบุสังกัด'
      if (!compMap.has(comp)) {
        compMap.set(comp, [])
      }
      compMap.get(comp)!.push(w)
    })

    return Array.from(compMap.entries()).map(([compName, workers]) => {
      const totalWorkers = workers.length
      const totalPassedDays = workers.reduce((sum, w) => sum + w.passedDays, 0)
      const totalFailedCount = workers.reduce((sum, w) => sum + w.failedCount, 0)
      const totalNetScore = workers.reduce((sum, w) => sum + w.netScore, 0)
      const totalChecks = totalPassedDays + totalFailedCount
      const avgScore = totalWorkers > 0 ? Number((totalNetScore / totalWorkers).toFixed(1)) : 0
      const passRate = totalChecks > 0 ? Math.round((totalPassedDays / totalChecks) * 100) : 100

      return {
        name: compName,
        workers: workers.sort((a, b) => b.netScore - a.netScore || b.passedDays - a.passedDays),
        totalWorkers,
        totalPassedDays,
        totalFailedCount,
        totalNetScore,
        avgScore,
        passRate,
      }
    }).sort((a, b) => b.totalPassedDays - a.totalPassedDays || b.avgScore - a.avgScore)
  }, [workerScores])

  // Unique companies list for pill buttons
  const companyList = useMemo(() => {
    return companyGroups.map(g => ({
      name: g.name,
      count: g.totalWorkers,
    }))
  }, [companyGroups])

  // Filter company groups by search and selected company
  const filteredCompanyGroups = useMemo(() => {
    return companyGroups
      .filter(g => selectedCompany === 'all' || g.name === selectedCompany)
      .map(g => {
        if (!searchQuery.trim()) return g
        const filteredW = g.workers.filter(w =>
          w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          w.company.toLowerCase().includes(searchQuery.toLowerCase())
        )
        return {
          ...g,
          workers: filteredW,
        }
      })
      .filter(g => g.workers.length > 0)
  }, [companyGroups, selectedCompany, searchQuery])

  // Toggle company collapse
  const toggleCompany = (compName: string) => {
    setCollapsedCompanies(prev => {
      const next = new Set(prev)
      if (next.has(compName)) {
        next.delete(compName)
      } else {
        next.add(compName)
      }
      return next
    })
  }

  // Summary Metrics
  const metrics = useMemo(() => {
    const topWorker = workerScores[0] || null
    const penalizedWorkers = workerScores.filter(w => w.failedCount > 0)
    const totalChecks = entries.length
    const totalPassed = entries.filter(e =>
      isAlcoholPassed(e.alc_result) &&
      e.ppe_helmet && e.ppe_vest && e.ppe_shirt && e.ppe_gloves && e.ppe_shoes
    ).length
    const overallRate = totalChecks > 0 ? Math.round((totalPassed / totalChecks) * 100) : 100

    return {
      topWorker,
      penalizedCount: penalizedWorkers.length,
      totalDeductions: penalizedWorkers.reduce((sum, w) => sum + w.failedCount, 0),
      overallRate,
    }
  }, [workerScores, entries])

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden text-slate-800">
      
      {/* ── Top Bar: 3 Summary Cards (mini-Compact & High Contrast) ── */}
      <div className="px-3 py-2 bg-white border-b border-slate-200 shrink-0">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 max-w-6xl mx-auto">
          
          {/* Card 1: อันดับ 1 คะแนนสูงสุด */}
          <div className="flex items-center gap-2.5 p-2 rounded-lg border border-amber-300 bg-amber-50/80">
            <div className="w-8 h-8 rounded-md bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-800 font-bold shrink-0">
              <Award className="w-4 h-4 text-amber-700" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wide block">
                🥇 คะแนนสูงสุด
              </span>
              {metrics.topWorker ? (
                <div className="flex items-baseline gap-1.5 truncate">
                  <span className="text-xs font-semibold text-slate-900 truncate">
                    {metrics.topWorker.name}
                  </span>
                  <span className="text-[11px] text-slate-700 truncate font-normal">
                    ({metrics.topWorker.company})
                  </span>
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-1.5 py-0.2 rounded-sm ml-auto">
                    +{metrics.topWorker.netScore}
                  </span>
                </div>
              ) : (
                <span className="text-xs text-slate-600 font-normal">ยังไม่มีข้อมูล</span>
              )}
            </div>
          </div>

          {/* Card 2: กลุ่มที่ถูกตัดแต้ม */}
          <div className="flex items-center gap-2.5 p-2 rounded-lg border border-rose-300 bg-rose-50/80">
            <div className="w-8 h-8 rounded-md bg-rose-100 border border-rose-300 flex items-center justify-center text-rose-800 font-bold shrink-0">
              <AlertTriangle className="w-4 h-4 text-rose-700" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-bold text-rose-900 uppercase tracking-wide block">
                ⚠️ มีประวัติถูกตัดแต้ม (-5)
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-sm font-bold text-rose-800">
                  {metrics.penalizedCount}
                </span>
                <span className="text-xs text-slate-800 font-normal">
                  คน ({metrics.totalDeductions} ครั้ง)
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: ดัชนีความปลอดภัยรวม */}
          <div className="flex items-center gap-2.5 p-2 rounded-lg border border-emerald-300 bg-emerald-50/80">
            <div className="w-8 h-8 rounded-md bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-800 font-bold shrink-0">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-bold text-emerald-900 uppercase tracking-wide block">
                🛡️ ความปลอดภัยรวม
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-sm font-bold text-emerald-800">
                  {metrics.overallRate}%
                </span>
                <span className="text-xs text-slate-700 font-normal">
                  (ตรวจผ่าน {entries.length} ครั้ง)
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── Filter & Navigation Bar (ความสูง h-9 กระชับ สบายตา) ── */}
      <div className="px-3 py-2 bg-white border-b border-slate-200 shrink-0 space-y-2">
        
        {/* Row 1: Periods, Scoring Rule, Search (แถบเครื่องมือความสูง h-9) */}
        <div className="flex flex-wrap items-center justify-between gap-2 max-w-6xl mx-auto">
          
          {/* Period Presets: h-9 */}
          <div className="flex items-center h-9 bg-slate-100 p-0.5 rounded-lg border border-slate-300">
            <button
              onClick={() => handlePreset('thisMonth')}
              className={`h-full px-3 rounded-md text-xs transition-all ${
                periodPreset === 'thisMonth'
                  ? 'bg-slate-900 text-white font-semibold shadow-2xs'
                  : 'text-slate-800 font-normal hover:bg-slate-200'
              }`}
            >
              เดือนนี้
            </button>
            <button
              onClick={() => handlePreset('30d')}
              className={`h-full px-3 rounded-md text-xs transition-all ${
                periodPreset === '30d'
                  ? 'bg-slate-900 text-white font-semibold shadow-2xs'
                  : 'text-slate-800 font-normal hover:bg-slate-200'
              }`}
            >
              30 วัน
            </button>
            <button
              onClick={() => handlePreset('7d')}
              className={`h-full px-3 rounded-md text-xs transition-all ${
                periodPreset === '7d'
                  ? 'bg-slate-900 text-white font-semibold shadow-2xs'
                  : 'text-slate-800 font-normal hover:bg-slate-200'
              }`}
            >
              7 วัน
            </button>
          </div>

          {/* Scoring Rule Badge: h-9 */}
          <div className="hidden md:flex items-center h-9 gap-2.5 px-3 bg-slate-50 border border-slate-300 rounded-lg text-[11px] text-slate-800 font-normal">
            <span className="flex items-center gap-1.5 font-semibold text-emerald-800">
              <span className="w-2 h-2 rounded-full bg-emerald-600" /> ตรวจผ่าน +1
            </span>
            <span className="text-slate-300">|</span>
            <span className="flex items-center gap-1.5 font-semibold text-rose-800">
              <span className="w-2 h-2 rounded-full bg-rose-600" /> ตรวจไม่ผ่าน -5
            </span>
          </div>

          {/* Search Box & Refresh Button: h-9 */}
          <div className="flex items-center gap-1.5 h-9">
            <div className="relative h-9 flex items-center">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="ค้นหาชื่อช่าง / บริษัท..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="h-9 text-xs pl-8 pr-3 bg-white border border-slate-300 rounded-lg w-44 sm:w-56 text-slate-900 placeholder:text-slate-500 font-normal focus:outline-hidden focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
              />
            </div>
            <button
              onClick={fetchData}
              title="รีเฟรชข้อมูล"
              className="h-9 w-9 flex items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-all shrink-0 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </div>

        </div>

        {/* Row 2: Company Selector Pills: h-9 (แยกแต่ละบริษัทให้กดดูง่ายๆ) */}
        <div className="flex items-center gap-1.5 h-9 overflow-x-auto max-w-6xl mx-auto no-scrollbar">
          <span className="text-slate-800 text-[11px] font-semibold shrink-0 flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-slate-700" /> บริษัท:
          </span>
          <button
            onClick={() => setSelectedCompany('all')}
            className={`h-7 px-2.5 rounded-full text-[11px] shrink-0 transition-all cursor-pointer flex items-center gap-1 ${
              selectedCompany === 'all'
                ? 'bg-blue-600 text-white font-semibold shadow-2xs'
                : 'bg-white text-slate-800 border border-slate-300 font-normal hover:bg-slate-100'
            }`}
          >
            <span>ทั้งหมด</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[11px] font-semibold ${
              selectedCompany === 'all' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-700'
            }`}>
              {companyList.length}
            </span>
          </button>
          {companyList.map(c => {
            const isSelected = selectedCompany === c.name
            return (
              <button
                key={c.name}
                onClick={() => setSelectedCompany(c.name)}
                className={`h-7 px-2.5 rounded-full text-[11px] shrink-0 transition-all cursor-pointer flex items-center gap-1 ${
                  isSelected
                    ? 'bg-blue-600 text-white font-semibold shadow-2xs'
                    : 'bg-white text-slate-800 border border-slate-300 font-normal hover:bg-slate-100'
                }`}
              >
                <span>{c.name}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[11px] font-semibold ${
                  isSelected ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-700'
                }`}>
                  {c.count}
                </span>
              </button>
            )
          })}
        </div>

      </div>

      {/* ── Main Content Area: Grouped by Company (ตารางกระชับ คอนทราสต์ชัด) ── */}
      <div className="flex-1 overflow-auto p-2.5 sm:p-3">
        <div className="space-y-2.5 max-w-6xl mx-auto">
          
          {loading ? (
            <div className="p-10 text-center text-slate-600 space-y-2 bg-white rounded-lg border border-slate-300">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto text-blue-600" />
              <p className="text-xs font-normal">กำลังคำนวณคะแนนวินัยแยกตามบริษัท...</p>
            </div>
          ) : filteredCompanyGroups.length === 0 ? (
            <div className="p-10 text-center text-slate-600 space-y-1 bg-white rounded-lg border border-slate-300">
              <p className="text-xs font-semibold text-slate-900">ไม่พบข้อมูลตามเงื่อนไขที่เลือก</p>
              <p className="text-[11px] text-slate-600 font-normal">ลองเปลี่ยนช่วงเวลาหรือค้นหาด้วยคำค้นอื่น</p>
            </div>
          ) : (
            filteredCompanyGroups.map(comp => {
              const isCollapsed = collapsedCompanies.has(comp.name)

              return (
                <div
                  key={comp.name}
                  className="bg-white rounded-lg border border-slate-300 shadow-2xs overflow-hidden transition-all"
                >
                  {/* Company Card Header */}
                  <div
                    onClick={() => toggleCompany(comp.name)}
                    className="p-2 bg-slate-50 border-b border-slate-300 flex items-center justify-between gap-2 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                  >
                    {/* Left: Company Name & Worker Count */}
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-md bg-blue-100 border border-blue-300 text-blue-800 flex items-center justify-center shrink-0">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div className="truncate">
                        <span className="font-bold text-xs text-slate-900 truncate">
                          {comp.name}
                        </span>
                        <span className="text-[11px] font-normal text-slate-700 ml-1.5">
                          ({comp.totalWorkers} คน)
                        </span>
                      </div>
                    </div>

                    {/* Right: Summary Badges & Toggle */}
                    <div className="flex items-center gap-2 shrink-0">
                      
                      {/* มาทำงานรวม */}
                      <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-normal text-emerald-900 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded-md">
                        ✓ เข้างาน <strong className="font-semibold text-emerald-900">{comp.totalPassedDays}</strong> วัน
                      </span>

                      {/* ทำผิดกฎ */}
                      {comp.totalFailedCount > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-900 bg-rose-100 border border-rose-300 px-2 py-0.5 rounded-md">
                          ✕ ไม่ผ่าน {comp.totalFailedCount} ครั้ง
                        </span>
                      ) : (
                        <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-normal text-slate-700 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-md">
                          ✕ 0 ครั้ง
                        </span>
                      )}

                      {/* คะแนนเฉลี่ยต่อคน */}
                      <div className="flex items-center gap-1 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                        <span className="text-[11px] font-normal text-blue-800">เฉลี่ย:</span>
                        <span className="text-xs font-bold text-blue-900">
                          {comp.avgScore > 0 ? `+${comp.avgScore}` : comp.avgScore}
                        </span>
                      </div>

                      {/* Expand / Collapse Icon */}
                      <div className="p-0.5 rounded text-slate-600 hover:text-slate-900">
                        {isCollapsed ? (
                          <ChevronRight className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </div>

                    </div>
                  </div>

                  {/* Company Card Body: Worker Rows (ตารางกระชับ mini-Compact) */}
                  {!isCollapsed && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-100/90 border-b border-slate-300 text-[11px] font-semibold text-slate-800 uppercase tracking-wide">
                            <th className="py-1.5 px-3 text-center w-12">#</th>
                            <th className="py-1.5 px-3">ชื่อคนงาน / ช่าง</th>
                            <th className="py-1.5 px-3 text-center">เข้างาน (+1)</th>
                            <th className="py-1.5 px-3 text-center">ไม่ผ่าน (-5)</th>
                            <th className="py-1.5 px-3 text-center">คะแนนสุทธิ</th>
                            <th className="py-1.5 px-3 text-center">สถานะ</th>
                            <th className="py-1.5 px-3 text-center w-14">ดูย่อย</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-xs">
                          {comp.workers.map((w, idx) => {
                            const rank = idx + 1
                            const isTop1 = rank === 1

                            return (
                              <tr
                                key={w.id}
                                className={`hover:bg-slate-50 transition-colors ${
                                  w.netScore < 0 ? 'bg-rose-50/40' : ''
                                }`}
                              >
                                {/* Rank within company */}
                                <td className="py-1.5 px-3 text-center">
                                  {isTop1 ? (
                                    <span className="text-xs" title="อันดับ 1 ของบริษัท">🥇</span>
                                  ) : (
                                    <span className="text-slate-700 text-[11px] font-semibold">
                                      #{rank}
                                    </span>
                                  )}
                                </td>

                                {/* Name */}
                                <td className="py-1.5 px-3 text-slate-900 font-normal">
                                  <button
                                    onClick={() => setSelectedWorker(w)}
                                    className="hover:text-blue-700 hover:underline text-left cursor-pointer font-normal text-slate-900"
                                  >
                                    {w.name}
                                  </button>
                                </td>

                                {/* Passed Days (+1) */}
                                <td className="py-1.5 px-3 text-center font-normal text-slate-800">
                                  <span className="font-semibold text-emerald-800">{w.passedDays} วัน</span>
                                  <span className="text-[11px] text-emerald-700 font-normal ml-1">(+{w.passedDays})</span>
                                </td>

                                {/* Failed Count (-5) */}
                                <td className="py-1.5 px-3 text-center font-normal">
                                  {w.failedCount > 0 ? (
                                    <span className="text-rose-800 font-semibold bg-rose-100 border border-rose-300 px-1.5 py-0.5 rounded-sm text-xs">
                                      {w.failedCount} ครั้ง (-{w.failedCount * 5})
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 font-normal">-</span>
                                  )}
                                </td>

                                {/* Net Score Badge */}
                                <td className="py-1.5 px-3 text-center font-normal">
                                  {w.netScore > 0 ? (
                                    <span className="inline-block min-w-[42px] px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-400">
                                      +{w.netScore}
                                    </span>
                                  ) : w.netScore < 0 ? (
                                    <span className="inline-block min-w-[42px] px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-900 border border-rose-400">
                                      {w.netScore}
                                    </span>
                                  ) : (
                                    <span className="inline-block min-w-[42px] px-2 py-0.5 rounded-full text-xs font-normal bg-slate-100 text-slate-800 border border-slate-300">
                                      0
                                    </span>
                                  )}
                                </td>

                                {/* Status */}
                                <td className="py-1.5 px-3 text-center font-normal">
                                  {w.failedCount === 0 && w.passedDays >= 10 ? (
                                    <span className="text-[11px] font-semibold text-amber-900 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded-md">
                                      ⭐ ดีเด่น
                                    </span>
                                  ) : w.netScore < 0 || w.failedCount >= 2 ? (
                                    <span className="text-[11px] font-semibold text-rose-900 bg-rose-100 border border-rose-300 px-1.5 py-0.5 rounded-md">
                                      ⚠️ เฝ้าระวัง
                                    </span>
                                  ) : (
                                    <span className="text-[11px] font-normal text-slate-800">
                                      ✓ ปกติ
                                    </span>
                                  )}
                                </td>

                                {/* Action */}
                                <td className="py-1.5 px-3 text-center font-normal">
                                  <button
                                    onClick={() => setSelectedWorker(w)}
                                    title="ดูประวัติวันที่ได้แต้ม/โดนตัดแต้ม"
                                    className="p-1 rounded-md text-slate-600 hover:text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer"
                                  >
                                    <ChevronRight className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                </div>
              )
            })
          )}

        </div>
      </div>

      {/* ── Slide-over Detail Modal for Worker History ── */}
      {selectedWorker && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-2xs flex justify-end">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            
            {/* Modal Header */}
            <div className="p-3 border-b border-slate-300 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  {selectedWorker.name}
                </h3>
                <p className="text-xs text-slate-700 font-normal">
                  🏢 สังกัด: {selectedWorker.company}
                </p>
              </div>
              <button
                onClick={() => setSelectedWorker(null)}
                className="p-1 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Score Summary Box */}
            <div className="p-3 border-b border-slate-200 bg-slate-50/50">
              <div className="flex items-center justify-between p-3 rounded-lg border border-slate-300 bg-white shadow-2xs">
                <div>
                  <span className="text-[11px] text-slate-700 font-semibold block uppercase">
                    คะแนนสุทธิสะสม
                  </span>
                  <span className={`text-2xl font-bold ${
                    selectedWorker.netScore >= 0 ? 'text-emerald-800' : 'text-rose-800'
                  }`}>
                    {selectedWorker.netScore > 0 ? `+${selectedWorker.netScore}` : selectedWorker.netScore}
                  </span>
                </div>
                <div className="text-right text-xs space-y-1">
                  <div className="text-emerald-900 font-normal">
                    ✓ มาตรวจผ่าน: <strong className="font-semibold text-emerald-800">+{selectedWorker.passedDays}</strong> ({selectedWorker.passedDays} วัน)
                  </div>
                  <div className="text-rose-900 font-normal">
                    ✕ ตรวจไม่ผ่าน: <strong className="font-semibold text-rose-800">-{selectedWorker.failedCount * 5}</strong> ({selectedWorker.failedCount} ครั้ง)
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed Log History */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                ประวัติรายวัน ({selectedWorker.totalDays} ครั้งตรวจ)
              </h4>

              {/* Failed Items First if any */}
              {selectedWorker.failedEntries.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-rose-900 flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5 text-rose-700" /> รายการที่ถูกหักคะแนน (-5 แต้ม)
                  </span>
                  {selectedWorker.failedEntries.map((fail, fIdx) => (
                    <div
                      key={fIdx}
                      className="p-2 rounded-lg border border-rose-300 bg-rose-50 text-xs space-y-0.5"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-slate-900 text-[11px]">
                          {format(parseISO(fail.date), 'd MMMM yyyy', { locale: th })}
                        </span>
                        <span className="font-semibold text-rose-900 bg-rose-200 border border-rose-300 px-1.5 py-0.2 rounded text-[11px]">
                          -5 แต้ม
                        </span>
                      </div>
                      <p className="text-rose-950 text-[11px] font-normal">
                        ⚠️ {fail.reason}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Passed Days Summary */}
              <div className="pt-1">
                <span className="text-[11px] font-semibold text-emerald-900 flex items-center gap-1 mb-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" /> วันที่มาทำงานตรวจผ่าน (+1 แต้ม)
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {selectedWorker.passedDates.map(date => (
                    <div
                      key={date}
                      className="p-1.5 rounded-md border border-slate-300 bg-slate-50 text-[11px] flex justify-between items-center"
                    >
                      <span className="text-slate-800 font-normal">
                        {format(parseISO(date), 'd MMM yy', { locale: th })}
                      </span>
                      <span className="text-emerald-800 font-bold text-[11px]">+1</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-2.5 border-t border-slate-300 bg-slate-50 text-center">
              <button
                onClick={() => setSelectedWorker(null)}
                className="w-full py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-semibold cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}
