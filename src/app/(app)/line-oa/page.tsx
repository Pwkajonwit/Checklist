'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import type { ChecklistEntry, Contractor, Company, Activity } from '@/lib/types'
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
  Timer, Plus, Trash2, CheckCircle, Radio
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'

const STORAGE_KEY_CONFIG = 'sitecheck_line_oa_config'
const STORAGE_KEY_SENT_LOGS = 'sitecheck_sent_slots_today'

interface LineConfig {
  channelAccessToken: string
  targetId: string
  broadcast: boolean
  notifyToken: string
  webhookUrl: string
  // Scheduled Daily Notification Settings
  scheduleEnabled: boolean
  scheduleTimes: string[] // e.g. ['09:00', '12:00', '17:00']
  scheduleMode: 'flex' | 'text'
  cronSecret: string
}

const defaultConfig: LineConfig = {
  channelAccessToken: '',
  targetId: '',
  broadcast: false,
  notifyToken: '',
  webhookUrl: '',
  scheduleEnabled: true,
  scheduleTimes: ['09:00', '12:00', '17:00'],
  scheduleMode: 'flex',
  cronSecret: 'sitecheck-cron-secret',
}

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
  const [showJsonDialog, setShowJsonDialog] = useState(false)
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false)

  // Config Modal & Sending State
  const [configOpen, setConfigOpen] = useState(false)
  const [config, setConfig] = useState<LineConfig>(defaultConfig)
  const [newTimeInput, setNewTimeInput] = useState('09:00')
  const [sending, setSending] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copiedJson, setCopiedJson] = useState(false)
  const [copiedCronUrl, setCopiedCronUrl] = useState(false)
  const [customFilterComp, setCustomFilterComp] = useState<string>('all')

  // Log of slots sent today (e.g. ['2026-09-24 09:00', '2026-09-24 12:00'])
  const [sentSlots, setSentSlots] = useState<string[]>([])
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('')

  // Load saved config & sent logs
  useEffect(() => {
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
  }, [])

  const saveConfig = (newCfg: LineConfig) => {
    setConfig(newCfg)
    try {
      localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(newCfg))
      toast.success('บันทึกการตั้งค่า LINE และรอบเวลาแจ้งเตือนเรียบร้อยแล้ว')
    } catch {}
  }

  // Fetch Data
  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true)
    else setRefreshing(true)

    try {
      const [{ data: eData, error: eErr }, { data: cData, error: cErr }, { data: coData, error: coErr }, { data: aData, error: aErr }] =
        await Promise.all([
          supabase.from('checklist_entries').select('*').eq('entry_date', date),
          supabase.from('contractors').select('*').eq('is_active', true).order('name'),
          supabase.from('companies').select('*').order('name'),
          supabase.from('activities').select('*').eq('is_active', true).order('name'),
        ])

      if (eErr) throw eErr
      if (cErr) throw cErr
      if (coErr) throw coErr
      if (aErr) throw aErr

      setEntries(eData ?? [])
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
    if (!config.scheduleEnabled || config.scheduleTimes.length === 0) return null
    const now = new Date()
    const currentH = now.getHours()
    const currentM = now.getMinutes()
    const currentMins = currentH * 60 + currentM

    // Sort times ascending
    const sorted = [...config.scheduleTimes].sort()
    for (const t of sorted) {
      const [h, m] = t.split(':').map(Number)
      const slotMins = h * 60 + m
      if (slotMins > currentMins) {
        return t
      }
    }
    return sorted[0] + ' (พรุ่งนี้)'
  }, [config.scheduleEnabled, config.scheduleTimes, currentTimeStr])

  // Send to LINE OA function
  const dispatchSend = useCallback(async (isAuto = false, slotTime?: string) => {
    if (!config.channelAccessToken && !config.notifyToken && !config.webhookUrl) {
      if (!isAuto) {
        setConfigOpen(true)
        toast.info('กรุณาตั้งค่า Channel Access Token หรือ LINE Notify Token ก่อนส่ง')
      }
      return
    }

    setSending(true)
    try {
      const payload: any = {
        message: lineTextMessage,
        channelAccessToken: config.channelAccessToken,
        targetId: config.targetId,
        broadcast: config.broadcast,
        notifyToken: config.notifyToken,
        webhookUrl: config.webhookUrl,
      }

      if (formatMode === 'flex' && config.channelAccessToken) {
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
        toast.success(`⏰ ระบบได้ส่งรายงานสรุปอัตโนมัติรอบเวลา ${slotTime} น. เข้า LINE เรียบร้อยแล้ว`)
      } else {
        toast.success(
          formatMode === 'flex' && config.channelAccessToken
            ? 'ส่ง LINE Flex Message (แยก Bubble แต่ละสาขา) เรียบร้อยแล้ว!'
            : 'ส่งข้อความสรุปไปยัง LINE เรียบร้อยแล้ว!'
        )
      }
    } catch (err: any) {
      console.error('Send LINE error:', err)
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

      if (!config.scheduleEnabled || !config.scheduleTimes || config.scheduleTimes.length === 0) {
        return
      }

      // Check if current minute matches any scheduled slot
      if (config.scheduleTimes.includes(nowTime)) {
        const slotKey = `${todayStr} ${nowTime}`
        // Check if already dispatched this slot today
        if (!sentSlots.includes(slotKey)) {
          console.log(`Triggering scheduled LINE notification for slot: ${slotKey}`)
          dispatchSend(true, nowTime)
        }
      }
    }, 15000)

    return () => clearInterval(timer)
  }, [config.scheduleEnabled, config.scheduleTimes, sentSlots, dispatchSend])

  // Copy to clipboard
  const handleCopyMessage = () => {
    if (formatMode === 'text') {
      navigator.clipboard.writeText(lineTextMessage)
      setCopied(true)
      toast.success('คัดลอกข้อความสรุป (Text) แล้ว')
      setTimeout(() => setCopied(false), 2500)
    } else {
      navigator.clipboard.writeText(JSON.stringify(flexMessage, null, 2))
      setCopied(true)
      toast.success('คัดลอก LINE Flex Message JSON แล้ว')
      setTimeout(() => setCopied(false), 2500)
    }
  }

  // Copy JSON
  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(flexMessage, null, 2))
    setCopiedJson(true)
    toast.success('คัดลอก Flex JSON เรียบร้อยแล้ว')
    setTimeout(() => setCopiedJson(false), 2000)
  }

  // Copy Cron Endpoint URL
  const handleCopyCronUrl = () => {
    const url = `${window.location.origin}/api/line/cron?secret=${config.cronSecret || 'sitecheck-cron-secret'}&mode=${formatMode}`
    navigator.clipboard.writeText(url)
    setCopiedCronUrl(true)
    toast.success('คัดลอก URL สำหรับ Cron Webhook แล้ว')
    setTimeout(() => setCopiedCronUrl(false), 2500)
  }

  // Time slot handlers
  const handleAddTimeSlot = () => {
    if (!newTimeInput) return
    if (config.scheduleTimes.includes(newTimeInput)) {
      toast.error('มีรอบเวลานี้อยู่แล้ว')
      return
    }
    const updated = [...config.scheduleTimes, newTimeInput].sort()
    saveConfig({ ...config, scheduleTimes: updated })
  }

  const handleRemoveTimeSlot = (time: string) => {
    const updated = config.scheduleTimes.filter(t => t !== time)
    saveConfig({ ...config, scheduleTimes: updated })
  }

  // Test send connection
  const handleTestConnection = async () => {
    setSending(true)
    try {
      const res = await fetch('/api/line/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `🔔 [ทดสอบการเชื่อมต่อระบบ SiteCheck PRO]\nระบบสามารถส่งข้อความแจ้งเตือนเข้า LINE OA ได้อย่างสมบูรณ์แล้ว ✅\nเวลา: ${format(new Date(), 'HH:mm:ss น.')}`,
          channelAccessToken: config.channelAccessToken,
          targetId: config.targetId,
          broadcast: config.broadcast,
          notifyToken: config.notifyToken,
          webhookUrl: config.webhookUrl,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'ทดสอบส่งข้อความไม่สำเร็จ')
      }

      toast.success('ทดสอบสำเร็จ! ได้รับข้อความใน LINE เรียบร้อยแล้ว')
    } catch (err: any) {
      toast.error(err.message || 'ทดสอบไม่สำเร็จ ตรวจสอบ Token หรือ Target ID')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full gap-2.5 overflow-hidden">

      {/* ── Top Controls & Date Bar ── */}
      <div className="p-2 bg-white rounded-lg border border-slate-300 shadow-2xs flex flex-wrap items-center justify-between gap-2 shrink-0">
        
        {/* Left: Title, Schedule Status Pill, and Date Navigator */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-50 text-emerald-900 text-xs font-bold border border-emerald-300">
            <MessageSquare className="w-4 h-4 text-emerald-600" />
            <span>แจ้งเตือน LINE OA (สรุปประจำวัน)</span>
          </div>

          {/* Schedule Status Indicator */}
          <button
            onClick={() => setScheduleDialogOpen(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border transition-colors cursor-pointer ${
              config.scheduleEnabled
                ? 'bg-blue-50 text-blue-900 border-blue-300 hover:bg-blue-100'
                : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
            }`}
            title="คลิกเพื่อตั้งค่าเวลาส่งอัตโนมัติในแต่ละวัน"
          >
            <Timer className={`w-3.5 h-3.5 ${config.scheduleEnabled ? 'text-blue-600' : 'text-slate-500'}`} />
            <span>
              {config.scheduleEnabled ? (
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
          <Button
            size="sm"
            variant="outline"
            onClick={() => setScheduleDialogOpen(true)}
            className="h-8 text-xs border-blue-300 text-blue-900 bg-blue-50/50 hover:bg-blue-100 gap-1.5 font-bold"
          >
            <Timer className="w-3.5 h-3.5 text-blue-700" />
            <span>ตั้งเวลาส่งประจำวัน</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowJsonDialog(true)}
            className="h-8 text-xs border-slate-300 text-slate-700 hover:bg-slate-50 gap-1.5 font-semibold"
            title="ดูโครงสร้าง Flex Message JSON"
          >
            <Code className="w-3.5 h-3.5 text-indigo-600" />
            <span>Flex JSON</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setConfigOpen(true)}
            className="h-8 text-xs border-slate-300 text-slate-700 hover:bg-slate-50 gap-1.5 font-semibold"
          >
            <Settings className="w-3.5 h-3.5 text-slate-600" />
            <span>ตั้งค่า Token</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleCopyMessage}
            className="h-8 text-xs border-slate-300 bg-white hover:bg-slate-100 text-slate-800 gap-1.5 font-bold shadow-2xs"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'คัดลอกแล้ว!' : formatMode === 'flex' ? 'คัดลอก Flex JSON' : 'คัดลอกข้อความ'}</span>
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
            <span>ส่งเข้า LINE OA ตอนนี้</span>
          </Button>
        </div>
      </div>

      {/* ── Main Content Grid: Left (Company Breakdown) | Right (LINE Flex Carousel Mockup) ── */}
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
                  ไม่พบข้อมูลบริษัทในวันที่เลือก
                </div>
              ) : (
                displayCompanies.map((comp, idx) => (
                  <div
                    key={idx}
                    onClick={() => setActiveBubbleIdx(0)}
                    className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-100/70 transition-all flex flex-col gap-2"
                  >
                    {/* Company Header */}
                    <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded bg-slate-200 text-slate-800 text-xs font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <div>
                          <span className="font-bold text-sm text-slate-950">
                            {comp.companyName}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs font-semibold">
                        <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-900 border border-blue-200">
                          เข้างาน {comp.checkedInCount} / {comp.totalRegistered} คน
                        </span>
                        {comp.failedCount > 0 && (
                          <span className="px-2 py-0.5 rounded bg-red-100 text-red-900 border border-red-200">
                            ไม่ผ่าน {comp.failedCount}
                          </span>
                        )}
                        {comp.missingCount > 0 && (
                          <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-800 border border-slate-300">
                            ขาด {comp.missingCount}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Member Details Breakdown */}
                    <div className="space-y-1.5 text-xs">
                      {/* Individual members status list */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 bg-white p-2 rounded border border-slate-200">
                        {comp.membersDetails.map((m, mIdx) => (
                          <div key={mIdx} className="flex items-center justify-between text-[11px] py-0.5 px-1 rounded hover:bg-slate-50">
                            <span className="font-bold text-slate-800 truncate max-w-[140px]">{m.name}</span>
                            <div className="flex items-center gap-1">
                              {m.status === 'passed' && (
                                <span className="text-emerald-700 font-bold">
                                  {m.checkInTime ? `เข้า ${m.checkInTime} น.` : 'เข้างาน'} • ผ่าน
                                </span>
                              )}
                              {m.status === 'failed' && (
                                <span className="text-red-600 font-bold">
                                  {m.checkInTime ? `${m.checkInTime} น.` : ''} ❌ {m.failReason}
                                </span>
                              )}
                              {m.status === 'missing' && (
                                <span className="text-amber-700 font-medium">
                                  ⚠️ ขาด
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Late / Requests */}
                      {comp.lateOrRequests.length > 0 && (
                        <div className="flex items-start gap-1.5 text-amber-900 bg-amber-50/80 p-1.5 rounded border border-amber-200">
                          <Clock className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                          <div className="flex-1">
                            <span className="font-bold">แจ้งเวลา / ขอเข้า ({comp.lateOrRequests.length} คน):</span>
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {comp.lateOrRequests.map((r, i) => (
                                <span key={i} className="px-1.5 py-0.5 bg-white rounded border border-amber-200 text-[11px] font-medium">
                                  {r.name} <strong className="text-amber-800 font-bold">({r.purpose})</strong>
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ────────────────────────────────────────────────────────
            RIGHT COLUMN (6 COLS): LINE Flex Message Carousel Live Preview
        ──────────────────────────────────────────────────────── */}
        <div className="lg:col-span-6 flex flex-col border border-slate-300 rounded-lg bg-slate-900 overflow-hidden shadow-md min-h-0 h-full">
          
          {/* LINE Header with Format Toggle */}
          <div className="px-3 py-2 bg-[#273238] border-b border-slate-700 flex items-center justify-between text-white shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#06C755] flex items-center justify-center font-bold text-white shadow-xs text-xs">
                LINE
              </div>
              <div>
                <p className="text-xs font-bold tracking-tight text-slate-100">
                  {formatMode === 'flex' ? 'LINE Flex Carousel (แยกตาม Bubble)' : 'LINE ข้อความ Text'}
                </p>
                <p className="text-[10px] text-slate-400">Live Preview จำลองการแสดงผลจริง</p>
              </div>
            </div>

            {/* Mode Switcher */}
            <div className="flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-600 text-xs">
              <button
                type="button"
                onClick={() => setFormatMode('flex')}
                className={`px-2.5 py-1 rounded-md font-bold transition-colors ${
                  formatMode === 'flex'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                🎴 Flex Bubble
              </button>
              <button
                type="button"
                onClick={() => setFormatMode('text')}
                className={`px-2.5 py-1 rounded-md font-bold transition-colors ${
                  formatMode === 'text'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                📝 Text
              </button>
            </div>
          </div>
          {/* Carousel Navigation Bar (When in Flex mode) */}
          {formatMode === 'flex' && (
            <div className="px-3 py-1.5 bg-slate-800 border-b border-slate-700 flex items-center justify-between text-white text-xs shrink-0">
              <div className="flex items-center gap-1">
                <button
                  disabled={activeBubbleIdx <= 0}
                  onClick={() => setActiveBubbleIdx(prev => Math.max(0, prev - 1))}
                  className="p-1 rounded hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none"
                  title="Bubble ก่อนหน้า"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-bold text-xs text-emerald-400">
                  Bubble {activeBubbleIdx + 1} / 2
                </span>
                <button
                  disabled={activeBubbleIdx >= 1}
                  onClick={() => setActiveBubbleIdx(prev => Math.min(1, prev + 1))}
                  className="p-1 rounded hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none"
                  title="Bubble ถัดไป"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Bubble Tab Chips: 2 Bubbles only */}
              <div className="flex items-center gap-1 overflow-x-auto max-w-[280px] scrollbar-none py-0.5">
                <button
                  onClick={() => setActiveBubbleIdx(0)}
                  className={`px-2.5 py-0.5 rounded text-[11px] font-bold whitespace-nowrap transition-colors ${
                    activeBubbleIdx === 0
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  🏢 ยอดเข้างาน
                </button>
                <button
                  onClick={() => setActiveBubbleIdx(1)}
                  className={`px-2.5 py-0.5 rounded text-[11px] font-bold whitespace-nowrap transition-colors ${
                    activeBubbleIdx === 1
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  📝 แจ้งความประสงค์
                </button>
              </div>
            </div>
          )}

          {/* Chat Background & Message Area */}
          <div className="flex-1 bg-[#849EB5] p-3 overflow-y-auto scrollbar-thin flex flex-col justify-start items-center min-h-0">
            
            {/* Timestamp Badge */}
            <div className="flex justify-center my-1">
              <span className="text-[10px] bg-black/25 text-white/90 px-2 py-0.5 rounded-full font-medium">
                {format(new Date(), 'EEEEที่ d MMMM yyyy', { locale: th })}
              </span>
            </div>

            {/* Render FLEX Bubble Card */}
            {formatMode === 'flex' ? (
              <div className="w-full max-w-[340px] my-2 transition-all">
                
                {/* ── 1. Overview Bubble (idx 0): การเข้า-ออก และตรวจสอบความปลอดภัยประจำวัน (Frame 2) ── */}
                {activeBubbleIdx === 0 && (() => {
                  const totalRequests = report.companies.reduce((sum, c) => sum + c.lateOrRequests.length, 0)
                  return (
                    <div className="bg-white rounded-2xl overflow-hidden shadow-xl border border-slate-300 flex flex-col">
                      {/* Header */}
                      <div className="bg-[#286b13] text-white px-3.5 py-2.5 flex items-center justify-center text-center">
                        <h4 className="text-xs font-bold text-white leading-normal">
                          การเข้า-ออก และตรวจสอบความปลอดภัยประจำวัน
                        </h4>
                      </div>

                      {/* Body */}
                      <div className="p-3 space-y-3 bg-white">
                        {/* 3 Summary Badges */}
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-[#dcfce7] rounded-lg p-2 flex items-center justify-center">
                            <p className="text-xs font-bold text-[#14532d]">
                              ทีมงานรวม {report.totalPassed}
                            </p>
                          </div>
                          <div className="bg-[#fef3c7] rounded-lg p-2 flex items-center justify-center">
                            <p className="text-xs font-bold text-[#92400e]">
                              ไม่มา {report.totalMissing}
                            </p>
                          </div>
                          <div className="bg-[#dbeafe] rounded-lg p-2 flex items-center justify-center">
                            <p className="text-xs font-bold text-[#1e40af]">
                              ประสงค์ {totalRequests}
                            </p>
                          </div>
                        </div>

                        {/* Company list */}
                        <div className="space-y-2.5 pt-0.5">
                          {report.companies.map((c, i) => {
                            let actTag = c.activityTag || ''
                            if (!actTag) {
                              if (c.activityName && c.companyCode) actTag = `[${c.companyCode}] ${c.activityName}`
                              else if (c.activityName) actTag = c.activityName
                              else if (c.companyCode) actTag = `[${c.companyCode}]`
                            }

                            return (
                              <div key={i} className="space-y-1">
                                {/* Line 1: Company Name & Activity / Code */}
                                <div className="flex items-center justify-between text-xs gap-1">
                                  <span className="font-bold text-slate-900 truncate flex-1 text-left">
                                    {c.companyName}
                                  </span>
                                  {actTag && (
                                    <span className="font-bold text-blue-700 text-[11px] truncate flex-1 text-right">
                                      {actTag}
                                    </span>
                                  )}
                                </div>

                                {/* Line 2: Stats & Location */}
                                <div className="flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-1.5 text-[11px] flex-wrap">
                                    <span className="font-bold text-emerald-700">
                                      มา {c.passedCount}
                                    </span>
                                    {c.alcCount > 0 && (
                                      <span className="font-bold text-red-600">
                                        ALC {c.alcCount}
                                      </span>
                                    )}
                                    {c.ppeFailedCount > 0 && (
                                      <span className="font-bold text-red-600">
                                        ไม่ผ่าน {c.ppeFailedCount}
                                      </span>
                                    )}
                                    <span className="text-slate-800">
                                      ไม่มา {c.missingCount}
                                    </span>
                                    {c.lateOrRequests.length > 0 && (
                                      <span className="text-blue-700 font-medium">
                                        แจ้งประสงค์ {c.lateOrRequests.length}
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-slate-800 text-[11px] text-right truncate max-w-[110px]">
                                    {c.location || '-'}
                                  </span>
                                </div>

                                {i < report.companies.length - 1 && (
                                  <hr className="border-slate-100 my-1" />
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="bg-slate-50 p-2 text-center text-[10px] text-slate-500 border-t border-slate-200">
                        รายงานเมื่อ: {format(new Date(), 'HH:mm น.')} วันที่ {format(new Date(date), 'd MMM yyyy', { locale: th })}
                      </div>
                    </div>
                  )
                })()}

                {/* ── 2. Requests Bubble (idx 1): รายการแจ้งความประสงค์ (Frame 3) ── */}
                {activeBubbleIdx === 1 && (() => {
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

                  return (
                    <div className="bg-white rounded-2xl overflow-hidden shadow-xl border border-slate-300 flex flex-col">
                      {/* Header */}
                      <div className="bg-[#e0f2fe] px-3.5 py-2.5 flex items-center justify-center text-center">
                        <h4 className="text-xs font-bold text-slate-900">
                          รายการแจ้งความประสงค์
                        </h4>
                      </div>

                      {/* Body */}
                      <div className="p-3 space-y-3 bg-white">
                        {allRequests.length === 0 ? (
                          <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200 text-center space-y-1">
                            <p className="text-xs font-bold text-emerald-800">✅ ทุกคนเข้าปฏิบัติงานตามปกติ</p>
                            <p className="text-[11px] text-emerald-600">ไม่มีผู้แจ้งความประสงค์พิเศษในวันนี้</p>
                          </div>
                        ) : (
                          <div className="space-y-3 max-h-[360px] overflow-y-auto">
                            {allRequests.map((r, i) => {
                              const compLabel = r.companyCode
                                ? `${r.companyName} [ ${r.companyCode} ]`
                                : r.companyName

                              return (
                                <div key={i} className="space-y-1">
                                  {/* Row 1: Company [ Code ] (Left) | สถานที่ (Right) */}
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="font-bold text-slate-900 truncate max-w-[190px]">
                                      {compLabel}
                                    </span>
                                    <span className="font-bold text-slate-900 text-right">
                                      สถานที่
                                    </span>
                                  </div>

                                  {/* Row 2: Worker Name + Purpose (Left) | Location (Right) */}
                                  <div className="flex items-center justify-between text-xs text-slate-800">
                                    <span className="truncate max-w-[190px]">
                                      {r.name}   {r.purpose}
                                    </span>
                                    <span className="text-right truncate max-w-[100px]">
                                      {r.location || '-'}
                                    </span>
                                  </div>

                                  {i < allRequests.length - 1 && (
                                    <hr className="border-slate-100 my-1.5" />
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>

                      {/* Footer */}
                      <div className="bg-slate-50 p-2 text-center text-[10px] text-slate-500 border-t border-slate-200">
                        รายงานเมื่อ: {format(new Date(), 'HH:mm น.')} วันที่ {format(new Date(date), 'd MMM yyyy', { locale: th })}
                      </div>
                    </div>
                  )
                })()}

              </div>
            ) : (
              /* Render TEXT Message Bubble */
              <div className="flex items-start gap-2 max-w-[95%] sm:max-w-[90%] my-1">
                <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0 shadow-xs">
                  Site
                </div>

                <div className="bg-white rounded-2xl rounded-tl-none p-3 shadow-md border border-slate-200 text-slate-900 text-xs font-normal leading-relaxed whitespace-pre-wrap select-text">
                  {lineTextMessage}
                </div>
              </div>
            )}
          </div>

          {/* Chat Footer Action */}
          <div className="p-2.5 bg-white border-t border-slate-300 flex items-center justify-between gap-2 shrink-0">
            <span className="text-[11px] text-slate-600 truncate max-w-[200px]">
              รูปแบบ: <strong className="text-emerald-700 font-bold">{formatMode === 'flex' ? '🎴 Flex Carousel' : '📝 ข้อความ Text'}</strong>
            </span>

            <Button
              size="sm"
              onClick={() => dispatchSend(false)}
              disabled={sending || loading}
              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1 shadow-2xs"
            >
              {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              <span>ส่งเข้า LINE</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ── Dialog: Daily Schedule Settings ── */}
      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent className="max-w-lg p-5 bg-white rounded-xl shadow-xl border border-slate-200">
          <DialogHeader className="pb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold shrink-0 bg-blue-100 text-blue-700">
                <Timer className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-sm font-bold text-slate-900">
                  ตั้งเวลาส่งการแจ้งเตือนอัตโนมัติประจำวัน
                </DialogTitle>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  กำหนดรอบเวลาที่ต้องการให้ระบบส่งสรุปรายงานเข้า LINE OA ในแต่ละวัน
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3.5 py-2 text-xs">
            {/* Enable switch */}
            <div className="p-3 rounded-lg border border-blue-200 bg-blue-50/60 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="font-bold text-blue-950 text-xs">เปิดใช้งานระบบส่งอัตโนมัติตามเวลา</span>
                <p className="text-[11px] text-blue-800">
                  เมื่อถึงเวลาที่กำหนด ระบบจะรวบรวมข้อมูลและส่งเข้า LINE OA ทันที
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.scheduleEnabled}
                  onChange={e => setConfig(prev => ({ ...prev, scheduleEnabled: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Configured Time Slots */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-800">รอบเวลาส่งประจำวัน (เลือกหรือเพิ่มได้หลายเวลา)</Label>
              
              <div className="flex flex-wrap gap-1.5 min-h-[38px] p-2 bg-slate-50 rounded-lg border border-slate-200">
                {config.scheduleTimes.length === 0 ? (
                  <span className="text-slate-400 text-xs py-1">ยังไม่มีรอบเวลา กรุณาเพิ่มเวลาด้านล่าง</span>
                ) : (
                  config.scheduleTimes.map(t => (
                    <div
                      key={t}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-md border border-blue-300 text-blue-900 font-bold text-xs shadow-2xs"
                    >
                      <Clock className="w-3 h-3 text-blue-600" />
                      <span>{t} น.</span>
                      <button
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
              <div className="flex items-center gap-2 pt-1">
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
                        if (!config.scheduleTimes.includes(preset)) {
                          const updated = [...config.scheduleTimes, preset].sort()
                          saveConfig({ ...config, scheduleTimes: updated })
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

            {/* External Cron Webhook URL (For Production Server) */}
            <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-xs">🔗 Webhook / External Cron URL (ระบบอัตโนมัติ 24 ชม.)</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyCronUrl}
                  className="h-6 px-2 text-[10px] border-slate-300 bg-white text-slate-800 font-bold gap-1"
                >
                  {copiedCronUrl ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedCronUrl ? 'คัดลอกแล้ว' : 'คัดลอก URL'}</span>
                </Button>
              </div>
              <p className="text-[11px] text-slate-500">
                สามารถนำ URL นี้ไปตั้งใน <strong>cron-job.org</strong> หรือ <strong>Vercel Cron</strong> เพื่อให้ระบบยิงอัตโนมัติโดยไม่ต้องเปิดหน้าเว็บทิ้งไว้:
              </p>
              <div className="bg-white p-1.5 rounded border border-slate-300 text-[10px] font-mono text-slate-700 break-all select-all">
                {typeof window !== 'undefined' ? `${window.location.origin}/api/line/cron?secret=${config.cronSecret || 'sitecheck-cron-secret'}&mode=${formatMode}` : '/api/line/cron'}
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2.5 border-t border-slate-100 flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setScheduleDialogOpen(false)}
              className="h-8 text-xs bg-white text-slate-700 border-slate-300"
            >
              ปิด
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                saveConfig(config)
                setScheduleDialogOpen(false)
              }}
              className="h-8 px-4 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-2xs"
            >
              บันทึกรอบเวลา
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: View & Copy Flex JSON ── */}
      <Dialog open={showJsonDialog} onOpenChange={setShowJsonDialog}>
        <DialogContent className="max-w-2xl p-5 bg-white rounded-xl shadow-xl border border-slate-200">
          <DialogHeader className="pb-2 border-b border-slate-100 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Code className="w-4 h-4 text-indigo-600" />
              <DialogTitle className="text-sm font-bold text-slate-900">
                LINE Flex Message JSON (แยก Bubble แต่ละสาขา)
              </DialogTitle>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopyJson}
              className="h-7 text-xs border-indigo-300 bg-indigo-50 text-indigo-900 font-bold gap-1"
            >
              {copiedJson ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              <span>{copiedJson ? 'คัดลอกแล้ว' : 'คัดลอก JSON'}</span>
            </Button>
          </DialogHeader>

          <div className="mt-2">
            <p className="text-[11px] text-slate-500 mb-2">
              นำโครงสร้าง JSON นี้ไปวางใน <strong>LINE Bot Designer</strong> หรือใช้ใน Broadcast Console / Webhook ของ LINE Official Account ได้ทันที:
            </p>
            <div className="bg-slate-950 text-emerald-400 p-3 rounded-lg font-mono text-[11px] max-h-[360px] overflow-y-auto scrollbar-thin select-all">
              <pre>{JSON.stringify(flexMessage, null, 2)}</pre>
            </div>
          </div>

          <DialogFooter className="pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowJsonDialog(false)}
              className="h-8 text-xs bg-white text-slate-700 border-slate-300"
            >
              ปิดหน้าต่าง
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: LINE OA Configuration ── */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="max-w-md p-5 bg-white rounded-xl shadow-xl border border-slate-200">
          <DialogHeader className="pb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold shrink-0 bg-emerald-100 text-emerald-700">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-sm font-bold text-slate-900">
                  ตั้งค่าการเชื่อมต่อ LINE Official Account
                </DialogTitle>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  ระบุ Channel Access Token หรือ LINE Notify เพื่อส่งแจ้งเตือนอัตโนมัติ
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            {/* Provider 1: LINE Messaging API */}
            <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-xs">1. LINE Messaging API (LINE OA)</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold">รองรับ Flex Message</span>
              </div>

              {/* Channel Access Token */}
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-slate-700">Channel Access Token (Long-lived)</Label>
                <Input
                  type="password"
                  value={config.channelAccessToken}
                  onChange={e => setConfig(prev => ({ ...prev, channelAccessToken: e.target.value }))}
                  placeholder="เช่น eyJhbGciOiJIUzI1Ni..."
                  className="h-8 text-xs bg-white border-slate-300 font-mono"
                />
              </div>

              {/* Target ID & Broadcast */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] font-semibold text-slate-700">Target User ID / Group ID</Label>
                  <label className="flex items-center gap-1.5 text-[11px] cursor-pointer text-slate-700">
                    <Checkbox
                      checked={config.broadcast}
                      onCheckedChange={v => setConfig(prev => ({ ...prev, broadcast: !!v }))}
                    />
                    <span>Broadcast ทุกคน</span>
                  </label>
                </div>
                <Input
                  value={config.targetId}
                  disabled={config.broadcast}
                  onChange={e => setConfig(prev => ({ ...prev, targetId: e.target.value }))}
                  placeholder={config.broadcast ? 'Broadcast ไปยังผู้ติดตามทุกคน' : 'เช่น U12345678... หรือ C12345678...'}
                  className="h-8 text-xs bg-white border-slate-300 font-mono disabled:opacity-50"
                />
              </div>
            </div>

            {/* Provider 2: LINE Notify / Webhook */}
            <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
              <span className="font-bold text-slate-900 text-xs">2. LINE Notify Token หรือ Webhook URL (ทางเลือก)</span>
              
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-slate-700">LINE Notify Access Token</Label>
                <Input
                  type="password"
                  value={config.notifyToken}
                  onChange={e => setConfig(prev => ({ ...prev, notifyToken: e.target.value }))}
                  placeholder="เช่น xXxXxXxXxXxXxXxXx..."
                  className="h-8 text-xs bg-white border-slate-300 font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-slate-700">Custom Webhook Endpoint URL</Label>
                <Input
                  value={config.webhookUrl}
                  onChange={e => setConfig(prev => ({ ...prev, webhookUrl: e.target.value }))}
                  placeholder="https://example.com/api/line-webhook"
                  className="h-8 text-xs bg-white border-slate-300 font-mono"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={sending}
              className="h-8 text-xs border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 font-bold gap-1"
            >
              {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <BellRing className="w-3 h-3" />}
              <span>ทดสอบส่งข้อความ</span>
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
                onClick={() => {
                  saveConfig(config)
                  setConfigOpen(false)
                }}
                className="h-8 px-4 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-2xs"
              >
                บันทึกการตั้งค่า
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

