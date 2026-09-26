'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import type { ChecklistEntry, Contractor, Company, Activity, NotificationConfig } from '@/lib/types'
import { DEFAULT_NOTIFICATION_CONFIG } from '@/lib/types'
import {
  buildDailyReportData,
  formatDailyLineMessage,
  buildDailyLineFlexMessage,
  DailyReportData,
  CompanySummary,
} from '@/lib/line-service'
import {
  MessageSquare, Send, Copy, Settings, RefreshCw, CalendarDays,
  Building2, Users, CheckCircle2, XCircle, AlertTriangle, Clock,
  Sparkles, Check, ChevronLeft, ChevronRight, ExternalLink, HelpCircle,
  Loader2, BellRing, Smartphone, ShieldAlert, Layers, Code, Eye,
  Timer, Plus, Trash2, CheckCircle, Radio, SendHorizontal
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'

const STORAGE_KEY_CONFIG = 'sitecheck_notification_config'
const STORAGE_KEY_SENT_LOGS = 'sitecheck_sent_slots_today'

export default function LineOAPage() {
  const supabase = useMemo(() => createClient(), [])

  // Date selection
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  // Data
  const [entries, setEntries] = useState<ChecklistEntry[]>([])
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Message Format & Active Bubble Preview Index
  const [formatMode, setFormatMode] = useState<'flex' | 'text'>('flex')
  const [activeBubbleIdx, setActiveBubbleIdx] = useState<number>(0)

  // Unified Notification Settings Modal
  const [configOpen, setConfigOpen] = useState(false)
  const [activeConfigTab, setActiveConfigTab] = useState<'channels' | 'schedule'>('channels')
  const [config, setConfig] = useState<NotificationConfig>(DEFAULT_NOTIFICATION_CONFIG)
  const [newTimeInput, setNewTimeInput] = useState('09:00')
  const [savingSettings, setSavingSettings] = useState(false)

  // Sending State
  const [sending, setSending] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const [customFilterComp, setCustomFilterComp] = useState<string>('all')

  // Log of slots sent today (e.g. ['2026-09-24 09:00', '2026-09-24 12:00'])
  const [sentSlots, setSentSlots] = useState<string[]>([])
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('')

  // Load saved config from Supabase / localStorage & sent logs
  useEffect(() => {
    const loadConfig = async () => {
      // 1. Try local cache first
      try {
        const saved = localStorage.getItem(STORAGE_KEY_CONFIG)
        if (saved) {
          setConfig(prev => ({ ...prev, ...JSON.parse(saved) }))
        }
        const savedLogs = localStorage.getItem(STORAGE_KEY_SENT_LOGS)
        if (savedLogs) {
          setSentSlots(JSON.parse(savedLogs))
        }
      } catch {}

      // 2. Fetch latest from Supabase settings API
      try {
        const res = await fetch('/api/settings?id=notification_config')
        if (res.ok) {
          const json = await res.json()
          if (json.data && typeof json.data === 'object') {
            setConfig(prev => ({ ...prev, ...json.data }))
            localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(json.data))
          }
        }
      } catch (err) {
        console.warn('Load notification settings error:', err)
      }
    }

    loadConfig()
  }, [])

  const saveConfig = async (newCfg: NotificationConfig) => {
    setConfig(newCfg)
    setSavingSettings(true)
    try {
      localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(newCfg))
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'notification_config', config: newCfg }),
      })
      if (!res.ok) {
        const errJson = await res.json()
        throw new Error(errJson.error || 'บันทึกลงฐานข้อมูล Supabase ไม่สำเร็จ')
      }
      toast.success('บันทึกการตั้งค่าการแจ้งเตือนและรอบเวลาลง Supabase เรียบร้อยแล้ว')
    } catch (err: any) {
      console.error('Save notification config error:', err)
      toast.warning('บันทึกเฉพาะในเบราว์เซอร์ (Supabase บันทึกไม่สำเร็จ: ' + (err.message || '') + ')')
    } finally {
      setSavingSettings(false)
    }
  }

  // Fetch Data
  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true)
    else setRefreshing(true)

    try {
      const [entriesRes, { data: cData, error: cErr }, { data: coData, error: coErr }, { data: aData, error: aErr }] =
        await Promise.all([
          fetch(`/api/checklist?date=${date}`).then(r => r.json()),
          supabase.from('contractors').select('*').eq('is_active', true).order('name'),
          supabase.from('companies').select('*').order('name'),
          supabase.from('activities').select('*').eq('is_active', true).order('name'),
        ])

      if (entriesRes.error) throw new Error(entriesRes.error)
      if (cErr) throw cErr
      if (coErr) throw coErr
      if (aErr) throw aErr

      setEntries(entriesRes.data ?? [])
      setContractors(cData ?? [])
      setCompanies(coData ?? [])
      setActivities(aData ?? [])
    } catch (err: unknown) {
      console.error('Fetch report data error:', err)
      toast.error('ไม่สามารถโหลดข้อมูลได้')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [supabase, date])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Shift date
  const shiftDate = (d: -1 | 1) => {
    const dt = new Date(date)
    dt.setDate(dt.getDate() + d)
    setDate(format(dt, 'yyyy-MM-dd'))
  }

  const isToday = date === format(new Date(), 'yyyy-MM-dd')

  // Computed Report Data
  const report: DailyReportData = useMemo(() => {
    return buildDailyReportData(date, entries, contractors, companies, activities)
  }, [date, entries, contractors, companies, activities])

  // Computed LINE Flex Message
  const flexMessage = useMemo(() => {
    return buildDailyLineFlexMessage(report)
  }, [report])

  // Formatted Text Message
  const lineTextMessage = useMemo(() => {
    return formatDailyLineMessage(report)
  }, [report])

  // Filtered Companies for display
  const displayCompanies = useMemo(() => {
    if (customFilterComp === 'all') return report.companies
    return report.companies.filter(c => c.companyName === customFilterComp)
  }, [report, customFilterComp])

  // Reset bubble index if out of bounds
  useEffect(() => {
    const maxIdx = report.companies.length // 0 is Overview, 1..N are companies
    if (activeBubbleIdx > maxIdx) {
      setActiveBubbleIdx(0)
    }
  }, [report, activeBubbleIdx])

  // Next upcoming scheduled slot
  const nextScheduledSlot = useMemo(() => {
    if (!config.schedule_enabled || config.schedule_times.length === 0) return null
    const now = new Date()
    const currentH = now.getHours()
    const currentM = now.getMinutes()
    const currentMins = currentH * 60 + currentM

    // Sort times ascending
    const sorted = [...config.schedule_times].sort()
    for (const t of sorted) {
      const [h, m] = t.split(':').map(Number)
      const slotMins = h * 60 + m
      if (slotMins > currentMins) {
        return t
      }
    }
    return sorted[0] + ' (พรุ่งนี้)'
  }, [config.schedule_enabled, config.schedule_times, currentTimeStr])

  // Send Notification function (supports LINE OA & Telegram)
  const dispatchSend = useCallback(async (isAuto = false, slotTime?: string) => {
    const isLineReady = config.line_enabled && config.line_channel_access_token
    const isTgReady = config.telegram_enabled && config.telegram_bot_token && config.telegram_chat_id

    if (!isLineReady && !isTgReady) {
      if (!isAuto) {
        setConfigOpen(true)
        toast.info('กรุณาเปิดใช้งานและตั้งค่า Token ของ LINE OA หรือ Telegram ก่อนส่ง')
      }
      return
    }

    setSending(true)
    try {
      const payload: any = {
        message: lineTextMessage,
        line_enabled: config.line_enabled,
        line_channel_access_token: config.line_channel_access_token,
        line_target_id: config.line_target_id,
        line_broadcast: config.line_broadcast,
        telegram_enabled: config.telegram_enabled,
        telegram_bot_token: config.telegram_bot_token,
        telegram_chat_id: config.telegram_chat_id,
      }

      if (formatMode === 'flex' && config.line_enabled) {
        payload.flex = flexMessage
      }

      const res = await fetch('/api/line/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'ส่งข้อความไม่สำเร็จ')
      }

      if (isAuto && slotTime) {
        const slotKey = `${format(new Date(), 'yyyy-MM-dd')} ${slotTime}`
        setSentSlots(prev => {
          const updated = [...prev, slotKey]
          try {
            localStorage.setItem(STORAGE_KEY_SENT_LOGS, JSON.stringify(updated))
          } catch {}
          return updated
        })
        toast.success(`⏰ ระบบได้ส่งรายงานสรุปอัตโนมัติรอบเวลา ${slotTime} น. เรียบร้อยแล้ว`)
      } else {
        toast.success(data.message || 'ส่งการแจ้งเตือนเรียบร้อยแล้ว!')
      }
    } catch (err: any) {
      console.error('Send Notification error:', err)
      if (!isAuto) {
        toast.error(err.message || 'ส่งข้อความไม่สำเร็จ กรุณาตรวจสอบการตั้งค่า Token')
      }
    } finally {
      setSending(false)
    }
  }, [config, formatMode, lineTextMessage, flexMessage])

  // Auto Scheduler Background Check Loop (Every 15s)
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date()
      const nowTime = format(now, 'HH:mm')
      const todayStr = format(now, 'yyyy-MM-dd')
      setCurrentTimeStr(nowTime)

      if (!config.schedule_enabled || !config.schedule_times || config.schedule_times.length === 0) {
        return
      }

      // Check if current minute matches any scheduled slot
      if (config.schedule_times.includes(nowTime)) {
        const slotKey = `${todayStr} ${nowTime}`
        // Check if already dispatched this slot today
        if (!sentSlots.includes(slotKey)) {
          console.log(`Triggering scheduled notification for slot: ${slotKey}`)
          dispatchSend(true, nowTime)
        }
      }
    }, 15000)

    return () => clearInterval(timer)
  }, [config.schedule_enabled, config.schedule_times, sentSlots, dispatchSend])

  // Time slot handlers
  const handleAddTimeSlot = () => {
    if (!newTimeInput) return
    if (config.schedule_times.includes(newTimeInput)) {
      toast.error('มีรอบเวลานี้อยู่แล้ว')
      return
    }
    const updated = [...config.schedule_times, newTimeInput].sort()
    setConfig(prev => ({ ...prev, schedule_times: updated }))
  }

  const handleRemoveTimeSlot = (time: string) => {
    const updated = config.schedule_times.filter(t => t !== time)
    setConfig(prev => ({ ...prev, schedule_times: updated }))
  }

  // Test send connection
  const handleTestConnection = async () => {
    const isLineReady = config.line_enabled && config.line_channel_access_token
    const isTgReady = config.telegram_enabled && config.telegram_bot_token && config.telegram_chat_id

    if (!isLineReady && !isTgReady) {
      toast.warning('กรุณาเปิดใช้งานและระบุข้อมูลของ LINE OA หรือ Telegram ก่อนทดสอบ')
      return
    }

    setTestingConnection(true)
    try {
      const res = await fetch('/api/line/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `🔔 [ทดสอบการเชื่อมต่อ SiteCheck PRO]\nระบบสามารถส่งข้อความแจ้งเตือนได้อย่างสมบูรณ์แล้ว ✅\nเวลา: ${format(new Date(), 'HH:mm:ss น.')}`,
          line_enabled: config.line_enabled,
          line_channel_access_token: config.line_channel_access_token,
          line_target_id: config.line_target_id,
          line_broadcast: config.line_broadcast,
          telegram_enabled: config.telegram_enabled,
          telegram_bot_token: config.telegram_bot_token,
          telegram_chat_id: config.telegram_chat_id,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'ทดสอบส่งข้อความไม่สำเร็จ')
      }

      toast.success(data.message || 'ทดสอบสำเร็จ! ได้รับข้อความเรียบร้อยแล้ว')
    } catch (err: any) {
      toast.error(err.message || 'ทดสอบไม่สำเร็จ ตรวจสอบ Token หรือ Chat ID')
    } finally {
      setTestingConnection(false)
    }
  }

  // Channel status tags
  const activeChannelsText = useMemo(() => {
    const active: string[] = []
    if (config.line_enabled) active.push('LINE OA')
    if (config.telegram_enabled) active.push('Telegram')
    return active.length > 0 ? active.join(' + ') : 'ปิดการแจ้งเตือน'
  }, [config.line_enabled, config.telegram_enabled])

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full gap-2.5 overflow-hidden">

      {/* ── Top Controls & Date Bar ── */}
      <div className="p-2 bg-white rounded-lg border border-slate-300 shadow-2xs flex flex-wrap items-center justify-between gap-2 shrink-0">
        
        {/* Left: Title, Active Channels Pill, Schedule Status Pill, and Date Navigator */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-50 text-emerald-900 text-xs font-bold border border-emerald-300">
            <MessageSquare className="w-4 h-4 text-emerald-600" />
            <span>แจ้งเตือนสรุปประจำวัน (LINE OA & Telegram)</span>
          </div>

          {/* Active Channels Pill */}
          <button
            onClick={() => {
              setActiveConfigTab('channels')
              setConfigOpen(true)
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border transition-colors cursor-pointer ${
              config.line_enabled || config.telegram_enabled
                ? 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100'
                : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
            }`}
            title="คลิกเพื่อเลือกช่องทางและตั้งค่า Token"
          >
            <Smartphone className="w-3.5 h-3.5 text-emerald-700" />
            <span>ช่องทาง: <strong>{activeChannelsText}</strong></span>
          </button>

          {/* Schedule Status Indicator */}
          <button
            onClick={() => {
              setActiveConfigTab('schedule')
              setConfigOpen(true)
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border transition-colors cursor-pointer ${
              config.schedule_enabled
                ? 'bg-blue-50 text-blue-900 border-blue-300 hover:bg-blue-100'
                : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
            }`}
            title="คลิกเพื่อตั้งค่ารอบเวลาส่งอัตโนมัติ"
          >
            <Timer className={`w-3.5 h-3.5 ${config.schedule_enabled ? 'text-blue-600' : 'text-slate-500'}`} />
            <span>
              {config.schedule_enabled ? (
                <>
                  ส่งอัตโนมัติ: <strong className="text-blue-950 font-mono">รอบ {nextScheduledSlot || 'เปิดอยู่'} น.</strong>
                </>
              ) : (
                'ส่งอัตโนมัติ: ปิดอยู่'
              )}
            </span>
          </button>

          {/* Date Navigator */}
          <div className="flex items-center h-8 border border-slate-300 rounded-md bg-slate-50 overflow-hidden">
            <button
              onClick={() => shiftDate(-1)}
              className="w-7 h-full flex items-center justify-center hover:bg-slate-200 text-slate-700 transition-colors"
              title="วันก่อนหน้า"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <div className="flex items-center gap-1.5 px-2.5 border-x border-slate-300 bg-white h-full">
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
            onClick={() => fetchData(true)}
            disabled={refreshing || loading}
            className="w-8 h-8 flex items-center justify-center rounded-md border border-slate-300 hover:bg-slate-100 text-slate-700 transition-colors"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing || loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Right: Quick Action Buttons */}
        <div className="flex items-center gap-1.5 ml-auto flex-wrap">
          {/* Unified Notification Settings Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setConfigOpen(true)}
            className="h-8 text-xs border-slate-300 text-slate-800 bg-white hover:bg-slate-50 gap-1.5 font-bold shadow-2xs"
          >
            <Settings className="w-3.5 h-3.5 text-slate-700" />
            <span>ตั้งค่าการแจ้งเตือน</span>
          </Button>

          <Button
            size="sm"
            onClick={() => dispatchSend(false)}
            disabled={sending || loading}
            className="h-8 px-3.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 font-bold shadow-2xs transition-colors"
          >
            {sending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span>ส่งรายงานทันที</span>
          </Button>
        </div>
      </div>

      {/* ── Main Content Grid: Left (Company Breakdown) | Right (Preview Mockup) ── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0 overflow-hidden">

        {/* ────────────────────────────────────────────────────────
            LEFT COLUMN (6 COLS): รายละเอียดและสถิติแยกตามบริษัท/สาขา
        ──────────────────────────────────────────────────────── */}
        <div className="lg:col-span-6 flex flex-col gap-2.5 min-h-0 h-full overflow-hidden">
          
          {/* Overview Stat Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 shrink-0">
            <div className="p-2.5 rounded-lg border border-blue-200 bg-blue-50/70 flex flex-col justify-between">
              <span className="text-[11px] font-medium text-blue-900">เข้างานทั้งหมด</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl font-extrabold text-blue-950 font-mono">
                  {report.totalCheckedIn}
                </span>
                <span className="text-[11px] font-semibold text-blue-800">
                  / {report.totalRegistered} คน
                </span>
              </div>
            </div>

            <div className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/70 flex flex-col justify-between">
              <span className="text-[11px] font-medium text-emerald-900">ผ่านเกณฑ์ 100%</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl font-extrabold text-emerald-950 font-mono">
                  {report.totalPassed}
                </span>
                <span className="text-[11px] font-semibold text-emerald-800">คน</span>
              </div>
            </div>

            <div className="p-2.5 rounded-lg border border-red-200 bg-red-50/70 flex flex-col justify-between">
              <span className="text-[11px] font-medium text-red-900">ไม่ผ่านเกณฑ์</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl font-extrabold text-red-950 font-mono">
                  {report.totalFailed}
                </span>
                <span className="text-[11px] font-semibold text-red-800">คน</span>
              </div>
            </div>

            <div className="p-2.5 rounded-lg border border-slate-300 bg-slate-100 flex flex-col justify-between">
              <span className="text-[11px] font-medium text-slate-800">ขาด / ยังไม่ตรวจ</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl font-extrabold text-slate-950 font-mono">
                  {report.totalMissing}
                </span>
                <span className="text-[11px] font-semibold text-slate-700">คน</span>
              </div>
            </div>
          </div>

          {/* Company Breakdown Card List */}
          <div className="flex-1 border border-slate-300 rounded-lg bg-white overflow-hidden flex flex-col min-h-0 shadow-2xs">
            <div className="p-2.5 bg-slate-100 border-b border-slate-300 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-700" />
                <span className="text-xs font-bold text-slate-900">
                  รายละเอียดการเข้างานแยกตามสาขา / บริษัท ({report.companies.length} สาขา)
                </span>
              </div>

              {/* Filter */}
              <select
                value={customFilterComp}
                onChange={e => setCustomFilterComp(e.target.value)}
                className="text-xs px-2 py-0.5 rounded border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
              >
                <option value="all">ทุกสาขา/บริษัท ({report.companies.length})</option>
                {report.companies.map(c => (
                  <option key={c.companyName} value={c.companyName}>
                    {c.companyName}
                  </option>
                ))}
              </select>
            </div>

            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 scrollbar-thin">
              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  <span className="text-xs">กำลังประมวลผลรายงานสรุป...</span>
                </div>
              ) : displayCompanies.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  ไม่พบข้อมูลผู้รับเหมาหรือพนักงานในวันที่เลือก
                </div>
              ) : (
                displayCompanies.map((c, idx) => {
                  const passPercent = c.checkedInCount > 0 ? Math.round((c.passedCount / c.checkedInCount) * 100) : 0
                  return (
                    <div
                      key={c.companyName}
                      className="border border-slate-200 rounded-lg p-3 bg-white hover:border-blue-300 transition-colors shadow-2xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-xs text-slate-900">{c.companyName}</span>
                            {c.activityTag && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-800 font-semibold rounded">
                                {c.activityTag}
                              </span>
                            )}
                            {c.location && (
                              <span className="text-[10px] text-slate-500">
                                📍 {c.location}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            ลงทะเบียน: <strong className="text-slate-800">{c.totalRegistered}</strong> | เข้างาน: <strong className="text-blue-700">{c.checkedInCount}</strong> | ผ่าน: <strong className="text-emerald-700">{c.passedCount}</strong> ({passPercent}%)
                          </div>
                        </div>

                        {/* Status badge */}
                        <div className="text-right shrink-0">
                          {c.failedCount > 0 ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-800 bg-red-100 px-2 py-0.5 rounded">
                              <XCircle className="w-3 h-3 text-red-600" />
                              ตกเกณฑ์ {c.failedCount} คน
                            </span>
                          ) : c.checkedInCount > 0 ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              เรียบร้อย 100%
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-medium">
                              ยังไม่เข้างาน
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Problem details if any */}
                      {c.failedMembers && c.failedMembers.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-red-100 bg-red-50/50 p-2 rounded text-[11px] space-y-1">
                          <span className="font-bold text-red-900 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-red-600" /> รายชื่อผู้ไม่ผ่านเกณฑ์:
                          </span>
                          {c.failedMembers.map((m, mIdx) => (
                            <div key={mIdx} className="flex items-center justify-between text-red-800 pl-4">
                              <span>• {m.name}</span>
                              <span className="text-red-700 font-medium">({m.reason})</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* ────────────────────────────────────────────────────────
            RIGHT COLUMN (6 COLS): พรีวิวข้อความ (Flex Message หรือ Text)
        ──────────────────────────────────────────────────────── */}
        <div className="lg:col-span-6 flex flex-col gap-2.5 min-h-0 h-full overflow-hidden">
          <div className="flex-1 border border-slate-300 rounded-lg bg-white overflow-hidden flex flex-col min-h-0 shadow-2xs">
            {/* Preview Toolbar */}
            <div className="p-2.5 bg-slate-100 border-b border-slate-300 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-slate-700" />
                <span className="text-xs font-bold text-slate-900">
                  ตัวอย่างข้อความแจ้งเตือน (Live Preview)
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Toggle Flex / Text */}
                <div className="flex items-center gap-1 bg-slate-200 p-0.5 rounded-md">
                  <button
                    onClick={() => setFormatMode('flex')}
                    className={`px-2 py-0.5 text-xs font-bold rounded transition-colors ${
                      formatMode === 'flex'
                        ? 'bg-white text-emerald-800 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    LINE Flex (การ์ด)
                  </button>
                  <button
                    onClick={() => setFormatMode('text')}
                    className={`px-2 py-0.5 text-xs font-bold rounded transition-colors ${
                      formatMode === 'text'
                        ? 'bg-white text-blue-800 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Text / Telegram
                  </button>
                </div>
              </div>
            </div>

            {/* Bubble Selector (When in Flex mode) */}
            {formatMode === 'flex' && (
              <div className="px-3 py-1.5 bg-slate-200/70 border-b border-slate-300 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setActiveBubbleIdx(0)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${
                      activeBubbleIdx === 0
                        ? 'bg-emerald-700 text-white shadow-2xs'
                        : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-300'
                    }`}
                  >
                    Bubble 1: สรุปความปลอดภัย (Frame 2)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveBubbleIdx(1)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${
                      activeBubbleIdx === 1
                        ? 'bg-blue-800 text-white shadow-2xs'
                        : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-300'
                    }`}
                  >
                    Bubble 2: แจ้งความประสงค์ ({report.companies.reduce((sum, c) => sum + c.lateOrRequests.length, 0)}) (Frame 3)
                  </button>
                </div>

                <span className="text-[11px] text-slate-500 font-medium">
                  {activeBubbleIdx === 0 ? '1 / 2' : '2 / 2'}
                </span>
              </div>
            )}

            {/* Preview Body */}
            <div className="flex-1 overflow-y-auto p-4 bg-[#748792]/20 flex flex-col items-center justify-start scrollbar-thin">
              {formatMode === 'flex' ? (
                /* Authentic LINE Flex Bubble (Frame 2 / Frame 3) */
                activeBubbleIdx === 0 ? (
                  /* ── Bubble 1: สรุปการเข้างานและความปลอดภัย (Frame 2) ── */
                  <div className="w-full max-w-[380px] bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden text-slate-900">
                    {/* Green Header */}
                    <div className="bg-[#286b13] p-3 text-white">
                      <h4 className="text-xs font-bold leading-tight">
                        การเข้า-ออก และตรวจสอบความปลอดภัยประจำวัน
                      </h4>
                    </div>

                    {/* Body */}
                    <div className="p-3 space-y-3">
                      {/* 3 Summary Badges */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-[#dcfce7] rounded-lg p-2 text-center">
                          <span className="text-[11px] font-bold text-[#14532d] block">
                            ทีมงานรวม {report.totalPassed}
                          </span>
                        </div>
                        <div className="bg-[#fef3c7] rounded-lg p-2 text-center">
                          <span className="text-[11px] font-bold text-[#92400e] block">
                            ไม่มา {report.totalMissing}
                          </span>
                        </div>
                        <div className="bg-[#dbeafe] rounded-lg p-2 text-center">
                          <span className="text-[11px] font-bold text-[#1e40af] block">
                            ประสงค์ {report.companies.reduce((sum, c) => sum + c.lateOrRequests.length, 0)}
                          </span>
                        </div>
                      </div>

                      {/* Company List (Up to 12) */}
                      <div className="space-y-2.5 pt-1">
                        {report.companies.slice(0, 12).map((comp, idx) => {
                          const actTag =
                            comp.activityTag ||
                            (comp.activityName && comp.companyCode
                              ? `[${comp.companyCode}] ${comp.activityName}`
                              : comp.activityName || (comp.companyCode ? `[${comp.companyCode}]` : ''))

                          return (
                            <div key={comp.companyName} className="space-y-1">
                              {/* Line 1: Company Name & Activity */}
                              <div className="flex items-baseline justify-between gap-1 text-xs">
                                <span className="font-bold text-slate-900 truncate">
                                  {comp.companyName}
                                </span>
                                {actTag && (
                                  <span className="font-bold text-blue-600 text-[11px] shrink-0">
                                    {actTag}
                                  </span>
                                )}
                              </div>

                              {/* Line 2: Attendance Stats & Location */}
                              <div className="flex items-center justify-between text-[11px] gap-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-emerald-600">มา {comp.passedCount}</span>
                                  {comp.alcCount > 0 && (
                                    <span className="font-bold text-red-600">ALC {comp.alcCount}</span>
                                  )}
                                  {comp.ppeFailedCount > 0 && (
                                    <span className="font-bold text-red-600">ไม่ผ่าน {comp.ppeFailedCount}</span>
                                  )}
                                  <span className="text-slate-700">ไม่มา {comp.missingCount}</span>
                                  {comp.lateOrRequests.length > 0 && (
                                    <span className="text-blue-600 font-semibold">
                                      แจ้งประสงค์ {comp.lateOrRequests.length}
                                    </span>
                                  )}
                                </div>
                                {comp.location && (
                                  <span className="text-slate-600 text-[10px] shrink-0">
                                    📍 {comp.location}
                                  </span>
                                )}
                              </div>

                              {idx < Math.min(report.companies.length, 12) - 1 && (
                                <div className="border-b border-slate-100 pt-1.5" />
                              )}
                            </div>
                          )
                        })}

                        {report.companies.length > 12 && (
                          <div className="text-center text-[10px] text-slate-500 pt-1">
                            ...และอีก {report.companies.length - 12} บริษัท
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="bg-slate-50 p-2 text-center border-t border-slate-100">
                      <span className="text-[10px] text-slate-500">
                        รายงานเมื่อ: {format(new Date(), 'HH:mm น.')} วันที่ {format(new Date(date), 'd MMM yyyy', { locale: th })}
                      </span>
                    </div>
                  </div>
                ) : (
                  /* ── Bubble 2: รายการแจ้งความประสงค์ (Frame 3) ── */
                  <div className="w-full max-w-[380px] bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden text-slate-900">
                    {/* Blue Header */}
                    <div className="bg-[#1e3a8a] p-3 text-white">
                      <h4 className="text-xs font-bold leading-tight">
                        รายการแจ้งความประสงค์
                      </h4>
                    </div>

                    {/* Body */}
                    <div className="p-3 space-y-2.5">
                      {(() => {
                        const allRequests = report.companies.flatMap(c =>
                          c.lateOrRequests.map(r => ({
                            name: r.name,
                            purpose: r.purpose,
                            checkInTime: r.checkInTime,
                            companyName: c.companyName,
                            companyCode: r.companyCode || c.companyCode || '',
                            location: r.location || c.location || '',
                          }))
                        )

                        if (allRequests.length === 0) {
                          return (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center space-y-1">
                              <span className="text-sm font-bold text-emerald-800 block">
                                ✅ ทุกคนเข้าปฏิบัติงานตามปกติ
                              </span>
                              <span className="text-[11px] text-emerald-600">
                                ไม่มีรายการแจ้งมาสายหรือขอความประสงค์พิเศษในวันนี้
                              </span>
                            </div>
                          )
                        }

                        return allRequests.map((r, rIdx) => (
                          <div
                            key={rIdx}
                            className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 space-y-1 text-xs"
                          >
                            <div className="flex items-baseline justify-between gap-1">
                              <span className="font-bold text-slate-900">
                                {rIdx + 1}. {r.name}
                              </span>
                              {r.companyCode && (
                                <span className="font-bold text-blue-700 text-[11px]">
                                  [ {r.companyCode} ]
                                </span>
                              )}
                            </div>

                            <div className="bg-amber-50 border border-amber-200 rounded px-2 py-1 text-amber-900 font-semibold text-[11px]">
                              📝 {r.purpose}
                            </div>

                            <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                              <span>🏢 {r.companyName}</span>
                              {r.location && <span>📍 {r.location}</span>}
                            </div>
                          </div>
                        ))
                      })()}
                    </div>

                    {/* Footer */}
                    <div className="bg-slate-50 p-2 text-center border-t border-slate-100">
                      <span className="text-[10px] text-slate-500">
                        รายงานเมื่อ: {format(new Date(), 'HH:mm น.')} วันที่ {format(new Date(date), 'd MMM yyyy', { locale: th })}
                      </span>
                    </div>
                  </div>
                )
              ) : (
                /* Plain Text / Telegram Preview */
                <div className="w-full max-w-lg bg-white rounded-xl p-4 shadow-sm border border-slate-300 font-mono text-xs whitespace-pre-wrap text-slate-800 leading-relaxed select-all">
                  {lineTextMessage}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Dialog: Unified Notification Configuration (LINE OA & Telegram & Schedule) ── */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="max-w-xl p-5 bg-white rounded-xl shadow-xl border border-slate-200 max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="pb-2.5 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold shrink-0 bg-blue-100 text-blue-700">
                <Settings className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-sm font-bold text-slate-900">
                  ตั้งค่าการแจ้งเตือน (Notification Channels & Schedule)
                </DialogTitle>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  เลือกช่องทางการแจ้งเตือน LINE OA / Telegram และกำหนดรอบเวลาส่งอัตโนมัติผ่าน Supabase
                </p>
              </div>
            </div>

            {/* Top Navigation Tabs */}
            <div className="flex items-center gap-2 mt-3 pt-1 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveConfigTab('channels')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors flex items-center justify-center gap-1.5 ${
                  activeConfigTab === 'channels'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>1. ช่องทางส่ง (LINE OA & Telegram)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveConfigTab('schedule')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors flex items-center justify-center gap-1.5 ${
                  activeConfigTab === 'schedule'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Timer className="w-3.5 h-3.5" />
                <span>2. รอบเวลาส่งอัตโนมัติ (Schedule)</span>
              </button>
            </div>
          </DialogHeader>

          {/* Dialog Scrollable Content */}
          <div className="flex-1 overflow-y-auto py-2.5 space-y-3.5 text-xs scrollbar-thin">
            {activeConfigTab === 'channels' ? (
              /* TAB 1: Channels (LINE OA & Telegram) */
              <div className="space-y-3.5">
                {/* Channel 1: LINE Official Account */}
                <div className={`p-3 rounded-lg border transition-colors ${
                  config.line_enabled ? 'bg-emerald-50/40 border-emerald-300' : 'bg-slate-50 border-slate-200 opacity-80'
                }`}>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                        L
                      </div>
                      <div>
                        <span className="font-bold text-slate-900 text-xs">LINE Official Account (Messaging API)</span>
                        <span className="block text-[10px] text-slate-500">รองรับ Flex Carousel Message แยกแต่ละสาขา</span>
                      </div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <span className="text-xs font-bold text-slate-700">เปิดใช้งาน</span>
                      <Checkbox
                        checked={config.line_enabled}
                        onCheckedChange={v => setConfig(prev => ({ ...prev, line_enabled: !!v }))}
                      />
                    </label>
                  </div>

                  {config.line_enabled && (
                    <div className="mt-3 space-y-2.5">
                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-slate-700">Channel Access Token (Long-lived)</Label>
                        <Input
                          type="password"
                          value={config.line_channel_access_token}
                          onChange={e => setConfig(prev => ({ ...prev, line_channel_access_token: e.target.value }))}
                          placeholder="เช่น eyJhbGciOiJIUzI1Ni..."
                          className="h-8 text-xs bg-white border-slate-300 font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-[11px] font-semibold text-slate-700">Target User ID / Group ID</Label>
                          <label className="flex items-center gap-1.5 text-[11px] cursor-pointer text-slate-700">
                            <Checkbox
                              checked={config.line_broadcast}
                              onCheckedChange={v => setConfig(prev => ({ ...prev, line_broadcast: !!v }))}
                            />
                            <span>Broadcast ทุกคนที่ติดตาม LINE OA</span>
                          </label>
                        </div>
                        <Input
                          value={config.line_target_id}
                          disabled={config.line_broadcast}
                          onChange={e => setConfig(prev => ({ ...prev, line_target_id: e.target.value }))}
                          placeholder={config.line_broadcast ? 'Broadcast ไปยังผู้ติดตามทุกคน' : 'เช่น U12345678... หรือ C12345678...'}
                          className="h-8 text-xs bg-white border-slate-300 font-mono disabled:opacity-50"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Channel 2: Telegram Bot API */}
                <div className={`p-3 rounded-lg border transition-colors ${
                  config.telegram_enabled ? 'bg-sky-50/40 border-sky-300' : 'bg-slate-50 border-slate-200 opacity-80'
                }`}>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-sky-500 text-white flex items-center justify-center font-bold text-xs">
                        <SendHorizontal className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span className="font-bold text-slate-900 text-xs">Telegram (Bot API)</span>
                        <span className="block text-[10px] text-slate-500">ส่งเข้ากลุ่ม หรือ แชทส่วนตัวผ่าน Telegram Bot</span>
                      </div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <span className="text-xs font-bold text-slate-700">เปิดใช้งาน</span>
                      <Checkbox
                        checked={config.telegram_enabled}
                        onCheckedChange={v => setConfig(prev => ({ ...prev, telegram_enabled: !!v }))}
                      />
                    </label>
                  </div>

                  {config.telegram_enabled && (
                    <div className="mt-3 space-y-2.5">
                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-slate-700">Telegram Bot Token (สร้างจาก @BotFather)</Label>
                        <Input
                          type="password"
                          value={config.telegram_bot_token}
                          onChange={e => setConfig(prev => ({ ...prev, telegram_bot_token: e.target.value }))}
                          placeholder="เช่น 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                          className="h-8 text-xs bg-white border-slate-300 font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-slate-700">Telegram Chat ID / Group ID</Label>
                        <Input
                          value={config.telegram_chat_id}
                          onChange={e => setConfig(prev => ({ ...prev, telegram_chat_id: e.target.value }))}
                          placeholder="เช่น -100123456789 (กลุ่ม) หรือ 123456789 (ส่วนตัว)"
                          className="h-8 text-xs bg-white border-slate-300 font-mono"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* TAB 2: Schedule & Supabase Cron */
              <div className="space-y-3.5">
                {/* Enable Schedule Switch */}
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900 text-xs block">เปิดระบบส่งแจ้งเตือนอัตโนมัติตามรอบเวลา</span>
                    <span className="text-[11px] text-slate-500">ระบบจะส่งสรุปรายงานประจำวันเข้าช่องทางที่เปิดใช้งานโดยอัตโนมัติ</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.schedule_enabled}
                      onChange={e => setConfig(prev => ({ ...prev, schedule_enabled: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {/* Schedule Mode */}
                <div className="space-y-1.5 p-3 rounded-lg border border-slate-200 bg-white">
                  <Label className="text-xs font-bold text-slate-800">รูปแบบข้อความส่งเข้า LINE OA ในรอบอัตโนมัติ</Label>
                  <div className="flex items-center gap-4 pt-1">
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-700">
                      <input
                        type="radio"
                        name="schedule_mode"
                        checked={config.schedule_mode === 'flex'}
                        onChange={() => setConfig(prev => ({ ...prev, schedule_mode: 'flex' }))}
                        className="text-blue-600"
                      />
                      <span>LINE Flex Carousel (แยกการ์ดแต่ละสาขา)</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-700">
                      <input
                        type="radio"
                        name="schedule_mode"
                        checked={config.schedule_mode === 'text'}
                        onChange={() => setConfig(prev => ({ ...prev, schedule_mode: 'text' }))}
                        className="text-blue-600"
                      />
                      <span>ข้อความธรรมดา (Text)</span>
                    </label>
                  </div>
                </div>

                {/* Configured Time Slots */}
                <div className="space-y-2 p-3 rounded-lg border border-slate-200 bg-white">
                  <Label className="text-xs font-bold text-slate-800">รอบเวลาส่งประจำวัน (เลือกหรือเพิ่มได้หลายเวลา)</Label>
                  
                  <div className="flex flex-wrap gap-1.5 min-h-[38px] p-2 bg-slate-50 rounded-lg border border-slate-200">
                    {config.schedule_times.length === 0 ? (
                      <span className="text-slate-400 text-xs py-1">ยังไม่มีรอบเวลา กรุณาเพิ่มเวลาด้านล่าง</span>
                    ) : (
                      config.schedule_times.map(t => (
                        <div
                          key={t}
                          className="flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-md border border-blue-300 text-blue-900 font-bold text-xs shadow-2xs"
                        >
                          <Clock className="w-3 h-3 text-blue-600" />
                          <span>{t} น.</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveTimeSlot(t)}
                            className="text-slate-400 hover:text-red-600 ml-1 transition-colors"
                            title="ลบรอบเวลานี้"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add New Time */}
                  <div className="flex items-center gap-2 pt-1 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="time"
                        value={newTimeInput}
                        onChange={e => setNewTimeInput(e.target.value)}
                        className="h-8 text-xs font-bold w-28 bg-white border-slate-300"
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleAddTimeSlot}
                        className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>เพิ่มเวลา</span>
                      </Button>
                    </div>

                    {/* Quick preset buttons */}
                    <div className="flex items-center gap-1 ml-auto flex-wrap">
                      <span className="text-[10px] text-slate-500">ทางลัด:</span>
                      {['09:00', '12:00', '17:00', '18:00'].map(preset => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => {
                            if (!config.schedule_times.includes(preset)) {
                              const updated = [...config.schedule_times, preset].sort()
                              setConfig(prev => ({ ...prev, schedule_times: updated }))
                            }
                          }}
                          className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-slate-200 text-slate-800 hover:bg-slate-300"
                        >
                          +{preset}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={testingConnection}
              className="h-8 text-xs border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 font-bold gap-1.5"
            >
              {testingConnection ? <Loader2 className="w-3 h-3 animate-spin" /> : <BellRing className="w-3 h-3" />}
              <span>ทดสอบส่งข้อความ (Test Connection)</span>
            </Button>

            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfigOpen(false)}
                className="h-8 text-xs bg-white text-slate-700 border-slate-300"
              >
                ปิด
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={async () => {
                  await saveConfig(config)
                  setConfigOpen(false)
                }}
                disabled={savingSettings}
                className="h-8 px-4 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-2xs gap-1"
              >
                {savingSettings && <Loader2 className="w-3 h-3 animate-spin" />}
                <span>บันทึกการตั้งค่า</span>
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
