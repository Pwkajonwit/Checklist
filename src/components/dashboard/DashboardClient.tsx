'use client'

import { useState, useEffect } from 'react'
import { Zap, BarChart3, Clock, TrendingUp, MapPin, Award } from 'lucide-react'
import { TodayView } from './TodayView'
import { AnalyticsView } from './AnalyticsView'
import { LocationBreakdownView } from './LocationBreakdownView'
import { SafetyScoreView } from './SafetyScoreView'
import type { ChecklistEntry, MealConfig } from '@/lib/types'
import { DEFAULT_MEAL_CONFIG } from '@/lib/types'
import { format } from 'date-fns'

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

interface DashboardClientProps {
  todayThai: string
  todayData: TodayData
}

export function DashboardClient({ todayThai, todayData }: DashboardClientProps) {
  const [activeTab, setActiveTab] = useState<'today' | 'locations' | 'analytics' | 'safety'>('today')
  const [mealConfig, setMealConfig] = useState<MealConfig>(DEFAULT_MEAL_CONFIG)

  useEffect(() => {
    // Load meal configuration (Feature Toggle for future)
    fetch(`/api/settings?id=meal_config&t=${Date.now()}`)
      .then(res => res.json())
      .then(json => {
        if (json.success && json.data) {
          setMealConfig({ ...DEFAULT_MEAL_CONFIG, ...json.data })
        }
      })
      .catch(err => console.error('Failed to load meal config in dashboard:', err))
  }, [])

  // Calculate unique locations count today
  const locationCount = new Set(
    todayData.allToday.map(e => e.location?.trim() || 'ไม่ระบุ')
  ).size

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full gap-2 overflow-hidden">
      
      {/* ── Top Level Mode Selector (Tabs) ── */}
      <div className="p-1.5 bg-white rounded-lg border border-slate-300 shadow-2xs flex items-center justify-between gap-2 shrink-0">
        
        {/* Tab Buttons Strip */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-md border border-slate-300">
          
          {/* Tab 1: หน้างานวันนี้ */}
          <button
            onClick={() => setActiveTab('today')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'today'
                ? 'bg-white text-blue-700 shadow-xs border border-slate-300'
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <Zap className={`w-3.5 h-3.5 ${activeTab === 'today' ? 'text-blue-600 fill-blue-600' : 'text-slate-500'}`} />
            <span>หน้างานวันนี้ (Today Ops)</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[11px] font-bold ${
              activeTab === 'today'
                ? 'bg-blue-100 text-blue-900'
                : 'bg-slate-200 text-slate-700'
            }`}>
              {todayData.total}
            </span>
          </button>

          {/* Tab 2: สรุปรายจุดทำงาน (Locations) */}
          <button
            onClick={() => setActiveTab('locations')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'locations'
                ? 'bg-white text-sky-800 shadow-xs border border-slate-300'
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <MapPin className={`w-3.5 h-3.5 ${activeTab === 'locations' ? 'text-sky-600' : 'text-slate-500'}`} />
            <span>สรุปรายจุดทำงาน (Locations)</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[11px] font-bold ${
              activeTab === 'locations'
                ? 'bg-sky-100 text-sky-900'
                : 'bg-slate-200 text-slate-700'
            }`}>
              {locationCount} จุด
            </span>
          </button>

          {/* Tab 3: ภาพรวมวิเคราะห์ (Analytics) */}
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'analytics'
                ? 'bg-white text-indigo-800 shadow-xs border border-slate-300'
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <BarChart3 className={`w-3.5 h-3.5 ${activeTab === 'analytics' ? 'text-indigo-600' : 'text-slate-500'}`} />
            <span>ภาพรวมวิเคราะห์ (Analytics)</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[11px] font-bold uppercase tracking-wider ${
              activeTab === 'analytics'
                ? 'bg-indigo-100 text-indigo-900'
                : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
            }`}>
              Insight
            </span>
          </button>

          {/* Tab 4: คะแนนวินัย (Safety Score) */}
          <button
            onClick={() => setActiveTab('safety')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'safety'
                ? 'bg-white text-emerald-800 shadow-xs border border-slate-300'
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <Award className={`w-3.5 h-3.5 ${activeTab === 'safety' ? 'text-emerald-600' : 'text-slate-500'}`} />
            <span>คะแนนวินัย (Safety Score)</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[11px] font-bold uppercase tracking-wider ${
              activeTab === 'safety'
                ? 'bg-emerald-100 text-emerald-900'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}>
              +1/-5
            </span>
          </button>

        </div>

        {/* Informational Subtext */}
        <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 pr-2">
          {activeTab === 'today' && (
            <div className="flex items-center gap-1.5 text-slate-600 text-[11px]">
              <Clock className="w-3.5 h-3.5 text-blue-500" />
              <span>ติดตามสถานะคนงานและคัดกรองความปลอดภัยหน้างานแบบเรียลไทม์</span>
            </div>
          )}
          {activeTab === 'locations' && (
            <div className="flex items-center gap-1.5 text-sky-700 text-[11px] font-medium">
              <MapPin className="w-3.5 h-3.5 text-sky-600" />
              <span>สรุปยอดคนงานและข้าวกล่องแยกตามแต่ละที่แต่ละจุดปฏิบัติงาน พร้อมคัดลอกส่ง LINE</span>
            </div>
          )}
          {activeTab === 'analytics' && (
            <div className="flex items-center gap-1.5 text-indigo-600 text-[11px] font-medium">
              <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
              <span>วิเคราะห์ภาระงานแต่ละทีม, กำลังพลสะสม, สัดส่วนระบบงาน และสถิติความปลอดภัย</span>
            </div>
          )}
          {activeTab === 'safety' && (
            <div className="flex items-center gap-1.5 text-emerald-700 text-[11px] font-medium">
              <Award className="w-3.5 h-3.5 text-emerald-600" />
              <span>ระบบจัดอันดับคะแนนวินัย: ตรวจผ่านครบ +1 แต้ม/วัน | ไม่ผ่าน (ALC/PPE) -5 แต้ม</span>
            </div>
          )}
        </div>

      </div>

      {/* ── Active Tab Content (Fills remaining height) ── */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'today' && (
          <TodayView todayThai={todayThai} data={todayData} mealConfig={mealConfig} />
        )}
        {activeTab === 'locations' && (
          <LocationBreakdownView
            todayThai={todayThai}
            initialDate={format(new Date(), 'yyyy-MM-dd')}
            initialEntries={todayData.allToday}
            mealConfig={mealConfig}
          />
        )}
        {activeTab === 'analytics' && (
          <AnalyticsView mealConfig={mealConfig} />
        )}
        {activeTab === 'safety' && (
          <SafetyScoreView />
        )}
      </div>

    </div>
  )
}
