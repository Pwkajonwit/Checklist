'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  MapPin, Users, Building2, HardHat, UtensilsCrossed,
  Copy, Check, Search, Calendar, RefreshCw, ChevronDown,
  ChevronUp, CheckCircle2, AlertTriangle, ArrowUpRight,
  Filter, ShieldCheck, Clock
} from 'lucide-react'
import type { ChecklistEntry, MealConfig } from '@/lib/types'
import { isAlcoholFailed, isAlcoholPassed } from '@/lib/types'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { toast } from 'sonner'

interface LocationBreakdownViewProps {
  todayThai: string
  initialDate?: string
  initialEntries?: ChecklistEntry[]
  mealConfig?: MealConfig
}

interface LocationSummary {
  locationName: string
  totalWorkers: number
  activeWorkers: number
  outWorkers: number
  mealCount: number
  totalMealCost: number
  percentage: number
  companies: { name: string; count: number }[]
  activities: { name: string; count: number }[]
  supervisors: string[]
  safetyIssuesCount: number
  workers: ChecklistEntry[]
}

export function LocationBreakdownView({
  todayThai,
  initialDate,
  initialEntries = [],
  mealConfig,
}: LocationBreakdownViewProps) {
  const [selectedDate, setSelectedDate] = useState<string>(
    initialDate || format(new Date(), 'yyyy-MM-dd')
  )
  const [entries, setEntries] = useState<ChecklistEntry[]>(initialEntries)
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState('all')
  const [expandedLocations, setExpandedLocations] = useState<Record<string, boolean>>({})
  const [copiedLine, setCopiedLine] = useState(false)

  // Fetch entries when date changes if different from initial
  const fetchDateEntries = useCallback(async (dateStr: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/checklist?date=${dateStr}&t=${Date.now()}`)
      const json = await res.json()
      if (json.data) {
        setEntries(json.data)
      }
    } catch (err) {
      console.error('Error fetching date entries:', err)
      toast.error('โหลดข้อมูลจุดปฏิบัติงานไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (initialDate && selectedDate !== initialDate) {
      fetchDateEntries(selectedDate)
    } else if (!initialDate) {
      fetchDateEntries(selectedDate)
    }
  }, [selectedDate, initialDate, fetchDateEntries])

  // Toggle single location accordion
  const toggleExpand = (locName: string) => {
    setExpandedLocations(prev => ({ ...prev, [locName]: !prev[locName] }))
  }

  // Expand / collapse all
  const toggleAllExpand = (expand: boolean) => {
    const next: Record<string, boolean> = {}
    locations.forEach(l => {
      next[l.locationName] = expand
    })
    setExpandedLocations(next)
  }

  // Filter entries
  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      const loc = (e.location?.trim() || 'ไม่ระบุสถานที่').toLowerCase()
      const worker = (e.contractor_name || '').toLowerCase()
      const comp = (e.company_name || '').toLowerCase()
      const act = (e.activity_name || '').toLowerCase()
      const q = searchQuery.trim().toLowerCase()

      const matchSearch = !q || loc.includes(q) || worker.includes(q) || comp.includes(q) || act.includes(q)
      const matchComp = selectedCompanyFilter === 'all' || (e.company_name || 'ไม่ระบุสังกัด') === selectedCompanyFilter

      return matchSearch && matchComp
    })
  }, [entries, searchQuery, selectedCompanyFilter])

  // Unique company list for dropdown
  const uniqueCompanies = useMemo(() => {
    const set = new Set<string>()
    entries.forEach(e => {
      if (e.company_name) set.add(e.company_name.trim())
    })
    return Array.from(set).sort()
  }, [entries])

  // Group by Location
  const locations = useMemo<LocationSummary[]>(() => {
    const map = new Map<string, {
      workers: ChecklistEntry[]
      companiesMap: Map<string, number>
      activitiesMap: Map<string, number>
      supervisorsSet: Set<string>
      activeCount: number
      outCount: number
      mealCount: number
      safetyIssues: number
    }>()

    filteredEntries.forEach(e => {
      const loc = e.location?.trim() || 'ไม่ระบุสถานที่ / ทั่วไป'
      if (!map.has(loc)) {
        map.set(loc, {
          workers: [],
          companiesMap: new Map(),
          activitiesMap: new Map(),
          supervisorsSet: new Set(),
          activeCount: 0,
          outCount: 0,
          mealCount: 0,
          safetyIssues: 0,
        })
      }
      const item = map.get(loc)!
      item.workers.push(e)

      if (e.status === 'active') item.activeCount += 1
      if (e.status === 'checked_out') item.outCount += 1
      if (e.meal_allowance) item.mealCount += 1

      const comp = e.company_name?.trim() || 'ไม่ระบุสังกัด'
      item.companiesMap.set(comp, (item.companiesMap.get(comp) || 0) + 1)

      const act = e.activity_name?.trim() || 'งานทั่วไป'
      item.activitiesMap.set(act, (item.activitiesMap.get(act) || 0) + 1)

      if (e.supervisor?.trim()) item.supervisorsSet.add(e.supervisor.trim())

      const isAlcFail = isAlcoholFailed(e.alc_result)
      const isPpeFail = !e.ppe_helmet || !e.ppe_vest || !e.ppe_shirt || !e.ppe_gloves || !e.ppe_shoes
      if (isAlcFail || isPpeFail || e.is_blacklisted) {
        item.safetyIssues += 1
      }
    })

    const totalOverall = filteredEntries.length || 1
    const pricePerMeal = mealConfig?.price_per_meal || 60

    const list: LocationSummary[] = Array.from(map.entries()).map(([locName, data]) => {
      const comps = Array.from(data.companiesMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)

      const acts = Array.from(data.activitiesMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)

      return {
        locationName: locName,
        totalWorkers: data.workers.length,
        activeWorkers: data.activeCount,
        outWorkers: data.outCount,
        mealCount: data.mealCount,
        totalMealCost: data.mealCount * pricePerMeal,
        percentage: Math.round((data.workers.length / totalOverall) * 100),
        companies: comps,
        activities: acts,
        supervisors: Array.from(data.supervisorsSet),
        safetyIssuesCount: data.safetyIssues,
        workers: data.workers,
      }
    })

    // Sort by worker count descending (crowded spots first)
    list.sort((a, b) => b.totalWorkers - a.totalWorkers)
    return list
  }, [filteredEntries, mealConfig])

  // High-level KPI Metrics
  const summaryKpi = useMemo(() => {
    const totalSpots = locations.length
    const totalWorkers = filteredEntries.length
    const totalActive = filteredEntries.filter(e => e.status === 'active').length
    const totalMeals = filteredEntries.filter(e => e.meal_allowance).length
    const topSpot = locations.length > 0 ? locations[0] : null
    const totalSafetyIssues = filteredEntries.filter(e => {
      return isAlcoholFailed(e.alc_result) || !e.ppe_helmet || !e.ppe_vest || !e.ppe_shirt || !e.ppe_gloves || !e.ppe_shoes || e.is_blacklisted
    }).length

    return {
      totalSpots,
      totalWorkers,
      totalActive,
      totalMeals,
      topSpot,
      totalSafetyIssues,
    }
  }, [locations, filteredEntries])

  // Copy structured LINE summary message
  const handleCopyLineSummary = () => {
    const dateFormatted = format(new Date(selectedDate), 'EEEEที่ d MMMM yyyy', { locale: th })
    const price = mealConfig?.price_per_meal || 60

    let text = `📍 สรุปการกระจายคนงานและจุดปฏิบัติงาน\n`
    text += `ประจำวัน: ${dateFormatted}\n`
    text += `กำลังพลรวมทั้งหมด: ${summaryKpi.totalWorkers} คน (${summaryKpi.totalSpots} จุดปฏิบัติงาน)\n`
    if (mealConfig?.enabled) {
      text += `🍱 ข้าวกล่องที่ต้องส่งรวม: ${summaryKpi.totalMeals} กล่อง (฿${(summaryKpi.totalMeals * price).toLocaleString()})\n`
    }
    text += `──────────────────\n`

    locations.forEach((loc, idx) => {
      text += `\n${idx + 1}. 🏢 [${loc.locationName}]: ${loc.totalWorkers} คน`
      if (mealConfig?.enabled) {
        text += ` (🍱 ข้าว: ${loc.mealCount} กล่อง)`
      }
      text += `\n`

      // Companies
      const compStr = loc.companies.map(c => `${c.name} (${c.count} คน)`).join(', ')
      if (compStr) text += `   • สังกัด: ${compStr}\n`

      // Activities
      const actStr = loc.activities.map(a => a.name).join(', ')
      if (actStr) text += `   • งาน: ${actStr}\n`
    })

    text += `\n──────────────────\nสถานะ: อัปเดตล่าสุดจากระบบ SiteCheck`

    navigator.clipboard.writeText(text)
    setCopiedLine(true)
    toast.success('คัดลอกสรุปรายจุดปฏิบัติงานสำหรับส่ง LINE เรียบร้อยแล้ว!')
    setTimeout(() => setCopiedLine(false), 2500)
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full gap-2.5 overflow-hidden">
      
      {/* ── Toolbar: Date Picker, Search, Filter & Quick Copy ── */}
      <div className="p-2.5 bg-white rounded-lg border border-slate-300 shadow-2xs flex flex-wrap items-center justify-between gap-2.5 shrink-0">
        
        {/* Left: Date selector & search */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-sky-50 text-sky-800 text-xs font-bold border border-sky-200 shrink-0">
            <MapPin className="w-3.5 h-3.5 text-sky-600" />
            <span>สรุปตามจุดปฏิบัติงาน</span>
          </div>

          {/* Date Picker */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-slate-200 bg-slate-50 text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="text-xs font-bold text-slate-800 bg-transparent border-none outline-none cursor-pointer"
            />
          </div>

          {/* Search location or contractor */}
          <div className="relative w-44 sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="search"
              placeholder="ค้นหาจุดทำงาน, ชื่อช่าง, สังกัด..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-8 pr-2.5 py-1 rounded-md border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          {/* Company filter */}
          {uniqueCompanies.length > 0 && (
            <div className="flex items-center gap-1 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedCompanyFilter}
                onChange={e => setSelectedCompanyFilter(e.target.value)}
                className="text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-md px-2 py-1 outline-none cursor-pointer"
              >
                <option value="all">ทุกสังกัด ({entries.length} คน)</option>
                {uniqueCompanies.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Right: Expand buttons & Copy LINE summary */}
        <div className="flex items-center gap-1.5 ml-auto">
          <button
            type="button"
            onClick={() => toggleAllExpand(true)}
            className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 px-2 py-1 rounded hover:bg-slate-100 transition-colors"
          >
            กางทั้งหมด
          </button>
          <button
            type="button"
            onClick={() => toggleAllExpand(false)}
            className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 px-2 py-1 rounded hover:bg-slate-100 transition-colors"
          >
            พับทั้งหมด
          </button>

          <button
            type="button"
            onClick={handleCopyLineSummary}
            className="h-7 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            {copiedLine ? (
              <>
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>คัดลอกแล้ว!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>คัดลอกสรุปส่ง LINE</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => fetchDateEntries(selectedDate)}
            disabled={loading}
            className="w-7 h-7 flex items-center justify-center rounded border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors disabled:opacity-50"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

      </div>

      {/* ── KPI Summary Scorecards ── */}
      <div className={`grid grid-cols-2 sm:grid-cols-3 ${mealConfig?.enabled ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-2 shrink-0`}>
        
        {/* KPI 1: จำนวนจุดปฏิบัติงาน */}
        <div className="p-2.5 bg-white rounded-lg border border-slate-300 shadow-2xs flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block truncate">
              จุดปฏิบัติงานทั้งหมด
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-bold text-slate-900 leading-none">
                {summaryKpi.totalSpots}
              </span>
              <span className="text-[10px] text-slate-400">จุด / พื้นที่</span>
            </div>
            <span className="text-[10px] text-sky-600 font-semibold block mt-0.5 truncate">
              กระจายกำลังพล
            </span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 border border-sky-200">
            <MapPin className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 2: กำลังพลรวม */}
        <div className="p-2.5 bg-white rounded-lg border border-slate-300 shadow-2xs flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block truncate">
              กำลังพลในทุกจุดรวม
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-bold text-slate-900 leading-none">
                {summaryKpi.totalWorkers}
              </span>
              <span className="text-[10px] text-slate-400">คน</span>
            </div>
            <span className="text-[10px] text-emerald-600 font-semibold block mt-0.5">
              อยู่ในโครงการ: {summaryKpi.totalActive} คน
            </span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-200">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 3: จุดที่มีคนหนาแน่นที่สุด */}
        <div className="p-2.5 bg-white rounded-lg border border-slate-300 shadow-2xs flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block truncate">
              จุดที่คนหนาแน่นสุด
            </span>
            <div className="mt-0.5 truncate">
              <span className="text-sm font-bold text-slate-900 block truncate">
                {summaryKpi.topSpot ? summaryKpi.topSpot.locationName : '—'}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              {summaryKpi.topSpot ? `${summaryKpi.topSpot.totalWorkers} คน (${summaryKpi.topSpot.percentage}%)` : 'ไม่มีข้อมูล'}
            </span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-200">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 4: ยอดสั่งข้าวกล่องรวม (SHOW ONLY IF MEAL ENABLED) */}
        {mealConfig?.enabled && (
          <div className="p-2.5 bg-amber-50/70 rounded-lg border border-amber-300 shadow-2xs flex items-center justify-between">
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block truncate">
                ข้าวกล่องที่ต้องกระจายส่ง
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xl font-bold text-amber-950 leading-none">
                  {summaryKpi.totalMeals}
                </span>
                <span className="text-[10px] text-amber-800">กล่อง</span>
              </div>
              <span className="text-[10px] text-amber-800 font-semibold block mt-0.5">
                รวม ฿{(summaryKpi.totalMeals * (mealConfig.price_per_meal || 60)).toLocaleString()} บาท
              </span>
            </div>
            <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 border border-amber-300">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
          </div>
        )}

        {/* KPI 5: เคสความเสี่ยงในพื้นที่ */}
        <div className="p-2.5 bg-white rounded-lg border border-slate-300 shadow-2xs flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block truncate">
              ตรวจพบความเสี่ยง
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className={`text-xl font-bold leading-none ${summaryKpi.totalSafetyIssues > 0 ? 'text-red-600' : 'text-slate-800'}`}>
                {summaryKpi.totalSafetyIssues}
              </span>
              <span className="text-[10px] text-slate-400">รายการ</span>
            </div>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              ALC / PPE ไม่ผ่าน
            </span>
          </div>
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${summaryKpi.totalSafetyIssues > 0 ? 'bg-red-50 text-red-600 border-red-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

      </div>

      {/* ── Main Locations List Container ── */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5 pr-0.5">
        
        {loading ? (
          <div className="h-64 bg-white rounded-lg border border-slate-300 flex flex-col items-center justify-center text-slate-500 text-xs gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-sky-600" />
            <span>กำลังประมวลผลข้อมูลรายจุดปฏิบัติงาน...</span>
          </div>
        ) : locations.length === 0 ? (
          <div className="h-64 bg-white rounded-lg border border-slate-300 flex flex-col items-center justify-center text-slate-400 text-xs gap-2 p-6 text-center">
            <MapPin className="w-10 h-10 text-slate-300" />
            <p className="font-semibold text-slate-700 text-sm">ไม่พบข้อมูลจุดปฏิบัติงานในวันที่เลือก</p>
            <p className="text-slate-400 text-[11px] max-w-sm">
              ลองเลือกวันที่อื่น หรือตรวจสอบว่ามีการระบุ &quot;สถานที่&quot; ในการบันทึก Checklist หรือไม่
            </p>
          </div>
        ) : (
          locations.map((loc, idx) => {
            const isExpanded = !!expandedLocations[loc.locationName]
            const isTopSpot = idx === 0

            return (
              <div
                key={loc.locationName}
                className="bg-white rounded-xl border border-slate-300 shadow-2xs overflow-hidden transition-all"
              >
                {/* Location Header Strip */}
                <div
                  onClick={() => toggleExpand(loc.locationName)}
                  className="p-3 bg-slate-50/80 hover:bg-slate-100/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 cursor-pointer transition-colors select-none"
                >
                  {/* Left: Location Name & Ranking */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold font-mono ${
                      isTopSpot ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-700'
                    }`}>
                      #{idx + 1}
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 truncate">
                          {loc.locationName}
                        </span>
                        {isTopSpot && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-sky-100 text-sky-800 border border-sky-300">
                            หนาแน่นสูงสุด
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                        <span>{loc.companies.length} สังกัด</span>
                        <span>•</span>
                        <span>{loc.activities.length} ระบบงาน</span>
                        {loc.supervisors.length > 0 && (
                          <>
                            <span>•</span>
                            <span className="text-slate-600 truncate">
                              ผู้ควบคุม: {loc.supervisors.join(', ')}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Numbers Summary Badges & Toggle */}
                  <div className="flex items-center gap-3 ml-auto">
                    
                    {/* Headcount Badge */}
                    <div className="text-right">
                      <div className="flex items-baseline justify-end gap-1">
                        <span className="text-base font-bold text-slate-900 font-mono">
                          {loc.totalWorkers}
                        </span>
                        <span className="text-[11px] text-slate-500">คน</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono block">
                        ({loc.percentage}% ของไซต์)
                      </span>
                    </div>

                    {/* Meal Allowance Badge (If mealConfig.enabled) */}
                    {mealConfig?.enabled && (
                      <div className="px-2 py-1 rounded-md bg-amber-100 border border-amber-300 text-amber-950 text-right">
                        <div className="flex items-center gap-1 text-[11px] font-bold">
                          <span>🍱</span>
                          <span className="font-mono">{loc.mealCount}</span>
                          <span className="font-normal text-[10px]">กล่อง</span>
                        </div>
                        <span className="text-[9px] text-amber-800 font-mono block">
                          ฿{loc.totalMealCost.toLocaleString()}
                        </span>
                      </div>
                    )}

                    {/* Safety Badge */}
                    {loc.safetyIssuesCount > 0 ? (
                      <span className="px-2 py-1 rounded bg-red-50 text-red-700 text-[11px] font-bold border border-red-200 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>เสี่ยง {loc.safetyIssuesCount}</span>
                      </span>
                    ) : (
                      <span className="hidden sm:inline-flex px-2 py-1 rounded bg-emerald-50 text-emerald-800 text-[10px] font-semibold border border-emerald-200">
                        ✓ ปลอดภัยครบ
                      </span>
                    )}

                    {/* Expand Arrow */}
                    <button
                      type="button"
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
                      title={isExpanded ? 'พับเก็บ' : 'ขยายดูรายชื่อ'}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Location Quick Sub-Stats Strip: Progress bar + Company pills */}
                <div className="p-3 space-y-2.5">
                  
                  {/* Visual Proportion Bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>สัดส่วนกำลังพล ณ จุดนี้</span>
                      <span className="font-mono font-bold text-slate-700">
                        {loc.totalWorkers} / {summaryKpi.totalWorkers} คน ({loc.percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-sky-500 transition-all duration-500"
                        style={{ width: `${Math.max(loc.percentage, 3)}%` }}
                      />
                    </div>
                  </div>

                  {/* Companies Breakdown Pills */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 mr-1">
                      <Building2 className="w-3 h-3 text-slate-400" />
                      <span>ทีมงานในจุดนี้:</span>
                    </span>
                    {loc.companies.map(c => (
                      <span
                        key={c.name}
                        className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-medium inline-flex items-center gap-1"
                      >
                        <span>{c.name}</span>
                        <strong className="text-slate-900 font-mono font-bold bg-white px-1 rounded border border-slate-200 text-[10px]">
                          {c.count} คน
                        </strong>
                      </span>
                    ))}
                  </div>

                  {/* Activities Breakdown Pills */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 mr-1">
                      <HardHat className="w-3 h-3 text-slate-400" />
                      <span>งานที่ปฏิบัติ:</span>
                    </span>
                    {loc.activities.map(a => (
                      <span
                        key={a.name}
                        className="px-2 py-0.5 rounded-md bg-purple-50 border border-purple-200 text-purple-900 text-[11px] font-medium"
                      >
                        {a.name} <span className="font-mono text-purple-700 font-bold">({a.count})</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* ── Collapsible Worker Table for this Location ── */}
                {isExpanded && (
                  <div className="border-t border-slate-200 bg-slate-50/50 p-3 space-y-2 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                      <span>รายชื่อช่างและผลการคัดกรอง ณ {loc.locationName} ({loc.workers.length} คน)</span>
                      <span className="text-[11px] text-slate-400 font-normal">
                        ตรวจผ่าน ALC และ PPE ครบ
                      </span>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-slate-100 text-slate-700 text-[11px] border-b border-slate-200">
                          <tr>
                            <th className="py-1.5 px-2 w-10 text-center font-bold border-r border-slate-200">#</th>
                            <th className="py-1.5 px-2.5 font-bold border-r border-slate-200">ชื่อ - สกุล</th>
                            <th className="py-1.5 px-2 font-bold border-r border-slate-200">สังกัด</th>
                            <th className="py-1.5 px-2 font-bold border-r border-slate-200">งาน</th>
                            <th className="py-1.5 px-2 text-center font-bold border-r border-slate-200">เวลาเข้า</th>
                            <th className="py-1.5 px-1.5 text-center font-bold border-r border-slate-200">ALC</th>
                            <th className="py-1.5 px-2 text-center font-bold border-r border-slate-200">PPE</th>
                            {mealConfig?.enabled && (
                              <th className="py-1.5 px-2 text-center font-bold border-r border-slate-200 bg-amber-50">
                                🍱 ข้าว
                              </th>
                            )}
                            <th className="py-1.5 px-2 text-center font-bold">สถานะ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {loc.workers.map((w, wIdx) => {
                            const ppeCount = [
                              w.ppe_helmet,
                              w.ppe_vest,
                              w.ppe_shirt,
                              w.ppe_gloves,
                              w.ppe_shoes,
                            ].filter(Boolean).length

                            const isSafe = ppeCount === 5 && isAlcoholPassed(w.alc_result)

                            return (
                              <tr
                                key={w.id}
                                className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                                  w.is_blacklisted ? 'bg-red-50/60' : ''
                                }`}
                              >
                                <td className="py-1.5 px-2 text-center text-slate-400 font-mono text-[11px] border-r border-slate-100">
                                  {wIdx + 1}
                                </td>
                                <td className="py-1.5 px-2.5 font-semibold text-slate-900 border-r border-slate-100 truncate">
                                  {w.contractor_name}
                                </td>
                                <td className="py-1.5 px-2 text-slate-600 text-[11px] border-r border-slate-100 truncate">
                                  {w.company_name || '—'}
                                </td>
                                <td className="py-1.5 px-2 text-slate-600 text-[11px] border-r border-slate-100 truncate">
                                  {w.activity_name || 'งานทั่วไป'}
                                </td>
                                <td className="py-1.5 px-2 text-center font-mono text-[11px] text-emerald-700 font-bold border-r border-slate-100">
                                  {w.check_in_time || '—'}
                                </td>
                                <td className="py-1.5 px-1.5 text-center border-r border-slate-100">
                                  <span className={`px-1 py-0.2 rounded text-[10px] font-bold ${
                                    isAlcoholFailed(w.alc_result)
                                      ? 'bg-red-100 text-red-700'
                                      : 'bg-emerald-50 text-emerald-700'
                                  }`}>
                                    {w.alc_result || '0%'}
                                  </span>
                                </td>
                                <td className="py-1.5 px-2 text-center border-r border-slate-100">
                                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                                    ppeCount === 5 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-100 text-amber-800'
                                  }`}>
                                    {ppeCount}/5
                                  </span>
                                </td>
                                {mealConfig?.enabled && (
                                  <td className="py-1.5 px-2 text-center border-r border-slate-100 bg-amber-50/30">
                                    {w.meal_allowance ? (
                                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-200 text-amber-900">
                                        ✓ รับข้าว
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-slate-300">—</span>
                                    )}
                                  </td>
                                )}
                                <td className="py-1.5 px-2 text-center">
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                    w.status === 'active'
                                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}>
                                    {w.status === 'active' ? 'อยู่ในพื้นที่' : 'ออกงานแล้ว'}
                                  </span>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}

      </div>

    </div>
  )
}
