'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { format, subDays, startOfMonth, endOfMonth, parseISO } from 'date-fns'
import { th } from 'date-fns/locale'
import {
  BarChart3, Users, Building2, HardHat, AlertTriangle,
  TrendingUp, Calendar, RefreshCw, Clock, Award,
  CheckCircle2, XCircle, ShieldAlert, ArrowUpRight,
  Filter, DollarSign, PieChart, Activity as ActivityIcon,
  UtensilsCrossed
} from 'lucide-react'
import type { ChecklistEntry, MealConfig } from '@/lib/types'
import { isAlcoholFailed } from '@/lib/types'

interface CompanyStat {
  name: string
  manDays: number
  uniqueWorkers: number
  percentage: number
  safetyPassRate: number
  alcViolations: number
  ppeViolations: number
  totalWage: number
}

interface ActivityStat {
  name: string
  count: number
  percentage: number
}

interface DailyTrend {
  date: string
  displayDate: string
  dayName: string
  count: number
  alcCount: number
  ppeIncompleteCount: number
}

interface WorkerStat {
  name: string
  company: string
  attendanceCount: number
  violations: number
}

interface AnalyticsViewProps {
  mealConfig?: MealConfig
}

export function AnalyticsView({ mealConfig }: AnalyticsViewProps = {}) {
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 13), 'yyyy-MM-dd'))
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [entries, setEntries] = useState<ChecklistEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>('all')

  const fetchAnalyticsData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ from: dateFrom, to: dateTo })
      const res = await fetch(`/api/checklist?${params.toString()}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setEntries(json.data ?? [])
    } catch (err) {
      console.error('Error fetching analytics entries:', err)
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo])

  useEffect(() => {
    fetchAnalyticsData()
  }, [fetchAnalyticsData])

  const setPresetRange = (type: '7d' | '14d' | '30d' | 'thisMonth') => {
    const now = new Date()
    if (type === '7d') {
      setDateFrom(format(subDays(now, 6), 'yyyy-MM-dd'))
      setDateTo(format(now, 'yyyy-MM-dd'))
    } else if (type === '14d') {
      setDateFrom(format(subDays(now, 13), 'yyyy-MM-dd'))
      setDateTo(format(now, 'yyyy-MM-dd'))
    } else if (type === '30d') {
      setDateFrom(format(subDays(now, 29), 'yyyy-MM-dd'))
      setDateTo(format(now, 'yyyy-MM-dd'))
    } else if (type === 'thisMonth') {
      setDateFrom(format(startOfMonth(now), 'yyyy-MM-dd'))
      setDateTo(format(endOfMonth(now), 'yyyy-MM-dd'))
    }
  }

  // Filter entries if specific company selected
  const filteredEntries = useMemo(() => {
    if (selectedCompanyFilter === 'all') return entries
    return entries.filter(e => (e.company_name || 'ไม่ระบุสังกัด') === selectedCompanyFilter)
  }, [entries, selectedCompanyFilter])

  // ── 1. Company Analysis (ทีมไหนทำงานเยอะ-น้อย) ──
  const { companyStats, uniqueCompanyList } = useMemo(() => {
    const map = new Map<string, {
      manDays: number
      workers: Set<string>
      passedSafety: number
      alcViolations: number
      ppeViolations: number
      totalWage: number
    }>()

    entries.forEach(e => {
      const comp = e.company_name?.trim() || 'ไม่ระบุสังกัด'
      if (!map.has(comp)) {
        map.set(comp, {
          manDays: 0,
          workers: new Set<string>(),
          passedSafety: 0,
          alcViolations: 0,
          ppeViolations: 0,
          totalWage: 0,
        })
      }
      const item = map.get(comp)!
      item.manDays += 1
      if (e.contractor_name) item.workers.add(e.contractor_name)

      const alcFail = isAlcoholFailed(e.alc_result)
      const ppePass = e.ppe_helmet && e.ppe_vest && e.ppe_shirt && e.ppe_gloves && e.ppe_shoes

      if (alcFail) item.alcViolations += 1
      if (!ppePass) item.ppeViolations += 1
      if (!alcFail && ppePass) item.passedSafety += 1

      if (typeof e.daily_wage === 'number' && e.daily_wage > 0) {
        item.totalWage += e.daily_wage
      }
    })

    const totalManDays = entries.length || 1
    const list: CompanyStat[] = Array.from(map.entries()).map(([name, data]) => ({
      name,
      manDays: data.manDays,
      uniqueWorkers: data.workers.size,
      percentage: Math.round((data.manDays / totalManDays) * 100),
      safetyPassRate: Math.round((data.passedSafety / (data.manDays || 1)) * 100),
      alcViolations: data.alcViolations,
      ppeViolations: data.ppeViolations,
      totalWage: data.totalWage,
    }))

    // Sort by manDays descending
    list.sort((a, b) => b.manDays - a.manDays)

    return {
      companyStats: list,
      uniqueCompanyList: list.map(c => c.name),
    }
  }, [entries])

  // ── 2. Daily Attendance Trend ──
  const dailyTrends = useMemo<DailyTrend[]>(() => {
    const map = new Map<string, { count: number; alc: number; ppe: number }>()

    filteredEntries.forEach(e => {
      const d = e.entry_date
      if (!map.has(d)) {
        map.set(d, { count: 0, alc: 0, ppe: 0 })
      }
      const item = map.get(d)!
      item.count += 1
      if (isAlcoholFailed(e.alc_result)) item.alc += 1
      if (!e.ppe_helmet || !e.ppe_vest || !e.ppe_shirt || !e.ppe_gloves || !e.ppe_shoes) {
        item.ppe += 1
      }
    })

    const sortedDates = Array.from(map.keys()).sort()
    return sortedDates.map(dateStr => {
      let parsed = new Date()
      try {
        parsed = parseISO(dateStr)
      } catch {
        // fallback
      }
      const item = map.get(dateStr)!
      return {
        date: dateStr,
        displayDate: format(parsed, 'd MMM', { locale: th }),
        dayName: format(parsed, 'EEE', { locale: th }),
        count: item.count,
        alcCount: item.alc,
        ppeIncompleteCount: item.ppe,
      }
    })
  }, [filteredEntries])

  // Max daily count for chart scaling
  const maxDailyCount = useMemo(() => {
    return Math.max(...dailyTrends.map(t => t.count), 1)
  }, [dailyTrends])

  // ── 3. Trade / Activity Breakdown ──
  const activityStats = useMemo<ActivityStat[]>(() => {
    const map = new Map<string, number>()
    filteredEntries.forEach(e => {
      const act = e.activity_name?.trim() || 'งานทั่วไป'
      map.set(act, (map.get(act) || 0) + 1)
    })
    const total = filteredEntries.length || 1
    const list = Array.from(map.entries()).map(([name, count]) => ({
      name,
      count,
      percentage: Math.round((count / total) * 100),
    }))
    list.sort((a, b) => b.count - a.count)
    return list
  }, [filteredEntries])

  // ── 4. PPE Equipment Breakdown ──
  const ppeSummary = useMemo(() => {
    const total = filteredEntries.length || 1
    const helmet = filteredEntries.filter(e => e.ppe_helmet).length
    const vest = filteredEntries.filter(e => e.ppe_vest).length
    const shirt = filteredEntries.filter(e => e.ppe_shirt).length
    const gloves = filteredEntries.filter(e => e.ppe_gloves).length
    const shoes = filteredEntries.filter(e => e.ppe_shoes).length

    return [
      { key: 'helmet', label: 'หมวกนิรภัย', icon: '⛑️', passed: helmet, rate: Math.round((helmet / total) * 100) },
      { key: 'vest', label: 'เสื้อกั๊กสะท้อนแสง', icon: '🦺', passed: vest, rate: Math.round((vest / total) * 100) },
      { key: 'shirt', label: 'แว่นตาเซฟตี้', icon: '🥽', passed: shirt, rate: Math.round((shirt / total) * 100) },
      { key: 'gloves', label: 'ถุงมือเซฟตี้', icon: '🧤', passed: gloves, rate: Math.round((gloves / total) * 100) },
      { key: 'shoes', label: 'รองเท้าเซฟตี้', icon: '👢', passed: shoes, rate: Math.round((shoes / total) * 100) },
    ]
  }, [filteredEntries])

  // ── 5. Top Active Workers (ช่างที่เข้างานสม่ำเสมอที่สุด) ──
  const topWorkers = useMemo<WorkerStat[]>(() => {
    const map = new Map<string, { company: string; count: number; violations: number }>()

    filteredEntries.forEach(e => {
      const name = e.contractor_name?.trim()
      if (!name) return
      if (!map.has(name)) {
        map.set(name, {
          company: e.company_name || 'ไม่ระบุสังกัด',
          count: 0,
          violations: 0,
        })
      }
      const item = map.get(name)!
      item.count += 1
      const alcFail = isAlcoholFailed(e.alc_result)
      const ppeFail = !e.ppe_helmet || !e.ppe_vest || !e.ppe_shirt || !e.ppe_gloves || !e.ppe_shoes
      if (alcFail || ppeFail || e.is_blacklisted) {
        item.violations += 1
      }
    })

    const list: WorkerStat[] = Array.from(map.entries()).map(([name, data]) => ({
      name,
      company: data.company,
      attendanceCount: data.count,
      violations: data.violations,
    }))

    list.sort((a, b) => b.attendanceCount - a.attendanceCount)
    return list.slice(0, 10)
  }, [filteredEntries])

  // ── Meal Allowance Stats (Only computed if mealConfig.enabled === true) ──
  const mealStats = useMemo(() => {
    if (!mealConfig?.enabled) return null
    const meals = filteredEntries.filter(e => e.meal_allowance)
    const totalMeals = meals.length
    const price = mealConfig.price_per_meal || 60
    const totalCost = totalMeals * price

    const map = new Map<string, number>()
    meals.forEach(e => {
      const comp = e.company_name?.trim() || 'ไม่ระบุสังกัด'
      map.set(comp, (map.get(comp) || 0) + 1)
    })

    const list = Array.from(map.entries())
      .map(([comp, count]) => ({
        company: comp,
        meals: count,
        cost: count * price,
        percentage: totalMeals > 0 ? Math.round((count / totalMeals) * 100) : 0,
      }))
      .sort((a, b) => b.meals - a.meals)

    return { totalMeals, totalCost, list }
  }, [filteredEntries, mealConfig])

  // ── 6. High-level Summary Metrics ──
  const summaryMetrics = useMemo(() => {
    const totalManDays = filteredEntries.length
    const uniqueDays = new Set(filteredEntries.map(e => e.entry_date)).size || 1
    const avgPerDay = Math.round((totalManDays / uniqueDays) * 10) / 10

    const alcFails = filteredEntries.filter(e => isAlcoholFailed(e.alc_result)).length
    const ppeFails = filteredEntries.filter(e => !e.ppe_helmet || !e.ppe_vest || !e.ppe_shirt || !e.ppe_gloves || !e.ppe_shoes).length
    const blacklisted = filteredEntries.filter(e => e.is_blacklisted).length
    const safePassCount = filteredEntries.filter(e => !isAlcoholFailed(e.alc_result) && e.ppe_helmet && e.ppe_vest && e.ppe_shirt && e.ppe_gloves && e.ppe_shoes).length
    const safetyRate = totalManDays > 0 ? Math.round((safePassCount / totalManDays) * 100) : 100

    const totalWage = filteredEntries.reduce((acc, curr) => acc + (curr.daily_wage || 0), 0)
    const topTeam = companyStats.length > 0 ? companyStats[0] : null

    return {
      totalManDays,
      uniqueDays,
      avgPerDay,
      topTeam,
      alcFails,
      ppeFails,
      blacklisted,
      safetyRate,
      totalWage,
    }
  }, [filteredEntries, companyStats])

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full gap-2.5 overflow-hidden">
      
      {/* ── Toolbar: Date Picker, Presets & Company Filter ── */}
      <div className="p-2.5 bg-white rounded-lg border border-slate-300 shadow-2xs flex flex-wrap items-center justify-between gap-2.5 shrink-0">
        
        {/* Left: Date Presets & Date Range */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-indigo-50 text-indigo-700 text-xs font-bold shrink-0 border border-indigo-200">
            <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
            <span>ช่วงเวลาวิเคราะห์</span>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-1 text-[11px]">
            <button
              onClick={() => setPresetRange('7d')}
              className="px-2.5 py-1 rounded-md border border-slate-200 hover:bg-slate-100 font-semibold text-slate-700 transition-colors"
            >
              7 วัน
            </button>
            <button
              onClick={() => setPresetRange('14d')}
              className="px-2.5 py-1 rounded-md border border-slate-200 hover:bg-slate-100 font-semibold text-slate-700 transition-colors"
            >
              14 วัน
            </button>
            <button
              onClick={() => setPresetRange('30d')}
              className="px-2.5 py-1 rounded-md border border-slate-200 hover:bg-slate-100 font-semibold text-slate-700 transition-colors"
            >
              30 วัน
            </button>
            <button
              onClick={() => setPresetRange('thisMonth')}
              className="px-2.5 py-1 rounded-md border border-slate-200 hover:bg-slate-100 font-semibold text-slate-700 transition-colors"
            >
              เดือนนี้
            </button>
          </div>

          {/* Custom Date Inputs */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-slate-200 bg-slate-50 text-xs">
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
        </div>

        {/* Right: Company Filter & Refresh */}
        <div className="flex items-center gap-2 ml-auto">
          {uniqueCompanyList.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedCompanyFilter}
                onChange={e => setSelectedCompanyFilter(e.target.value)}
                className="text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-md px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                <option value="all">ทุกสังกัด / ทุกผู้รับเหมา ({entries.length} รายการ)</option>
                {uniqueCompanyList.map(comp => (
                  <option key={comp} value={comp}>
                    {comp}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={fetchAnalyticsData}
            disabled={loading}
            className="h-7 px-2.5 flex items-center justify-center gap-1.5 rounded-md border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors disabled:opacity-50"
            title="รีเฟรชข้อมูลวิเคราะห์"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">อัปเดต</span>
          </button>
        </div>
      </div>

      {/* ── KPI Summary Cards Strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 shrink-0">
        
        {/* KPI 1: กำลังคนสะสม (Man-Days) */}
        <div className="p-2.5 bg-white rounded-lg border border-slate-300 shadow-2xs flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block truncate">
              กำลังคนสะสม (Man-days)
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-bold text-slate-900 leading-none">
                {summaryMetrics.totalManDays}
              </span>
              <span className="text-[10px] text-slate-500 font-medium">
                คน-วัน ({summaryMetrics.uniqueDays} วัน)
              </span>
            </div>
            <span className="text-[10px] text-emerald-600 font-semibold block mt-0.5">
              เฉลี่ย {summaryMetrics.avgPerDay} คน/วัน
            </span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-200/60">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 2: ทีมที่ส่งคนทำงานมากที่สุด */}
        <div className="p-2.5 bg-white rounded-lg border border-slate-300 shadow-2xs flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block truncate">
              ทีมทำงานมากสุด
            </span>
            <div className="mt-0.5">
              <span className="text-sm font-bold text-slate-900 truncate block">
                {summaryMetrics.topTeam ? summaryMetrics.topTeam.name : '—'}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
              {summaryMetrics.topTeam
                ? `${summaryMetrics.topTeam.manDays} คน-วัน (${summaryMetrics.topTeam.percentage}%)`
                : 'ไม่มีข้อมูล'}
            </span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-200/60">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 3: อัตราผ่านเกณฑ์ความปลอดภัย */}
        <div className="p-2.5 bg-white rounded-lg border border-slate-300 shadow-2xs flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block truncate">
              อัตราผ่านความปลอดภัย
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className={`text-xl font-bold leading-none ${summaryMetrics.safetyRate >= 90 ? 'text-emerald-700' : 'text-amber-700'}`}>
                {summaryMetrics.safetyRate}%
              </span>
              <span className="text-[10px] text-slate-400">ผ่านครบ 100%</span>
            </div>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              ALC 0% + PPE ครบ
            </span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-200/60">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 4: รายการฝ่าฝืน/ความเสี่ยง */}
        <div className="p-2.5 bg-white rounded-lg border border-slate-300 shadow-2xs flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block truncate">
              ตรวจพบความเสี่ยง
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className={`text-xl font-bold leading-none ${summaryMetrics.alcFails > 0 || summaryMetrics.ppeFails > 0 ? 'text-red-600' : 'text-slate-800'}`}>
                {summaryMetrics.alcFails + summaryMetrics.ppeFails}
              </span>
              <span className="text-[10px] text-slate-400">ครั้ง</span>
            </div>
            <span className="text-[10px] text-red-600 font-semibold block mt-0.5">
              ALC: {summaryMetrics.alcFails} | PPE: {summaryMetrics.ppeFails}
            </span>
          </div>
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${summaryMetrics.alcFails > 0 ? 'bg-red-50 text-red-600 border-red-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 5: ประมาณการค่าแรงรวม */}
        <div className="p-2.5 bg-white rounded-lg border border-slate-300 shadow-2xs flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block truncate">
              ประมาณการค่าแรงสะสม
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-bold text-slate-900 leading-none">
                {summaryMetrics.totalWage > 0 ? summaryMetrics.totalWage.toLocaleString() : '—'}
              </span>
              <span className="text-[10px] text-slate-400">บาท</span>
            </div>
            <span className="text-[10px] text-slate-500 block mt-0.5 truncate">
              คำนวณจากค่าแรงรายวัน
            </span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200/60">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

      </div>

      {/* ── Main Analytics Scrollable Area ── */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5 pr-0.5">
        
        {loading ? (
          <div className="h-64 bg-white rounded-lg border border-slate-300 flex flex-col items-center justify-center text-slate-500 text-xs gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
            <span>กำลังประมวลผลข้อมูลวิเคราะห์...</span>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="h-64 bg-white rounded-lg border border-slate-300 flex flex-col items-center justify-center text-slate-400 text-xs gap-2 p-6 text-center">
            <HardHat className="w-10 h-10 text-slate-300" />
            <p className="font-semibold text-slate-700 text-sm">ไม่พบข้อมูล Checklist ในช่วงเวลาที่เลือก</p>
            <p className="text-slate-400 text-[11px] max-w-sm">
              ลองขยายช่วงวันที่ หรือเลือกพรีเซ็ต &quot;เดือนนี้&quot; เพื่อดูข้อมูลสถิติย้อนหลัง
            </p>
          </div>
        ) : (
          <>
            {/* ── ROW 1: ภาระงานแยกตามสังกัด (Workload by Team) & แนวโน้มรายวัน (Daily Trend) ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5">
              
              {/* Col Left (7/12): จัดอันดับทีมที่ทำงานเยอะ-น้อย (Workload by Contractor/Company) */}
              <div className="lg:col-span-7 bg-white rounded-lg border border-slate-300 shadow-2xs p-3 flex flex-col">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 mb-2.5">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                    <Building2 className="w-4 h-4 text-blue-600" />
                    <span>ภาระงานและกำลังคนแยกตามสังกัด / ผู้รับเหมา</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    ทั้งหมด {companyStats.length} สังกัด
                  </span>
                </div>

                <p className="text-[11px] text-slate-500 mb-3">
                  เปรียบเทียบสัดส่วนจำนวน <strong>คน-วัน (Man-days)</strong> และดัชนีความปลอดภัยของแต่ละทีม
                </p>

                <div className="space-y-3 flex-1 overflow-y-auto max-h-[340px] pr-1">
                  {companyStats.map((comp, idx) => {
                    // Badge category
                    const isTop1 = idx === 0
                    return (
                      <div
                        key={comp.name}
                        className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${
                              isTop1 ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-700'
                            }`}>
                              {idx + 1}
                            </span>
                            <span className="font-bold text-xs text-slate-900 truncate">
                              {comp.name}
                            </span>
                            {isTop1 && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                ทีมหลัก
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 shrink-0 text-xs">
                            <span className="font-mono text-slate-600 text-[11px]">
                              ช่าง <strong className="text-slate-900">{comp.uniqueWorkers}</strong> คน
                            </span>
                            <span className="font-bold font-mono text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                              {comp.manDays} คน-วัน ({comp.percentage}%)
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar of Workforce Share */}
                        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isTop1 ? 'bg-blue-600' : 'bg-indigo-500'
                            }`}
                            style={{ width: `${Math.max(comp.percentage, 3)}%` }}
                          />
                        </div>

                        {/* Mini Badges Footer: Safety & Violations */}
                        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                          <div className="flex items-center gap-2">
                            <span>
                              ความปลอดภัย:{' '}
                              <strong className={comp.safetyPassRate >= 90 ? 'text-emerald-700' : 'text-amber-700'}>
                                {comp.safetyPassRate}%
                              </strong>
                            </span>
                            {comp.alcViolations > 0 && (
                              <span className="text-red-600 font-semibold flex items-center gap-0.5">
                                <AlertTriangle className="w-3 h-3" /> ALC {comp.alcViolations}
                              </span>
                            )}
                            {comp.ppeViolations > 0 && (
                              <span className="text-amber-700 font-semibold flex items-center gap-0.5">
                                PPE ขาด {comp.ppeViolations}
                              </span>
                            )}
                          </div>
                          {comp.totalWage > 0 && (
                            <span className="text-slate-500 font-mono">
                              ค่าแรงสะสม ฿{comp.totalWage.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Col Right (5/12): กราฟแนวโน้มกำลังคนรายวัน (Daily Workforce Trend) */}
              <div className="lg:col-span-5 bg-white rounded-lg border border-slate-300 shadow-2xs p-3 flex flex-col">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 mb-2.5">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    <span>แนวโน้มกำลังคนรายวัน (Daily Attendance)</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    สูงสุด {maxDailyCount} คน
                  </span>
                </div>

                <p className="text-[11px] text-slate-500 mb-2">
                  แท่งกราฟแสดงจำนวนคนเข้าไซต์งานในแต่ละวัน
                </p>

                {/* Bar Chart Visualizer */}
                <div className="flex-1 flex flex-col justify-end pt-4 min-h-[220px]">
                  <div className="flex items-end gap-1 sm:gap-2 h-44 border-b border-slate-300 pb-1 px-1 overflow-x-auto">
                    {dailyTrends.map((t, idx) => {
                      const barHeightPct = Math.max(Math.round((t.count / maxDailyCount) * 100), 6)
                      const isPeak = t.count === maxDailyCount && t.count > 0
                      const hasAlert = t.alcCount > 0 || t.ppeIncompleteCount > 0

                      return (
                        <div
                          key={idx}
                          className="flex-1 min-w-[24px] max-w-[42px] flex flex-col items-center gap-1 group relative cursor-pointer"
                        >
                          {/* Tooltip on hover */}
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-12 z-20 pointer-events-none bg-slate-900 text-white text-[10px] rounded px-2 py-1 shadow-lg whitespace-nowrap">
                            <p className="font-bold">{t.date}</p>
                            <p>เข้างาน: {t.count} คน</p>
                            {t.alcCount > 0 && <p className="text-red-400">ALC เกิน: {t.alcCount}</p>}
                          </div>

                          <span className="text-[9px] font-mono font-bold text-slate-600 group-hover:text-blue-700">
                            {t.count}
                          </span>

                          {/* Bar */}
                          <div className="w-full bg-slate-100 rounded-t overflow-hidden flex flex-col justify-end h-32">
                            <div
                              className={`w-full rounded-t transition-all duration-300 ${
                                isPeak
                                  ? 'bg-blue-600'
                                  : hasAlert
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              } group-hover:brightness-110`}
                              style={{ height: `${barHeightPct}%` }}
                            />
                          </div>

                          {/* X-axis Label */}
                          <span className="text-[9px] text-slate-500 truncate w-full text-center font-mono">
                            {t.displayDate}
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  {/* Chart Legend */}
                  <div className="flex items-center justify-center gap-4 text-[10px] text-slate-500 mt-3 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded bg-blue-600" />
                      <span>วันที่มีคนสูงสุด (Peak)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded bg-emerald-500" />
                      <span>ปกติ</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded bg-amber-500" />
                      <span>มีเคสความเสี่ยง</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* ── ROW 2: สัดส่วนประเภทงาน (Activity) & การตรวจสอบ PPE รายชิ้น ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5">
              
              {/* Col Left (6/12): สัดส่วนประเภทงาน / กิจกรรม (Trade & Activity Breakdown) */}
              <div className="lg:col-span-6 bg-white rounded-lg border border-slate-300 shadow-2xs p-3 flex flex-col">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 mb-2.5">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                    <ActivityIcon className="w-4 h-4 text-purple-600" />
                    <span>สัดส่วนตามประเภทงาน / กิจกรรม (Activities Breakdown)</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    {activityStats.length} ประเภทงาน
                  </span>
                </div>

                <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[260px] pr-1">
                  {activityStats.map(act => (
                    <div key={act.name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800 truncate">
                          {act.name}
                        </span>
                        <span className="font-mono text-[11px] font-bold text-slate-600 shrink-0">
                          {act.count} คน ({act.percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-purple-600 transition-all duration-300"
                          style={{ width: `${Math.max(act.percentage, 2)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Col Right (6/12): การตรวจสอบ PPE รายชิ้น (Safety Equipment Pass Rate) */}
              <div className="lg:col-span-6 bg-white rounded-lg border border-slate-300 shadow-2xs p-3 flex flex-col">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 mb-2.5">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                    <HardHat className="w-4 h-4 text-amber-600" />
                    <span>ดัชนีความพร้อมอุปกรณ์ PPE แยกตามชิ้นส่วน</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    5 อุปกรณ์หลัก
                  </span>
                </div>

                <p className="text-[11px] text-slate-500 mb-2">
                  ตรวจเช็กชิ้นส่วนอุปกรณ์ที่ช่างมักละเลย เพื่อเน้นย้ำในการประชุม Safety Talk
                </p>

                <div className="space-y-2.5 flex-1">
                  {ppeSummary.map(item => (
                    <div key={item.key} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-800 flex items-center gap-1.5">
                          <span>{item.icon}</span>
                          <span>{item.label}</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 font-mono">
                            {item.passed}/{filteredEntries.length}
                          </span>
                          <span className={`font-mono text-xs font-bold ${
                            item.rate >= 90 ? 'text-emerald-700' : item.rate >= 75 ? 'text-amber-700' : 'text-red-600'
                          }`}>
                            {item.rate}%
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            item.rate >= 90 ? 'bg-emerald-500' : item.rate >= 75 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${item.rate}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* ── ROW 3: อันดับช่างที่เข้างานสม่ำเสมอที่สุด (Top Active Workers) ── */}
            <div className="bg-white rounded-lg border border-slate-300 shadow-2xs p-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 mb-2.5">
                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                  <Award className="w-4 h-4 text-amber-500" />
                  <span>ช่าง / คนงานที่เข้าปฏิบัติงานสม่ำเสมอที่สุด (Top 10 Active Workers)</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  จัดอันดับตามจำนวนวันที่เข้าไซต์
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                {topWorkers.map((worker, i) => (
                  <div
                    key={worker.name}
                    className="p-2 rounded-lg border border-slate-200 bg-slate-50/60 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-bold text-slate-400 font-mono">
                          #{i + 1}
                        </span>
                        <span className="text-xs font-bold text-slate-800 truncate block">
                          {worker.name}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 truncate block mt-0.5">
                        {worker.company}
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold text-blue-700 font-mono block">
                        {worker.attendanceCount} วัน
                      </span>
                      {worker.violations > 0 ? (
                        <span className="text-[9px] font-bold text-red-600 block">
                          ความเสี่ยง {worker.violations}
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold text-emerald-600 block">
                          ไร้ประวัติเสี่ยง
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── ROW 4: สรุปค่าอาหารและข้าวกล่องสะสม (ONLY WHEN mealConfig.enabled === true) ── */}
            {mealConfig?.enabled && mealStats && (
              <div className="bg-amber-50/60 rounded-lg border border-amber-300 shadow-2xs p-3 animate-in fade-in duration-200">
                <div className="flex items-center justify-between pb-2 border-b border-amber-200 mb-2.5">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-amber-950">
                    <UtensilsCrossed className="w-4 h-4 text-amber-600" />
                    <span>สรุปการเบิกค่าอาหารและข้าวกล่องสะสม</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="font-bold text-amber-950 font-mono">
                      รวมทั้งหมด: {mealStats.totalMeals} กล่อง
                    </span>
                    <span className="font-bold text-emerald-800 bg-white px-2 py-0.5 rounded border border-amber-300 font-mono">
                      ฿{mealStats.totalCost.toLocaleString()} บาท (@{mealConfig.price_per_meal}.-)
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {mealStats.list.length === 0 ? (
                    <span className="text-xs text-amber-800 italic col-span-3">
                      ไม่มีประวัติการเบิกค่าอาหารในช่วงเวลานี้
                    </span>
                  ) : (
                    mealStats.list.map(item => (
                      <div
                        key={item.company}
                        className="p-2 bg-white rounded border border-amber-200 flex items-center justify-between text-xs"
                      >
                        <span className="font-semibold text-slate-800 truncate pr-1">
                          • {item.company}
                        </span>
                        <div className="text-right shrink-0">
                          <span className="font-bold font-mono text-amber-900 block">
                            {item.meals} กล่อง ({item.percentage}%)
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            ฿{item.cost.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </>
        )}

      </div>

    </div>
  )
}
