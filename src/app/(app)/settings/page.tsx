'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Sliders, Plus, Trash2, Edit2, Check, ArrowUp, ArrowDown,
  RotateCcw, Save, ShieldCheck, Sparkles, RefreshCw, Layers,
  UtensilsCrossed, Clock, DollarSign, Store, Phone,
  MessageSquare, Info, CheckCircle2, XCircle, AlertCircle,
  BellRing, Smartphone, SendHorizontal, Timer, ExternalLink,
  Eye, EyeOff, Loader2, Send, Copy,
  Wifi, WifiOff, History, CheckCircle, RefreshCcw, Shield
} from 'lucide-react'
import {
  ChecklistPpeItem,
  DEFAULT_CHECKLIST_PPE_ITEMS,
  MealConfig,
  DEFAULT_MEAL_CONFIG,
  NotificationConfig,
  DEFAULT_NOTIFICATION_CONFIG,
  NotificationLogEntry,
} from '@/lib/types'
import { VERCEL_CRON_ROUNDS } from '@/lib/line-service'
import { toast } from 'sonner'

const PRESET_ICONS = [
  '⛑️', '🦺', '🥽', '🧤', '👢', '🎧', '😷', '🧗', '🛡️', '🧯', '🔦', '🦻', '👓'
]

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'ppe' | 'meal' | 'notification'>('ppe')

  // PPE Settings State
  const [items, setItems] = useState<ChecklistPpeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Edit / Add form state for PPE
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [itemLabel, setItemLabel] = useState('')
  const [itemIcon, setItemIcon] = useState('🛡️')
  const [itemRequired, setItemRequired] = useState(true)

  // Meal Allowance Settings State (Feature Toggle for future)
  const [mealConfig, setMealConfig] = useState<MealConfig>(DEFAULT_MEAL_CONFIG)
  const [savingMeal, setSavingMeal] = useState(false)

  // Notification Settings State (LINE OA & Telegram & Schedule)
  const [notifConfig, setNotifConfig] = useState<NotificationConfig>(DEFAULT_NOTIFICATION_CONFIG)
  const [savingNotif, setSavingNotif] = useState(false)
  const [testingNotif, setTestingNotif] = useState(false)
  const [newTimeInput, setNewTimeInput] = useState('09:00')
  const [showToken, setShowToken] = useState(false)
  const [showTgToken, setShowTgToken] = useState(false)

  // Connection Verification State
  const [connectionStatus, setConnectionStatus] = useState<{
    loading: boolean
    checkedAt: string | null
    line: {
      configured: boolean
      connected: boolean
      bot: {
        displayName: string
        basicId: string
        pictureUrl?: string
        userId?: string
      } | null
      targetValid: boolean
      targetType: string
      quota: {
        type: 'limited' | 'none' | 'unknown'
        total: number | null
        used: number | null
        remaining: number | null
        percentRemaining: number | null
      } | null
      error: string | null
    }
    telegram: {
      configured: boolean
      connected: boolean
      bot: {
        username: string
        first_name: string
      } | null
      error: string | null
    }
  }>({
    loading: false,
    checkedAt: null,
    line: { configured: false, connected: false, bot: null, targetValid: false, targetType: 'none', quota: null, error: null },
    telegram: { configured: false, connected: false, bot: null, error: null },
  })

  // Notification Logs State
  const [notifLogs, setNotifLogs] = useState<NotificationLogEntry[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [clearingLogs, setClearingLogs] = useState(false)

  // Detect URL parameter ?tab=... to switch tab automatically
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const tab = params.get('tab')
      if (tab === 'notification' || tab === 'line' || tab === 'line-oa') {
        setActiveTab('notification')
      } else if (tab === 'meal') {
        setActiveTab('meal')
      } else if (tab === 'ppe') {
        setActiveTab('ppe')
      }
    }
  }, [])

  useEffect(() => {
    loadSettings()
    loadMealSettings()
    loadNotifSettings()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/settings?id=checklist_ppe_items&t=${Date.now()}`, { cache: 'no-store' })
      const json = await res.json()
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        setItems(json.data)
      } else {
        setItems(DEFAULT_CHECKLIST_PPE_ITEMS)
      }
    } catch {
      setItems(DEFAULT_CHECKLIST_PPE_ITEMS)
    } finally {
      setLoading(false)
    }
  }

  const loadMealSettings = async () => {
    try {
      const res = await fetch(`/api/settings?id=meal_config&t=${Date.now()}`, { cache: 'no-store' })
      const json = await res.json()
      if (json.success && json.data) {
        setMealConfig({ ...DEFAULT_MEAL_CONFIG, ...json.data })
      }
    } catch (err) {
      console.error('Failed to load meal config:', err)
    }
  }

  const loadNotifSettings = async () => {
    try {
      const res = await fetch(`/api/settings?id=notification_config&t=${Date.now()}`, { cache: 'no-store' })
      const json = await res.json()
      if (json.success && json.data) {
        const loadedCfg = {
          ...DEFAULT_NOTIFICATION_CONFIG,
          ...json.data,
          schedule_times: ['08:50', '10:30', '14:30'],
        }
        setNotifConfig(loadedCfg)
        checkConnectionWithConfig(loadedCfg, false)
        fetchLogs()
      }
    } catch (err) {
      console.error('Failed to load notification config:', err)
    }
  }

  // PPE handlers
  const handleStartAdd = () => {
    setIsAdding(true)
    setEditingIndex(null)
    setItemLabel('')
    setItemIcon('🛡️')
    setItemRequired(true)
  }

  const handleStartEdit = (index: number) => {
    const it = items[index]
    setEditingIndex(index)
    setIsAdding(false)
    setItemLabel(it.label)
    setItemIcon(it.icon || '🛡️')
    setItemRequired(it.required ?? true)
  }

  const handleCancelForm = () => {
    setIsAdding(false)
    setEditingIndex(null)
    setItemLabel('')
  }

  const handleSaveItem = () => {
    const trimmed = itemLabel.trim()
    if (!trimmed) {
      toast.warning('กรุณากรอกชื่อรายการอุปกรณ์')
      return
    }

    if (isAdding) {
      const newItem: ChecklistPpeItem = {
        id: `ppe_${Date.now()}`,
        label: trimmed,
        icon: itemIcon || '🛡️',
        required: itemRequired,
        is_active: true,
        sort_order: items.length + 1,
      }
      setItems([...items, newItem])
      setIsAdding(false)
      setItemLabel('')
      toast.success(`เพิ่ม "${trimmed}" แล้ว`)
    } else if (editingIndex !== null) {
      const updated = [...items]
      updated[editingIndex] = {
        ...updated[editingIndex],
        label: trimmed,
        icon: itemIcon || '🛡️',
        required: itemRequired,
      }
      setItems(updated)
      setEditingIndex(null)
      setItemLabel('')
      toast.success(`อัปเดต "${trimmed}" แล้ว`)
    }
  }

  const handleToggleActive = (index: number) => {
    const updated = [...items]
    updated[index].is_active = !updated[index].is_active
    setItems(updated)
  }

  const handleMoveUp = (index: number) => {
    if (index === 0) return
    const updated = [...items]
    const temp = updated[index - 1]
    updated[index - 1] = updated[index]
    updated[index - 1].sort_order = index
    temp.sort_order = index + 1
    setItems(updated)
  }

  const handleMoveDown = (index: number) => {
    if (index === items.length - 1) return
    const updated = [...items]
    const temp = updated[index + 1]
    updated[index + 1] = updated[index]
    updated[index + 1].sort_order = index + 2
    temp.sort_order = index + 1
    setItems(updated)
  }

  const handleDelete = (index: number) => {
    const target = items[index]
    if (confirm(`คุณแน่ใจว่าต้องการลบ "${target.label}" หรือไม่?`)) {
      setItems(items.filter((_, i) => i !== index))
      toast.info(`ลบ "${target.label}" แล้ว`)
    }
  }

  const handleResetDefaults = () => {
    if (confirm('ต้องการรีเซ็ตรายการเช็คลิสต์กลับเป็น 5 รายการมาตรฐานใช่หรือไม่?')) {
      setItems(DEFAULT_CHECKLIST_PPE_ITEMS)
      setIsAdding(false)
      setEditingIndex(null)
      toast.info('รีเซ็ตเป็นค่าเริ่มต้นแล้ว (อย่าลืมกดบันทึก)')
    }
  }

  const handleSaveAllPpe = async () => {
    if (items.length === 0) {
      toast.warning('ต้องมีรายการเช็คลิสต์อย่างน้อย 1 รายการ')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'checklist_ppe_items',
          items: items.map((it, idx) => ({ ...it, sort_order: idx + 1 })),
        }),
      })

      const json = await res.json()
      if (json.success) {
        toast.success('บันทึกการตั้งค่าเช็คลิสต์เรียบร้อยแล้ว')
      } else {
        toast.error(json.error || 'บันทึกล้มเหลว')
      }
    } catch (err: any) {
      toast.error('เกิดข้อผิดพลาดในการบันทึก: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // Meal Allowance Handlers
  const handleSaveMealConfig = async () => {
    setSavingMeal(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'meal_config',
          config: mealConfig,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(
          mealConfig.enabled
            ? '🟢 เปิดใช้งานระบบค่าอาหารและบันทึกการตั้งค่าแล้ว'
            : '⚪ บันทึกการตั้งค่าแล้ว (สถานะ: ปิดใช้งานฟังก์ชัน/ซ่อนจากหน้าจอ)'
        )
      } else {
        toast.error(json.error || 'บันทึกล้มเหลว')
      }
    } catch (err: any) {
      toast.error('เกิดข้อผิดพลาดในการบันทึก: ' + err.message)
    } finally {
      setSavingMeal(false)
    }
  }

  const handleResetMealConfig = () => {
    if (confirm('ต้องการรีเซ็ตการตั้งค่าระบบค่าอาหารกลับเป็นค่าเริ่มต้นหรือไม่?')) {
      setMealConfig(DEFAULT_MEAL_CONFIG)
      toast.info('รีเซ็ตเป็นค่าเริ่มต้นแล้ว (สถานะ: ปิดใช้งาน)')
    }
  }



  // Notification Handlers
  const handleSaveNotifConfig = async () => {
    setSavingNotif(true)
    try {
      const payloadConfig = {
        ...notifConfig,
        schedule_times: ['08:50', '10:30', '14:30'],
      }
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'notification_config',
          config: payloadConfig,
        }),
      })
      const json = await res.json()
      if (json.success) {
        setNotifConfig(payloadConfig)
        toast.success('บันทึกการตั้งค่าการแจ้งเตือนเรียบร้อยแล้ว')
        await checkConnectionWithConfig(payloadConfig, false)
        await fetchLogs()
      } else {
        toast.error(json.error || 'บันทึกล้มเหลว')
      }
    } catch (err: any) {
      toast.error('เกิดข้อผิดพลาดในการบันทึก: ' + err.message)
    } finally {
      setSavingNotif(false)
    }
  }

  const checkConnectionWithConfig = async (cfg: NotificationConfig, manual = false) => {
    setConnectionStatus(prev => ({ ...prev, loading: true }))
    try {
      const params = new URLSearchParams()
      if (cfg.line_channel_access_token) params.set('token', cfg.line_channel_access_token)
      if (cfg.line_target_id) params.set('target_id', cfg.line_target_id)
      params.set('broadcast', String(cfg.line_broadcast))
      if (cfg.telegram_bot_token) params.set('tg_token', cfg.telegram_bot_token)

      const res = await fetch(`/api/notifications/verify?${params.toString()}&t=${Date.now()}`, { cache: 'no-store' })
      const json = await res.json()
      if (json.success && json.data) {
        const bkkTime = new Intl.DateTimeFormat('th-TH', {
          timeZone: 'Asia/Bangkok',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }).format(new Date()) + ' น.'

        setConnectionStatus({
          loading: false,
          checkedAt: bkkTime,
          line: json.data.line,
          telegram: json.data.telegram,
        })

        if (manual) {
          if (json.data.line.connected) {
            toast.success(`LINE OA เชื่อมต่อถูกต้อง: ${json.data.line.bot?.displayName || ''} (${json.data.line.bot?.basicId || ''})`)
          } else if (json.data.line.configured) {
            toast.error(`LINE OA ไม่ถูกต้อง: ${json.data.line.error || ''}`)
          } else {
            toast.info('ยังไม่ได้ระบุ Channel Access Token')
          }
        }
      } else {
        setConnectionStatus(prev => ({ ...prev, loading: false }))
      }
    } catch (err: any) {
      setConnectionStatus(prev => ({ ...prev, loading: false }))
      if (manual) toast.error('ไม่สามารถตรวจสอบได้: ' + err.message)
    }
  }

  const checkConnection = async (manual = false) => {
    await checkConnectionWithConfig(notifConfig, manual)
  }

  const fetchLogs = async () => {
    setLoadingLogs(true)
    try {
      const res = await fetch(`/api/notifications/logs?t=${Date.now()}`, { cache: 'no-store' })
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        setNotifLogs(json.data)
      }
    } catch (err) {
      console.warn('Fetch logs error:', err)
    } finally {
      setLoadingLogs(false)
    }
  }

  const handleClearLogs = async () => {
    if (!confirm('ต้องการล้างประวัติการแจ้งเตือนทั้งหมดใช่หรือไม่?')) return
    setClearingLogs(true)
    try {
      const res = await fetch('/api/notifications/logs', { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        setNotifLogs([])
        toast.success('ล้างประวัติการแจ้งเตือนเรียบร้อยแล้ว')
      } else {
        toast.error(json.error || 'ล้างไม่สำเร็จ')
      }
    } catch (err: any) {
      toast.error('เกิดข้อผิดพลาด: ' + err.message)
    } finally {
      setClearingLogs(false)
    }
  }

  const [triggeringSlot, setTriggeringSlot] = useState<string | null>(null)

  const handleTriggerCronSlot = async (slot: string) => {
    setTriggeringSlot(slot)
    try {
      const secret = notifConfig.cron_secret || 'sitecheck-cron-secret'
      const endpoint = slot === '14:30'
        ? `/api/line/meal-cron?secret=${encodeURIComponent(secret)}`
        : `/api/line/cron?slot=${encodeURIComponent(slot)}&secret=${encodeURIComponent(secret)}&force=true`

      const res = await fetch(endpoint, {
        headers: { 'x-vercel-cron': '1' },
      })
      const data = await res.json()
      if (res.ok && (data.success || data.executed)) {
        toast.success(`ทดสอบยิงรอบ ${slot} น. สำเร็จ! กรุณาตรวจสอบใน LINE OA`)
      } else {
        toast.error(`ยิงรอบ ${slot} น. ไม่สำเร็จ: ${data.message || data.error || 'ตรวจสอบการเชื่อมต่อ'}`)
      }
      await fetchLogs()
    } catch (err: any) {
      toast.error(`เกิดข้อผิดพลาดในการยิงรอบ ${slot} น.: ${err.message}`)
    } finally {
      setTriggeringSlot(null)
    }
  }

  const handleResetNotifConfig = () => {
    if (confirm('ต้องการรีเซ็ตการตั้งค่าการแจ้งเตือนกลับเป็นค่าเริ่มต้นหรือไม่?')) {
      setNotifConfig(DEFAULT_NOTIFICATION_CONFIG)
      toast.info('รีเซ็ตการตั้งค่าการแจ้งเตือนเป็นค่าเริ่มต้นแล้ว')
    }
  }

  const handleTestNotifConnection = async () => {
    const isLineReady = notifConfig.line_enabled && notifConfig.line_channel_access_token
    const isTgReady = notifConfig.telegram_enabled && notifConfig.telegram_bot_token && notifConfig.telegram_chat_id

    if (!isLineReady && !isTgReady) {
      toast.warning('กรุณาเปิดใช้งานและระบุข้อมูลของ LINE OA หรือ Telegram ก่อนทดสอบ')
      return
    }

    setTestingNotif(true)
    try {
      const bkkTime = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Bangkok',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(new Date()) + ' น.'

      const res = await fetch('/api/line/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'ทดสอบส่งข้อความ (Test Notification)',
          message: `🔔 [ทดสอบการแจ้งเตือน SiteCheck PRO]\nระบบสามารถเชื่อมต่อและส่งข้อความแจ้งเตือนได้อย่างถูกต้อง ✅\nเวลา: ${bkkTime}`,
          line_enabled: notifConfig.line_enabled,
          line_channel_access_token: notifConfig.line_channel_access_token,
          line_target_id: notifConfig.line_target_id,
          line_broadcast: notifConfig.line_broadcast,
          telegram_enabled: notifConfig.telegram_enabled,
          telegram_bot_token: notifConfig.telegram_bot_token,
          telegram_chat_id: notifConfig.telegram_chat_id,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'ทดสอบส่งไม่สำเร็จ')
      toast.success(data.message || 'ส่งข้อความทดสอบสำเร็จ! กรุณาตรวจสอบใน LINE หรือ Telegram')
      await fetchLogs()
      await checkConnection(false)
    } catch (err: any) {
      toast.error('ทดสอบไม่สำเร็จ: ' + (err.message || 'กรุณาตรวจสอบ Token'))
      await fetchLogs()
    } finally {
      setTestingNotif(false)
    }
  }

  const handleAddTimeSlot = () => {
    if (!newTimeInput) return
    if (notifConfig.schedule_times.includes(newTimeInput)) {
      toast.error('มีรอบเวลานี้อยู่แล้ว')
      return
    }
    const updated = [...notifConfig.schedule_times, newTimeInput].sort()
    setNotifConfig(prev => ({ ...prev, schedule_times: updated }))
    toast.success(`เพิ่มรอบเวลา ${newTimeInput} น. แล้ว`)
  }

  const handleRemoveTimeSlot = (time: string) => {
    const updated = notifConfig.schedule_times.filter(t => t !== time)
    setNotifConfig(prev => ({ ...prev, schedule_times: updated }))
  }

  return (
    <div className="flex-1 w-full h-full min-h-0 overflow-y-auto">
      <div className="w-full max-w-5xl mx-auto space-y-4 pb-12 pr-1 sm:pr-2">
        {/* Page Title */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Sliders className="w-5 h-5 text-blue-600" />
          <span>การตั้งค่าระบบ (System Settings)</span>
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          จัดการอุปกรณ์ PPE, ระบบข้าวกล่อง, และการแจ้งเตือน LINE
        </p>
      </div>

      {/* Section Tabs (3 Equal Columns spanning full card width) */}
      <div className="w-full grid grid-cols-3 gap-1.5 p-1.5 bg-slate-200/80 rounded-xl border border-slate-300 shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveTab('ppe')}
          className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all w-full min-w-0 ${
            activeTab === 'ppe'
              ? 'bg-white text-blue-700 shadow-sm border border-blue-200/60 ring-1 ring-blue-500/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
          <span className="truncate">อุปกรณ์ PPE</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 text-blue-800 font-mono shrink-0">
            {items.filter(i => i.is_active).length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('meal')}
          className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all w-full min-w-0 ${
            activeTab === 'meal'
              ? 'bg-white text-amber-800 shadow-sm border border-amber-200/60 ring-1 ring-amber-500/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
          }`}
        >
          <UtensilsCrossed className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="truncate">ข้าวกล่อง</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold shrink-0 ${
            mealConfig.enabled
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
              : 'bg-slate-200 text-slate-500'
          }`}>
            {mealConfig.enabled ? 'เปิดใช้' : 'ปิด'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('notification')}
          className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all w-full min-w-0 ${
            activeTab === 'notification'
              ? 'bg-white text-emerald-800 shadow-sm border border-emerald-200/60 ring-1 ring-emerald-500/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
          }`}
        >
          <BellRing className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="truncate">แจ้งเตือน LINE</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold shrink-0 ${
            notifConfig.line_enabled || notifConfig.telegram_enabled
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
              : 'bg-slate-200 text-slate-500'
          }`}>
            {notifConfig.line_enabled || notifConfig.telegram_enabled ? 'เปิดใช้' : 'ปิด'}
          </span>
        </button>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 1: PPE ITEMS CONFIGURATION                                 */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'ppe' && (
        <div className="w-full bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          {/* Header */}
          <div className="px-3.5 py-3 border-b border-slate-200 bg-slate-50/80 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-xs font-bold text-slate-800">รายการอุปกรณ์ความปลอดภัย (PPE Items)</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold border border-emerald-200">
                เปิดใช้ {items.filter(i => i.is_active).length} / {items.length} รายการ
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleResetDefaults}
                className="text-[11px] text-slate-600 hover:text-slate-900 px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 flex items-center gap-1 transition-all"
              >
                <RotateCcw className="w-3 h-3 text-slate-500" />
                <span>รีเซ็ต 5 รายการเดิม</span>
              </button>

              {!isAdding && editingIndex === null && (
                <button
                  type="button"
                  onClick={handleStartAdd}
                  className="text-[11px] font-bold text-white px-3 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1 shadow-2xs transition-all active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>เพิ่มรายการใหม่</span>
                </button>
              )}
            </div>
          </div>

          <div className="p-3.5 space-y-3">
            {/* Add / Edit Form Card */}
            {(isAdding || editingIndex !== null) && (
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg space-y-2.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-950">
                  <span>{isAdding ? '➕ เพิ่มรายการอุปกรณ์ใหม่' : '✏️ แก้ไขรายการอุปกรณ์'}</span>
                  <button
                    type="button"
                    onClick={handleCancelForm}
                    className="text-[11px] text-slate-500 hover:text-slate-800"
                  >
                    ยกเลิก
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                  <div className="sm:col-span-6 space-y-1">
                    <label className="text-[11px] font-semibold text-slate-700">ชื่ออุปกรณ์</label>
                    <input
                      type="text"
                      value={itemLabel}
                      onChange={e => setItemLabel(e.target.value)}
                      placeholder="เช่น แว่นตาเซฟตี้, เข็มขัดกันตก..."
                      className="w-full text-xs h-8 px-2.5 rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      autoFocus
                    />
                  </div>

                  <div className="sm:col-span-3 space-y-1">
                    <label className="text-[11px] font-semibold text-slate-700">ไอคอน Emoji</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={itemIcon}
                        onChange={e => setItemIcon(e.target.value)}
                        className="w-10 text-center text-sm h-8 px-1 rounded-md border border-slate-300 bg-white"
                      />
                      <div className="flex items-center gap-0.5 overflow-x-auto p-0.5 border border-slate-200 rounded-md bg-white">
                        {PRESET_ICONS.slice(0, 5).map(ico => (
                          <button
                            key={ico}
                            type="button"
                            onClick={() => setItemIcon(ico)}
                            className="w-6 h-6 text-xs flex items-center justify-center hover:bg-slate-100 rounded"
                          >
                            {ico}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="sm:col-span-3 flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={handleSaveItem}
                      className="h-8 px-3 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-2xs transition-all"
                    >
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>{isAdding ? 'ยืนยันเพิ่ม' : 'บันทึกแก้ไข'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* List of items */}
            <div className="space-y-1.5">
              {items.map((item, idx) => (
                <div
                  key={item.id}
                  className={`py-2 px-3 rounded-lg border transition-all flex items-center justify-between gap-2.5 ${
                    item.is_active
                      ? 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                      : 'bg-slate-50 border-slate-200 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-5 text-center text-[11px] font-mono font-bold text-slate-400">
                      #{idx + 1}
                    </span>
                    <span className="text-lg select-none shrink-0">{item.icon}</span>
                    <span className="font-bold text-xs text-slate-800 truncate">
                      {item.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <div className="flex items-center bg-slate-100 rounded-md border border-slate-200 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => handleMoveUp(idx)}
                        disabled={idx === 0}
                        className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-slate-900 disabled:opacity-30 hover:bg-slate-200 transition-colors"
                        title="ย้ายขึ้น"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <div className="w-[1px] h-3.5 bg-slate-200" />
                      <button
                        type="button"
                        onClick={() => handleMoveDown(idx)}
                        disabled={idx === items.length - 1}
                        className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-slate-900 disabled:opacity-30 hover:bg-slate-200 transition-colors"
                        title="ย้ายลง"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleActive(idx)}
                      className={`h-6 px-2 rounded-md text-[11px] font-semibold border transition-all ${
                        item.is_active
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}
                    >
                      {item.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleStartEdit(idx)}
                      className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 transition-all"
                      title="แก้ไข"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(idx)}
                      className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition-all"
                      title="ลบ"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Live Preview */}
            <div className="p-3 bg-slate-50/80 rounded-lg border border-slate-200 space-y-2">
              <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>ตัวอย่างปุ่มที่จะแสดงผลในฟอร์มตรวจเช็คหน้างาน ({items.filter(i => i.is_active).length} รายการที่เปิดใช้งาน):</span>
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                {items.filter(i => i.is_active).map(it => (
                  <div
                    key={it.id}
                    className="h-8 px-2.5 rounded-lg bg-white border border-emerald-200 text-emerald-950 font-semibold text-[11px] flex items-center justify-center gap-1.5 shadow-2xs truncate"
                  >
                    <Check className="w-3 h-3 stroke-[3] text-emerald-600 shrink-0" />
                    <span className="truncate">{it.icon} {it.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer Save */}
          <div className="px-3.5 py-2.5 bg-slate-50/80 border-t border-slate-200 flex items-center justify-end">
            <button
              type="button"
              onClick={handleSaveAllPpe}
              disabled={saving || loading}
              className="h-8.5 px-5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า PPE ทั้งหมด'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 2: MEAL ALLOWANCE & CATERING CONFIG (FEATURE TOGGLE)       */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'meal' && (
        <div className="w-full bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden space-y-0">
          
          {/* Header Banner */}
          <div className="px-3.5 py-3 border-b border-slate-200 bg-amber-50/50 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center shadow-xs">
                <UtensilsCrossed className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-bold text-slate-900">
                    ระบบค่าอาหาร & ข้าวกล่อง
                  </h2>
                  <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold ${
                    mealConfig.enabled
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-slate-200 text-slate-600 border border-slate-300'
                  }`}>
                    {mealConfig.enabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  จัดการยอดข้าวกล่องหน้างาน ตัดรอบประจำวัน และข้อมูลประสานงานร้านอาหาร
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <label className="flex items-center gap-1.5 cursor-pointer bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs hover:border-slate-300 transition-colors">
                <span className="text-[11px] font-bold text-slate-700">เปิดระบบ</span>
                <input
                  type="checkbox"
                  checked={mealConfig.enabled}
                  onChange={e => setMealConfig(prev => ({ ...prev, enabled: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-8 h-4.5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-amber-600" />
              </label>

              <button
                type="button"
                onClick={handleResetMealConfig}
                className="text-xs text-slate-500 hover:text-slate-800 p-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-100 transition-colors"
                title="รีเซ็ตค่าเริ่มต้น"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="p-3.5 space-y-3">
            {/* Grid 1: Rate & Cutoff Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Rate per meal */}
              <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                    อัตราค่าอาหาร (บาท / กล่อง)
                  </span>
                  <span className="text-[10px] text-slate-400">คำนวณเบิกจ่าย</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    step={5}
                    value={mealConfig.price_per_meal}
                    onChange={e => setMealConfig(prev => ({ ...prev, price_per_meal: Number(e.target.value) || 0 }))}
                    className="w-full text-xs font-bold text-slate-900 h-8 px-2.5 rounded-md border border-slate-300 bg-white focus:ring-1 focus:ring-amber-500 outline-none"
                  />
                  <span className="text-xs font-bold text-slate-500 shrink-0">บาท</span>
                </div>
              </div>

              {/* Cut-off time (Read-only display for Cron schedule) */}
              <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                    เวลาตัดรอบสรุปยอดข้าวประจำวัน
                  </span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 font-semibold border border-blue-200">
                    อัตโนมัติ (Vercel Cron)
                  </span>
                </div>
                <div className="h-8 px-3 rounded-md border border-slate-200 bg-slate-100/90 flex items-center justify-between text-xs select-none">
                  <span className="font-mono font-bold text-slate-800 text-sm">{mealConfig.cut_off_time || '14:30'} น.</span>
                  <span className="text-[11px] text-slate-500 font-medium">รอบระบบตัดยอดส่งร้านข้าว</span>
                </div>
              </div>
            </div>

            {/* Catering Shop info */}
            <div className="p-2.5 rounded-lg border border-slate-200 bg-white space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span className="flex items-center gap-1">
                  <Store className="w-3.5 h-3.5 text-orange-600" />
                  ข้อมูลร้านข้าวประจำ (สำหรับประสานงาน)
                </span>
                <span className="text-[10px] text-slate-400">สำหรับโฟร์แมนติดต่อ</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="ชื่อร้านข้าวประจำ..."
                  value={mealConfig.catering_shop_name || ''}
                  onChange={e => setMealConfig(prev => ({ ...prev, catering_shop_name: e.target.value }))}
                  className="text-xs h-8 px-2.5 rounded-md border border-slate-300 bg-slate-50/50 focus:bg-white focus:ring-1 focus:ring-amber-500 outline-none"
                />
                <input
                  type="text"
                  placeholder="เบอร์โทร / LINE ID ร้านข้าว..."
                  value={mealConfig.catering_phone || ''}
                  onChange={e => setMealConfig(prev => ({ ...prev, catering_phone: e.target.value }))}
                  className="text-xs h-8 px-2.5 rounded-md border border-slate-300 bg-slate-50/50 focus:bg-white focus:ring-1 focus:ring-amber-500 outline-none"
                />
              </div>
            </div>

            {/* Link to LINE OA page for Flex Preview & Sending */}
            <div className="p-3.5 rounded-xl border border-amber-200/80 bg-gradient-to-r from-amber-50/70 to-orange-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5 text-amber-950 font-medium">
                <span className="text-xl select-none">🍱</span>
                <div>
                  <div className="font-bold text-amber-950 text-xs">พรีวิวการ์ด LINE Flex และส่งยอดสั่งข้าวกล่องจริง</div>
                  <div className="text-[11px] text-amber-800/80">
                    ดูสรุปยอดจริง แยกตามทีม และกดส่งเข้าห้องแชท LINE OA ได้ที่หน้าจัดการ LINE
                  </div>
                </div>
              </div>
              <Link
                href="/line-oa?tab=meal"
                className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 transition-all shadow-2xs shrink-0"
              >
                <span>เปิดหน้า LINE OA</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Footer Save */}
          <div className="px-3.5 py-2.5 bg-slate-50/80 border-t border-slate-200 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">
              สถานะ: {mealConfig.enabled ? '🟢 เปิดใช้งานระบบข้าวกล่อง' : '⚪ ปิดใช้งาน'}
            </span>
            <button
              type="button"
              onClick={handleSaveMealConfig}
              disabled={savingMeal}
              className="h-8.5 px-4 rounded-lg bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savingMeal ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 3: NOTIFICATION CHANNELS & AUTOMATED SCHEDULE            */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'notification' && (
        <div className="w-full bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden space-y-0">
          {/* Header Banner */}
          <div className="px-3.5 py-3 border-b border-slate-200 bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50/50 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                <BellRing className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xs font-bold text-slate-900">
                    ตั้งค่าแจ้งเตือน LINE & สรุปผล
                  </h2>
                  <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold ${
                    notifConfig.line_enabled
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-slate-200 text-slate-600 border border-slate-300'
                  }`}>
                    {notifConfig.line_enabled ? '🟢 LINE OA: เปิด' : '⚪ LINE OA: ปิด'}
                  </span>
                  {notifConfig.schedule_enabled && (
                    <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                      ⏰ อัตโนมัติ: 3 รอบเวลา
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  เชื่อมต่อ Messaging API เพื่อส่งรายงานสรุปผลการตรวจไซต์งานเข้ากลุ่มหรือบัญชีทางการ
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <Link
                href="/line-oa"
                className="text-[11px] text-emerald-800 hover:text-emerald-950 px-2.5 py-1 rounded-md border border-emerald-300 bg-emerald-100/70 hover:bg-emerald-200/80 flex items-center gap-1 transition-all font-bold"
                title="ไปหน้าส่งรายงานสรุปผลประจำวัน"
              >
                <MessageSquare className="w-3 h-3" />
                <span>ไปหน้ารายงาน LINE OA</span>
                <ExternalLink className="w-2.5 h-2.5 text-emerald-700" />
              </Link>

              <button
                type="button"
                onClick={handleResetNotifConfig}
                className="text-[11px] text-slate-600 hover:text-slate-900 px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 flex items-center gap-1 transition-all"
              >
                <RotateCcw className="w-3 h-3 text-slate-500" />
                <span>รีเซ็ตค่าเริ่มต้น</span>
              </button>
            </div>
          </div>

          <div className="p-3.5 space-y-3">
            
            {/* Live Connection Status Banner */}
            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200/80">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                    <Wifi className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <span>สถานะการเชื่อมต่อ (Live Connection Status)</span>
                      {connectionStatus.line.connected && (
                        <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          พร้อมส่งข้อความ
                        </span>
                      )}
                    </span>
                    <span className="block text-[10px] text-slate-500">
                      ตรวจสอบความถูกต้องของ Channel Access Token และเป้าหมายปลายทาง
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {connectionStatus.checkedAt && (
                    <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                      ตรวจสอบล่าสุด: {connectionStatus.checkedAt}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => checkConnection(true)}
                    disabled={connectionStatus.loading}
                    className="h-7 px-2.5 rounded-md border border-slate-300 bg-white hover:bg-slate-100 active:scale-95 text-slate-700 text-[11px] font-bold flex items-center gap-1 transition-all shadow-2xs disabled:opacity-50"
                  >
                    <RefreshCcw className={`w-3 h-3 text-emerald-600 ${connectionStatus.loading ? 'animate-spin' : ''}`} />
                    <span>{connectionStatus.loading ? 'กำลังตรวจสอบ...' : 'ตรวจสอบการเชื่อมต่อ'}</span>
                  </button>
                </div>
              </div>

              {/* Status Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {/* LINE OA Connection Card */}
                <div className={`p-2.5 rounded-lg border transition-all ${
                  connectionStatus.line.connected
                    ? 'bg-emerald-50/60 border-emerald-300 ring-1 ring-emerald-200/50'
                    : connectionStatus.line.configured
                    ? 'bg-rose-50/60 border-rose-300 ring-1 ring-rose-200/50'
                    : 'bg-white border-slate-200'
                }`}>
                  <div className="flex items-start gap-2.5">
                    {connectionStatus.line.bot?.pictureUrl ? (
                      <img
                        src={connectionStatus.line.bot.pictureUrl}
                        alt="LINE Bot"
                        className="w-9 h-9 rounded-full border border-emerald-400 object-cover shrink-0 shadow-2xs"
                      />
                    ) : (
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                        connectionStatus.line.connected
                          ? 'bg-emerald-600 text-white'
                          : connectionStatus.line.configured
                          ? 'bg-rose-500 text-white'
                          : 'bg-slate-200 text-slate-500'
                      }`}>
                        {connectionStatus.line.connected ? 'LINE' : connectionStatus.line.configured ? '!' : 'OFF'}
                      </div>
                    )}

                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center justify-between gap-1 flex-wrap">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {connectionStatus.line.connected
                            ? connectionStatus.line.bot?.displayName || 'LINE Official Account'
                            : 'LINE Official Account'}
                        </span>
                        {connectionStatus.line.connected ? (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-0.5">
                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" /> เชื่อมต่อถูกต้อง
                          </span>
                        ) : connectionStatus.line.configured ? (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-0.5">
                            <AlertCircle className="w-2.5 h-2.5 text-rose-600" /> เชื่อมต่อไม่สำเร็จ
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            ยังไม่ได้ระบุ Token
                          </span>
                        )}
                      </div>

                      {connectionStatus.line.connected ? (
                        <div className="text-[11px] space-y-0.5">
                          <p className="text-slate-600 flex items-center gap-1 font-mono text-[10px]">
                            <span>ID:</span>
                            <span className="font-bold text-emerald-800 bg-emerald-100/70 px-1 rounded">
                              {connectionStatus.line.bot?.basicId}
                            </span>
                          </p>

                          {/* Target Status */}
                          <div className="pt-0.5 text-[10px]">
                            {notifConfig.line_broadcast ? (
                              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                                <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                                โหมด Broadcast: ส่งหาผู้ติดตามทุกคนใน LINE OA ✅
                              </span>
                            ) : connectionStatus.line.targetValid ? (
                              <span className="text-emerald-700 font-semibold flex items-center gap-1 truncate">
                                <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                                ปลายทาง: {connectionStatus.line.targetType === 'group' ? 'Group ID' : 'User ID'} ({notifConfig.line_target_id.slice(0, 10)}...{notifConfig.line_target_id.slice(-4)}) รูปแบบถูกต้อง ✅
                              </span>
                            ) : notifConfig.line_target_id.trim() ? (
                              <span className="text-amber-700 font-semibold flex items-center gap-1">
                                <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                                Target ID ไม่ถูกต้อง (ควรขึ้นต้นด้วย C... หรือ U...)
                              </span>
                            ) : (
                              <span className="text-amber-700 font-semibold flex items-center gap-1">
                                <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                                ยังไม่ได้ระบุ Target ID (แนะนำเปิด Broadcast หรือใส่ Group ID)
                              </span>
                            )}
                          </div>

                          {/* Quota & Usage Stats */}
                          {connectionStatus.line.quota && (
                            <div className="mt-2 pt-2 border-t border-emerald-200/80 space-y-1.5">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-bold text-slate-800 flex items-center gap-1">
                                  <span>โควต้าข้อความเดือนนี้:</span>
                                  {connectionStatus.line.quota.type === 'limited' ? (
                                    <span className="text-emerald-800 font-extrabold">
                                      {connectionStatus.line.quota.remaining?.toLocaleString()} / {connectionStatus.line.quota.total?.toLocaleString()} ข้อความ
                                    </span>
                                  ) : (
                                    <span className="text-emerald-800 font-bold">ไม่จำกัด (Unlimited)</span>
                                  )}
                                </span>

                                {connectionStatus.line.quota.percentRemaining !== null && (
                                  <span className={`px-1.5 py-0.2 rounded font-bold text-[10px] ${
                                    connectionStatus.line.quota.percentRemaining > 25
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                      : connectionStatus.line.quota.percentRemaining > 10
                                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                      : 'bg-rose-100 text-rose-800 border border-rose-300'
                                  }`}>
                                    เหลือ {connectionStatus.line.quota.percentRemaining}%
                                  </span>
                                )}
                              </div>

                              {connectionStatus.line.quota.type === 'limited' && connectionStatus.line.quota.total && (
                                <div className="space-y-1">
                                  <div className="w-full bg-slate-200/90 rounded-full h-2 overflow-hidden shadow-inner">
                                    <div
                                      className={`h-2 rounded-full transition-all duration-500 ${
                                        (connectionStatus.line.quota.percentRemaining ?? 100) > 25
                                          ? 'bg-emerald-500'
                                          : (connectionStatus.line.quota.percentRemaining ?? 100) > 10
                                          ? 'bg-amber-500'
                                          : 'bg-rose-500'
                                      }`}
                                      style={{ width: `${Math.min(100, Math.max(0, connectionStatus.line.quota.percentRemaining ?? 0))}%` }}
                                    />
                                  </div>

                                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                                    <span>ใช้ไปแล้ว: <strong className="text-slate-800 font-semibold">{connectionStatus.line.quota.used?.toLocaleString()}</strong> ข้อความ</span>
                                    <span>คงเหลือ: <strong className="text-emerald-700 font-bold">{connectionStatus.line.quota.remaining?.toLocaleString()}</strong> ข้อความ</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : connectionStatus.line.configured ? (
                        <p className="text-[10px] text-rose-600 leading-snug">
                          {connectionStatus.line.error || 'Token ไม่ถูกต้องหรือหมดอายุ'}
                        </p>
                      ) : (
                        <p className="text-[10px] text-slate-400">
                          กรุณากรอก Channel Access Token ด้านล่างแล้วกดบันทึก
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Telegram Connection Card */}
                <div className={`p-2.5 rounded-lg border transition-all ${
                  notifConfig.telegram_enabled && connectionStatus.telegram.connected
                    ? 'bg-sky-50/60 border-sky-300 ring-1 ring-sky-200/50'
                    : notifConfig.telegram_enabled && connectionStatus.telegram.configured
                    ? 'bg-rose-50/60 border-rose-300 ring-1 ring-rose-200/50'
                    : 'bg-white border-slate-200'
                }`}>
                  <div className="flex items-start gap-2.5">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                      notifConfig.telegram_enabled && connectionStatus.telegram.connected
                        ? 'bg-sky-500 text-white'
                        : notifConfig.telegram_enabled && connectionStatus.telegram.configured
                        ? 'bg-rose-500 text-white'
                        : 'bg-slate-200 text-slate-500'
                    }`}>
                      <SendHorizontal className="w-4 h-4" />
                    </div>

                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center justify-between gap-1 flex-wrap">
                        <span className="text-xs font-bold text-slate-900 truncate">Telegram (Bot API)</span>
                        {notifConfig.telegram_enabled && connectionStatus.telegram.connected ? (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-300 flex items-center gap-0.5">
                            <CheckCircle2 className="w-2.5 h-2.5 text-sky-600" /> เชื่อมต่อถูกต้อง
                          </span>
                        ) : notifConfig.telegram_enabled && connectionStatus.telegram.configured ? (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-0.5">
                            <AlertCircle className="w-2.5 h-2.5 text-rose-600" /> เชื่อมต่อไม่สำเร็จ
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            {notifConfig.telegram_enabled ? 'ยังไม่ระบุ Token' : 'ปิดใช้งาน'}
                          </span>
                        )}
                      </div>

                      {notifConfig.telegram_enabled && connectionStatus.telegram.connected ? (
                        <div className="text-[11px] space-y-0.5">
                          <p className="text-slate-600 font-mono text-[10px]">
                            Bot: @{connectionStatus.telegram.bot?.username} ({connectionStatus.telegram.bot?.first_name})
                          </p>
                          <p className="text-[10px] text-sky-700 font-medium">
                            Chat ID: {notifConfig.telegram_chat_id || 'ยังไม่ได้ระบุ'}
                          </p>
                        </div>
                      ) : notifConfig.telegram_enabled && connectionStatus.telegram.configured ? (
                        <p className="text-[10px] text-rose-600 leading-snug">
                          {connectionStatus.telegram.error || 'Bot Token ไม่ถูกต้อง'}
                        </p>
                      ) : (
                        <p className="text-[10px] text-slate-400">
                          {notifConfig.telegram_enabled ? 'กรุณากรอก Bot Token และ Chat ID' : 'ระบบแจ้งเตือนหลักทำงานผ่าน LINE OA'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* 1. LINE Official Account Configuration */}
            <div className={`p-3 rounded-lg border transition-all ${
              notifConfig.line_enabled
                ? 'bg-emerald-50/30 border-emerald-200 shadow-2xs'
                : 'bg-slate-50 border-slate-200 opacity-75'
            }`}>
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-emerald-600 text-white flex items-center justify-center font-bold text-[10px] shadow-2xs">
                    LINE
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 text-xs">LINE Official Account (Messaging API)</span>
                    <span className="block text-[10px] text-slate-500">รองรับ Flex Carousel Message สรุปผลแยกตามสังกัด/บริษัท</span>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={notifConfig.line_enabled}
                    onChange={e => setNotifConfig(prev => ({ ...prev, line_enabled: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4.5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-emerald-600" />
                </label>
              </div>

              {notifConfig.line_enabled && (
                <div className="mt-2.5 space-y-2.5">
                  {/* Channel Access Token */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-800">
                        Channel Access Token (Long-lived)
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowToken(!showToken)}
                        className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1"
                      >
                        {showToken ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        <span>{showToken ? 'ซ่อน' : 'แสดง'} Token</span>
                      </button>
                    </div>
                    <input
                      type={showToken ? 'text' : 'password'}
                      value={notifConfig.line_channel_access_token}
                      onChange={e => setNotifConfig(prev => ({ ...prev, line_channel_access_token: e.target.value }))}
                      placeholder="eyJhbGciOiJIUzI1Ni..."
                      className="w-full text-xs font-mono h-8 px-2.5 rounded-md border border-slate-300 bg-white focus:ring-1 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  {/* Target User / Group ID & LIFF ID in 2-Column Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Target User / Group ID */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-slate-800">
                          เป้าหมายปลายทาง (Target ID)
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          <input
                            type="checkbox"
                            checked={notifConfig.line_broadcast}
                            onChange={e => setNotifConfig(prev => ({ ...prev, line_broadcast: e.target.checked }))}
                            className="rounded text-emerald-600 focus:ring-emerald-500 w-3 h-3"
                          />
                          <span>Broadcast</span>
                        </label>
                      </div>

                      <input
                        type="text"
                        disabled={notifConfig.line_broadcast}
                        value={notifConfig.line_target_id}
                        onChange={e => setNotifConfig(prev => ({ ...prev, line_target_id: e.target.value }))}
                        placeholder={notifConfig.line_broadcast ? 'โหมด Broadcast (ส่งหาทุกคน)' : 'เช่น C64ba... หรือ U...'}
                        className="w-full text-xs font-mono h-8 px-2.5 rounded-md border border-slate-300 bg-white disabled:bg-slate-100 disabled:text-slate-400 outline-none focus:ring-1 focus:ring-emerald-500"
                      />

                      {notifConfig.line_broadcast ? (
                        <p className="text-[10px] text-emerald-700 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                          โหมด Broadcast ส่งหาทุกคนที่แอดไลน์
                        </p>
                      ) : notifConfig.line_target_id.trim() ? (
                        /^[UCR][0-9a-zA-Z]{32}$/.test(notifConfig.line_target_id.trim()) ? (
                          <p className="text-[10px] text-emerald-700 font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                            รูปแบบ ID ถูกต้อง ({notifConfig.line_target_id.startsWith('U') ? 'User ID' : notifConfig.line_target_id.startsWith('C') ? 'Group ID' : 'Room ID'})
                          </p>
                        ) : (
                          <p className="text-[10px] text-amber-700 font-medium flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                            ID ควรขึ้นต้นด้วย U... หรือ C... 33 ตัวอักษร
                          </p>
                        )
                      ) : null}
                    </div>

                    {/* LINE LIFF ID */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-800 block">
                        LINE LIFF ID (สำหรับเข้าแอปใน LINE)
                      </label>
                      <input
                        type="text"
                        value={notifConfig.line_liff_id || ''}
                        onChange={e => setNotifConfig(prev => ({ ...prev, line_liff_id: e.target.value }))}
                        placeholder="เช่น 2011207773-wQcogTd7"
                        className="w-full text-xs font-mono h-8 px-2.5 rounded-md border border-slate-300 bg-white focus:ring-1 focus:ring-emerald-500 outline-none"
                      />
                      <span className="text-[10px] text-slate-400 block truncate">
                        Endpoint: <code>https://โดเมน/checklist-m</code>
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Telegram Bot API Configuration */}
            <div className={`p-3 rounded-lg border transition-all ${
              notifConfig.telegram_enabled
                ? 'bg-sky-50/30 border-sky-200 shadow-2xs'
                : 'bg-slate-50 border-slate-200 opacity-75'
            }`}>
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-sky-500 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                    <SendHorizontal className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 text-xs">Telegram (Bot API)</span>
                    <span className="block text-[10px] text-slate-500">ส่งข้อความสรุปผลเข้ากลุ่ม Telegram หรือแชทส่วนตัว</span>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={notifConfig.telegram_enabled}
                    onChange={e => setNotifConfig(prev => ({ ...prev, telegram_enabled: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4.5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-sky-500" />
                </label>
              </div>

              {notifConfig.telegram_enabled && (
                <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-800">Telegram Bot Token</label>
                      <button
                        type="button"
                        onClick={() => setShowTgToken(!showTgToken)}
                        className="text-[10px] text-slate-500 hover:text-slate-800 flex items-center gap-0.5"
                      >
                        {showTgToken ? <EyeOff className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
                        <span>{showTgToken ? 'ซ่อน' : 'แสดง'}</span>
                      </button>
                    </div>
                    <input
                      type={showTgToken ? 'text' : 'password'}
                      value={notifConfig.telegram_bot_token}
                      onChange={e => setNotifConfig(prev => ({ ...prev, telegram_bot_token: e.target.value }))}
                      placeholder="เช่น 123456:ABC..."
                      className="w-full text-xs font-mono h-8 px-2.5 rounded-md border border-slate-300 bg-white focus:ring-1 focus:ring-sky-500 outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-800 block">Chat ID / Group ID</label>
                    <input
                      type="text"
                      value={notifConfig.telegram_chat_id}
                      onChange={e => setNotifConfig(prev => ({ ...prev, telegram_chat_id: e.target.value }))}
                      placeholder="เช่น -100123456789"
                      className="w-full text-xs font-mono h-8 px-2.5 rounded-md border border-slate-300 bg-white focus:ring-1 focus:ring-sky-500 outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 3. Automated Schedule Configuration */}
            <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                    <Timer className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 text-xs">รอบเวลาส่งสรุปผลประจำวันอัตโนมัติ (Automated Schedule)</span>
                    <span className="block text-[10px] text-slate-500">รวบรวมข้อมูลและส่งสรุปผลอัตโนมัติตามช่วงเวลา</span>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={notifConfig.schedule_enabled}
                    onChange={e => setNotifConfig(prev => ({ ...prev, schedule_enabled: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4.5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-blue-600" />
                </label>
              </div>

              {/* Schedule Mode: Flex vs Text */}
              <div className="p-2 rounded-md bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-slate-700">รูปแบบข้อความ:</span>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-700">
                    <input
                      type="radio"
                      name="schedule_mode_tab"
                      checked={notifConfig.schedule_mode === 'flex'}
                      onChange={() => setNotifConfig(prev => ({ ...prev, schedule_mode: 'flex' }))}
                      className="text-blue-600"
                    />
                    <span>LINE Flex Carousel (แยกตามบริษัท)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-700">
                    <input
                      type="radio"
                      name="schedule_mode_tab"
                      checked={notifConfig.schedule_mode === 'text'}
                      onChange={() => setNotifConfig(prev => ({ ...prev, schedule_mode: 'text' }))}
                      className="text-blue-600"
                    />
                    <span>ข้อความธรรมดา (Text)</span>
                  </label>
                </div>
              </div>

              {/* Vercel Cron 3 Rounds Cards & Verification */}
              <div className="space-y-2.5 pt-1">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-slate-800">
                      ⚡ กำหนดรอบเวลาอัตโนมัติคงที่ 3 รอบ (ผ่าน Vercel Cron):
                    </span>
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-0.5">
                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" /> vercel.json: ถูกต้องสมบูรณ์ (3/3)
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">เวลาประเทศไทย (GMT+7 = UTC+7)</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  {VERCEL_CRON_ROUNDS.map((r, idx) => {
                    const utcCron = r.slot === '08:50' ? '50 1 * * *' : r.slot === '10:30' ? '30 3 * * *' : '30 7 * * *'
                    const endpointPath = r.slot === '14:30' ? '/api/line/meal-cron' : `/api/line/cron?slot=${r.slot}`
                    const isTriggering = triggeringSlot === r.slot

                    return (
                      <div
                        key={r.slot}
                        className={`p-3 rounded-lg border flex flex-col justify-between transition-all ${
                          r.focusMeal
                            ? 'bg-amber-50/40 border-amber-300 ring-1 ring-amber-200'
                            : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                        }`}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold text-white shadow-2xs"
                              style={{ backgroundColor: r.bgColor }}
                            >
                              <span>{r.icon}</span>
                              <span>{r.slot} น.</span>
                            </span>
                            <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded">
                              รอบที่ {idx + 1}
                            </span>
                          </div>

                          <div className="pt-0.5">
                            <h4 className="text-xs font-bold text-slate-900 leading-snug">
                              {r.name}
                            </h4>
                            <p className="text-[10px] text-slate-500 leading-relaxed mt-0.5">
                              {r.description}
                            </p>
                          </div>

                          {/* Technical Cron Details */}
                          <div className="p-1.5 rounded bg-slate-50 border border-slate-200/80 text-[10px] font-mono space-y-0.5">
                            <div className="flex items-center justify-between text-slate-600">
                              <span>UTC Cron:</span>
                              <strong className="text-slate-800">{utcCron}</strong>
                            </div>
                            <div className="flex items-center justify-between text-slate-500 truncate" title={endpointPath}>
                              <span>Endpoint:</span>
                              <span className="truncate max-w-[120px] text-slate-700">{endpointPath}</span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
                          <span className="font-sans font-semibold text-emerald-600 text-[10px] flex items-center gap-0.5">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" /> พร้อมทำงาน
                          </span>

                          <button
                            type="button"
                            onClick={() => handleTriggerCronSlot(r.slot)}
                            disabled={isTriggering}
                            className="h-6.5 px-2 rounded border border-slate-300 bg-white hover:bg-slate-100 active:scale-95 text-slate-700 text-[10px] font-bold flex items-center gap-1 transition-all shadow-2xs disabled:opacity-50"
                            title={`ทดสอบเรียก Endpoint รอบ ${r.slot} น.`}
                          >
                            {isTriggering ? (
                              <Loader2 className="w-2.5 h-2.5 animate-spin text-blue-600" />
                            ) : (
                              <Send className="w-2.5 h-2.5 text-blue-600" />
                            )}
                            <span>{isTriggering ? 'กำลังยิง...' : 'ทดสอบยิงรอบนี้'}</span>
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Vercel Cron Verification & Guide Banner */}
                <div className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/50 flex items-start gap-2 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="space-y-1 flex-1 text-[11px] leading-relaxed text-slate-700">
                    <p className="font-bold text-emerald-950 flex items-center gap-1.5 flex-wrap">
                      <span>การตั้งค่า Vercel Cron ในไฟล์ vercel.json ถูกต้องสมบูรณ์ 100%</span>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-200 text-emerald-900 font-mono">
                        3 Jobs Configured
                      </span>
                    </p>
                    <ul className="text-[10px] text-slate-600 space-y-0.5 list-disc list-inside">
                      <li>
                        <strong>รอบ 08:50 น. (เช้า):</strong> ตั้งค่า <code>50 1 * * *</code> (01:50 UTC) เรียก <code>/api/line/cron?slot=08:50</code>
                      </li>
                      <li>
                        <strong>รอบ 10:30 น. (สาย):</strong> ตั้งค่า <code>30 3 * * *</code> (03:30 UTC) เรียก <code>/api/line/cron?slot=10:30</code>
                      </li>
                      <li>
                        <strong>รอบ 14:30 น. (ข้าวกล่อง):</strong> ตั้งค่า <code>30 7 * * *</code> (07:30 UTC) เรียก <code>/api/line/meal-cron</code>
                      </li>
                    </ul>
                    <p className="text-[10px] text-emerald-800 pt-0.5">
                      💡 <strong>เมื่อ Deploy ขึ้น Vercel:</strong> ตรวจสอบได้ทันทีที่ Vercel Dashboard ➔ เลือกโปรเจกต์ ➔ แท็บ <strong>Settings</strong> ➔ เมนู <strong>Cron Jobs</strong> จะขึ้นสถานะ Active ทั้ง 3 รอบครับ
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Notification Logs History */}
            <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-purple-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                    <History className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <span>ประวัติการส่งการแจ้งเตือน (Notification Logs)</span>
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                        {notifLogs.length} รายการ
                      </span>
                    </span>
                    <span className="block text-[10px] text-slate-500">
                      บันทึกประวัติการส่งข้อความสรุปผลและข้อความทดสอบ ว่าส่งเมื่อไหร่ สำเร็จหรือไม่
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={fetchLogs}
                    disabled={loadingLogs}
                    className="h-7 px-2.5 rounded-md border border-slate-300 bg-white hover:bg-slate-100 active:scale-95 text-slate-700 text-[11px] font-medium flex items-center gap-1 transition-all shadow-2xs disabled:opacity-50"
                  >
                    <RefreshCcw className={`w-3 h-3 text-purple-600 ${loadingLogs ? 'animate-spin' : ''}`} />
                    <span>รีเฟรช Log</span>
                  </button>

                  {notifLogs.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearLogs}
                      disabled={clearingLogs}
                      className="h-7 px-2 rounded-md border border-rose-200 bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 text-[11px] font-medium flex items-center gap-1 transition-all shadow-2xs disabled:opacity-50"
                    >
                      <Trash2 className="w-3 h-3 text-rose-500" />
                      <span>ล้างประวัติ</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Log List */}
              {loadingLogs && notifLogs.length === 0 ? (
                <div className="py-6 flex flex-col items-center justify-center text-slate-400 gap-1.5">
                  <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
                  <span className="text-xs">กำลังโหลดประวัติการแจ้งเตือน...</span>
                </div>
              ) : notifLogs.length === 0 ? (
                <div className="py-6 text-center border border-dashed border-slate-200 rounded-lg bg-slate-50/50 space-y-1">
                  <BellRing className="w-6 h-6 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">ยังไม่มีประวัติการส่งการแจ้งเตือน</p>
                  <p className="text-[10px] text-slate-400">
                    เมื่อกดปุ่ม "ทดสอบส่งข้อความ" ด้านล่าง หรือรอบเวลาอัตโนมัติทำงาน ประวัติจะถูกบันทึกและแสดงที่นี่
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {notifLogs.map((log) => (
                    <div
                      key={log.id}
                      className={`p-2.5 rounded-lg border text-xs transition-all ${
                        log.success
                          ? 'bg-slate-50/50 hover:bg-slate-50 border-slate-200'
                          : 'bg-rose-50/30 hover:bg-rose-50/60 border-rose-200'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* Status Badge */}
                          {log.success ? (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-0.5">
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" /> สำเร็จ
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-0.5">
                              <AlertCircle className="w-2.5 h-2.5 text-rose-600" /> ล้มเหลว
                            </span>
                          )}

                          {/* Channel Badge */}
                          {log.channel === 'line' || log.channel === 'all' ? (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-600 text-white">
                              LINE OA
                            </span>
                          ) : null}
                          {log.channel === 'telegram' || log.channel === 'all' ? (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-sky-500 text-white">
                              Telegram
                            </span>
                          ) : null}

                          <span className="font-bold text-slate-900 text-xs">{log.title}</span>
                        </div>

                        {/* Timestamp */}
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{log.formatted_time}</span>
                        </div>
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1 text-[11px] text-slate-500">
                        <span className="truncate">
                          ปลายทาง: <code className="bg-slate-100 px-1 py-0.2 rounded font-mono text-[10px] text-slate-700">{log.target}</code>
                        </span>
                        {log.status_code && (
                          <span className="text-[10px] font-mono text-slate-400">
                            HTTP {log.status_code}
                          </span>
                        )}
                      </div>

                      {log.error ? (
                        <div className="mt-1.5 text-[10px] text-rose-700 bg-rose-50 px-2 py-1 rounded border border-rose-200 font-mono leading-relaxed">
                          <span className="font-bold">Error:</span> {log.error}
                        </div>
                      ) : log.message && !log.message.includes('เรียบร้อย') ? (
                        <p className="mt-1 text-[10px] text-slate-600 font-mono">
                          {log.message}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Footer Action Bar */}
          <div className="px-3.5 py-2.5 bg-slate-50/80 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
            <button
              type="button"
              onClick={handleTestNotifConnection}
              disabled={testingNotif}
              className="h-8.5 px-3.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs disabled:opacity-50"
            >
              {testingNotif ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
              ) : (
                <Send className="w-3.5 h-3.5 text-blue-600" />
              )}
              <span>{testingNotif ? 'กำลังทดสอบ...' : 'ทดสอบส่งข้อความ (Test)'}</span>
            </button>

            <button
              type="button"
              onClick={handleSaveNotifConfig}
              disabled={savingNotif}
              className="h-8.5 px-5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savingNotif ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่าการแจ้งเตือน'}</span>
            </button>
          </div>
        </div>
      )}

      </div>
    </div>
  )
}
