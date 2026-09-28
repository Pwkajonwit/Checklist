'use client'

import React, { useState, useEffect } from 'react'
import {
  Sliders, Plus, Trash2, Edit2, Check, ArrowUp, ArrowDown,
  RotateCcw, Save, ShieldCheck, Sparkles, RefreshCw, Layers,
  UtensilsCrossed, Clock, DollarSign, Store, Phone,
  MessageSquare, Info, CheckCircle2, XCircle, AlertCircle
} from 'lucide-react'
import {
  ChecklistPpeItem,
  DEFAULT_CHECKLIST_PPE_ITEMS,
  MealConfig,
  DEFAULT_MEAL_CONFIG,
} from '@/lib/types'
import { toast } from 'sonner'

const PRESET_ICONS = [
  '⛑️', '🦺', '🥽', '🧤', '👢', '🎧', '😷', '🧗', '🛡️', '🧯', '🔦', '🦻', '👓'
]

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'ppe' | 'meal'>('ppe')

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

  useEffect(() => {
    loadSettings()
    loadMealSettings()
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

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-12">
      {/* Page Title & Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Sliders className="w-5 h-5 text-blue-600" />
            <span>การตั้งค่าระบบ (System Settings)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            ปรับแต่งรายการตรวจเช็คความปลอดภัย และระบบเสริมของโครงการ
          </p>
        </div>

        {/* Section Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-200/80 rounded-xl border border-slate-300 shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveTab('ppe')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === 'ppe'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
            <span>รายการตรวจ PPE</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 text-blue-800 font-mono">
              {items.filter(i => i.is_active).length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('meal')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === 'meal'
                ? 'bg-white text-amber-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UtensilsCrossed className="w-3.5 h-3.5 text-amber-600" />
            <span>ระบบค่าอาหาร & ข้าวกล่อง</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
              mealConfig.enabled
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                : 'bg-slate-200 text-slate-500'
            }`}>
              {mealConfig.enabled ? 'เปิดใช้' : 'ปิด'}
            </span>
          </button>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 1: PPE ITEMS CONFIGURATION                                 */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'ppe' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-bold text-slate-900">รายการอุปกรณ์ความปลอดภัย (PPE Items)</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                เปิดใช้ {items.filter(i => i.is_active).length} / {items.length} รายการ
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetDefaults}
                className="text-xs text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 flex items-center gap-1.5 transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>รีเซ็ต 5 รายการเดิม</span>
              </button>

              {!isAdding && editingIndex === null && (
                <button
                  type="button"
                  onClick={handleStartAdd}
                  className="text-xs font-bold text-white px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1.5 shadow-2xs transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>เพิ่มรายการใหม่</span>
                </button>
              )}
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* Add / Edit Form Card */}
            {(isAdding || editingIndex !== null) && (
              <div className="p-4 bg-emerald-50/80 border border-emerald-300 rounded-xl space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center justify-between text-sm font-bold text-emerald-950">
                  <span>{isAdding ? '➕ เพิ่มรายการอุปกรณ์ใหม่' : '✏️ แก้ไขรายการอุปกรณ์'}</span>
                  <button
                    type="button"
                    onClick={handleCancelForm}
                    className="text-xs text-slate-500 hover:text-slate-800"
                  >
                    ยกเลิก
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                  <div className="sm:col-span-6 space-y-1">
                    <label className="text-xs font-semibold text-slate-700">ชื่ออุปกรณ์</label>
                    <input
                      type="text"
                      value={itemLabel}
                      onChange={e => setItemLabel(e.target.value)}
                      placeholder="เช่น แว่นตาเซฟตี้, เข็มขัดกันตก..."
                      className="w-full text-xs h-9 px-3 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      autoFocus
                    />
                  </div>

                  <div className="sm:col-span-3 space-y-1">
                    <label className="text-xs font-semibold text-slate-700">ไอคอน Emoji</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={itemIcon}
                        onChange={e => setItemIcon(e.target.value)}
                        className="w-12 text-center text-sm h-9 px-1 rounded-lg border border-slate-300 bg-white"
                      />
                      <div className="flex items-center gap-0.5 overflow-x-auto max-w-[130px] p-0.5 border border-slate-200 rounded-lg bg-white">
                        {PRESET_ICONS.slice(0, 5).map(ico => (
                          <button
                            key={ico}
                            type="button"
                            onClick={() => setItemIcon(ico)}
                            className="w-6 h-7 text-xs flex items-center justify-center hover:bg-slate-100 rounded"
                          >
                            {ico}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="sm:col-span-3 pt-4 sm:pt-0 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleSaveItem}
                      className="h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>{isAdding ? 'ยืนยันเพิ่ม' : 'บันทึกแก้ไข'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* List of items */}
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div
                  key={item.id}
                  className={`p-3 rounded-xl border transition-all flex flex-wrap items-center justify-between gap-3 ${
                    item.is_active
                      ? 'bg-white border-slate-300 hover:border-slate-400 shadow-2xs'
                      : 'bg-slate-100/70 border-slate-200 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 text-center text-xs font-mono font-bold text-slate-400">
                      #{idx + 1}
                    </span>
                    <span className="text-xl select-none">{item.icon}</span>
                    <div className="min-w-0">
                      <span className="font-bold text-xs text-slate-900 block truncate">
                        {item.label}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center bg-slate-100 rounded-lg border border-slate-200 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => handleMoveUp(idx)}
                        disabled={idx === 0}
                        className="w-7 h-7 flex items-center justify-center text-slate-600 hover:text-slate-950 disabled:opacity-30 hover:bg-slate-200 transition-colors"
                        title="ย้ายขึ้น"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <div className="w-[1px] h-4 bg-slate-200" />
                      <button
                        type="button"
                        onClick={() => handleMoveDown(idx)}
                        disabled={idx === items.length - 1}
                        className="w-7 h-7 flex items-center justify-center text-slate-600 hover:text-slate-950 disabled:opacity-30 hover:bg-slate-200 transition-colors"
                        title="ย้ายลง"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleActive(idx)}
                      className={`h-7 px-2.5 rounded-lg text-xs font-semibold border transition-all ${
                        item.is_active
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-slate-200 text-slate-600 border-slate-300'
                      }`}
                    >
                      {item.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleStartEdit(idx)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 transition-all"
                      title="แก้ไข"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(idx)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition-all"
                      title="ลบ"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Live Preview */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>ตัวอย่างปุ่มที่จะแสดงผลในฟอร์มตรวจเช็คหน้างาน ({items.filter(i => i.is_active).length} รายการที่เปิดใช้งาน):</span>
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {items.filter(i => i.is_active).map(it => (
                  <div
                    key={it.id}
                    className="h-10 px-3 rounded-xl bg-white border border-emerald-300 text-emerald-950 font-semibold text-xs flex items-center justify-center gap-1.5 shadow-2xs"
                  >
                    <Check className="w-4 h-4 stroke-[3] text-emerald-600" />
                    <span>{it.icon} {it.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
            <button
              type="button"
              onClick={handleSaveAllPpe}
              disabled={saving || loading}
              className="h-10 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-sm disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า PPE ทั้งหมด'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 2: MEAL ALLOWANCE & CATERING CONFIG (FEATURE TOGGLE)       */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'meal' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden space-y-0">
          
          {/* Header Banner */}
          <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-amber-50 to-orange-50 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
                <UtensilsCrossed className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-900">
                    ระบบเบิกค่าอาหารและข้าวกล่อง (Meal Allowance & Catering)
                  </h2>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    mealConfig.enabled
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-slate-200 text-slate-600 border border-slate-300'
                  }`}>
                    {mealConfig.enabled ? '🟢 เปิดใช้งานแล้ว' : '⚪ ปิดใช้งาน (ซ่อนจากทุกหน้าจอ)'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  ระบบ Feature Toggle: เมื่อปิดไว้ จะไม่มีฟังก์ชันค่าอาหารแสดงผลบนหน้าจอ Checklist หรือ Dashboard
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleResetMealConfig}
              className="text-xs text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 flex items-center gap-1.5 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>รีเซ็ตค่าเริ่มต้น</span>
            </button>
          </div>

          <div className="p-5 space-y-6">
            
            {/* 1. Master Toggle Switch */}
            <div className={`p-4 rounded-xl border transition-all ${
              mealConfig.enabled
                ? 'bg-amber-50/60 border-amber-300'
                : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-sm font-bold text-slate-900 block">
                    สวิตช์เปิด-ปิดระบบค่าอาหาร (Master Feature Toggle)
                  </span>
                  <p className="text-xs text-slate-500">
                    {mealConfig.enabled
                      ? 'ระบบเปิดทำงาน: ช่องติ๊กค่าอาหารใน Checklist และการ์ดสรุปยอดสั่งข้าวใน Dashboard จะปรากฏขึ้น'
                      : 'ระบบปิดอยู่: ทุกส่วนเกี่ยวกับค่าอาหารจะถูกซ่อนไว้ ไม่เกะกะสายตาการทำงานปัจจุบัน'}
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={mealConfig.enabled}
                    onChange={e => setMealConfig(prev => ({ ...prev, enabled: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-13 h-7 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[3px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-amber-600" />
                </label>
              </div>
            </div>

            {/* 2. Configuration Parameters (Disabled visual if toggle is off) */}
            <div className={`space-y-5 transition-opacity ${mealConfig.enabled ? 'opacity-100' : 'opacity-70'}`}>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Rate per meal */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    <span>อัตราค่าอาหารปกติ (ต่อคน / มื้อ)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      step={5}
                      value={mealConfig.price_per_meal}
                      onChange={e => setMealConfig(prev => ({ ...prev, price_per_meal: Number(e.target.value) || 0 }))}
                      className="w-full text-sm font-bold text-slate-900 h-10 px-3 rounded-lg border border-slate-300 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-amber-500 outline-none"
                    />
                    <span className="text-xs font-bold text-slate-500 shrink-0">บาท / กล่อง</span>
                  </div>
                  <span className="text-[11px] text-slate-400 block">
                    ใช้คำนวณยอดเงินรวมและเบิกจ่ายประจำงวด
                  </span>
                </div>

                {/* Cut-off time */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <span>เวลาตัดรอบสรุปยอดสั่งข้าวประจำวัน</span>
                  </div>
                  <input
                    type="time"
                    value={mealConfig.cut_off_time}
                    onChange={e => setMealConfig(prev => ({ ...prev, cut_off_time: e.target.value }))}
                    className="w-full text-sm font-bold text-slate-900 h-10 px-3 rounded-lg border border-slate-300 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-amber-500 outline-none"
                  />
                  <span className="text-[11px] text-slate-400 block">
                    เวลาที่แนะนำให้โทรสั่งร้านข้าว เช่น 10:00 น.
                  </span>
                </div>

                {/* OT Dinner Allowance */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                      <Clock className="w-4 h-4 text-purple-600" />
                      <span>เปิดตัวเลือกมื้อเย็น / ค่าอาหาร OT</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={mealConfig.allow_ot_dinner}
                        onChange={e => setMealConfig(prev => ({ ...prev, allow_ot_dinner: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600" />
                    </label>
                  </div>
                  
                  {mealConfig.allow_ot_dinner && (
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="number"
                        min={0}
                        step={5}
                        value={mealConfig.ot_price_per_meal}
                        onChange={e => setMealConfig(prev => ({ ...prev, ot_price_per_meal: Number(e.target.value) || 0 }))}
                        className="w-full text-sm font-bold text-slate-900 h-9 px-3 rounded-lg border border-slate-300 bg-slate-50 focus:bg-white outline-none"
                      />
                      <span className="text-xs font-bold text-slate-500 shrink-0">บาท / มื้อเย็น</span>
                    </div>
                  )}
                  <span className="text-[11px] text-slate-400 block">
                    สำหรับทีมงานที่อยู่ทำล่วงเวลาเกิน 17:00 หรือ 19:00 น.
                  </span>
                </div>

                {/* Catering Shop info */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <Store className="w-4 h-4 text-orange-600" />
                    <span>ข้อมูลร้านข้าวประจำ (สำหรับติดต่อ)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="ชื่อร้านข้าว..."
                      value={mealConfig.catering_shop_name || ''}
                      onChange={e => setMealConfig(prev => ({ ...prev, catering_shop_name: e.target.value }))}
                      className="text-xs h-9 px-2.5 rounded-lg border border-slate-300 bg-slate-50 focus:bg-white outline-none"
                    />
                    <input
                      type="text"
                      placeholder="เบอร์โทร / LINE ID..."
                      value={mealConfig.catering_phone || ''}
                      onChange={e => setMealConfig(prev => ({ ...prev, catering_phone: e.target.value }))}
                      className="text-xs h-9 px-2.5 rounded-lg border border-slate-300 bg-slate-50 focus:bg-white outline-none"
                    />
                  </div>
                  <span className="text-[11px] text-slate-400 block">
                    เพื่อความสะดวกเวลาโฟร์แมนต้องการโทรสั่งข้าว
                  </span>
                </div>

              </div>

              {/* LINE Notification Template */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <MessageSquare className="w-4 h-4 text-emerald-600" />
                  <span>เทมเพลตข้อความสำหรับกดแชร์ / ส่ง LINE สั่งร้านข้าว</span>
                </div>
                <textarea
                  rows={4}
                  value={mealConfig.line_notify_template || ''}
                  onChange={e => setMealConfig(prev => ({ ...prev, line_notify_template: e.target.value }))}
                  className="w-full text-xs font-mono p-3 rounded-lg border border-slate-300 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-amber-500 outline-none"
                  placeholder="ใส่ข้อความเทมเพลต..."
                />
                <span className="text-[11px] text-slate-400 block">
                  รองรับตัวแปร: <code>{'{date}'}</code>, <code>{'{total}'}</code>, <code>{'{breakdown}'}</code>
                </span>
              </div>

              {/* Feature Status Information */}
              <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/60 flex items-start gap-2.5 text-xs text-blue-900">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold">สถานะของระบบปัจจุบัน:</span>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    ตอนนี้ระบบตั้งค่าไว้เป็น <strong>{mealConfig.enabled ? 'เปิดใช้งาน (Active)' : 'ปิดใช้งาน (Inactive/Hidden)'}</strong> หากยังไม่ต้องการใช้งานในตอนนี้ เพียงปล่อยให้สวิตช์เป็น &quot;ปิด&quot; ทุกส่วนบนหน้าเว็บและมือถือจะสะอาดตา และไม่มีฟังก์ชันข้าวกล่องมารบกวนครับ
                  </p>
                </div>
              </div>

            </div>

          </div>

          {/* Footer Save */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              สถานะ: {mealConfig.enabled ? '🟢 พร้อมเปิดใช้งาน' : '⚪ ซ่อนระบบไว้สำหรับอนาคต'}
            </span>
            <button
              type="button"
              onClick={handleSaveMealConfig}
              disabled={savingMeal}
              className="h-10 px-6 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-sm disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{savingMeal ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่าระบบค่าอาหาร'}</span>
            </button>
          </div>

        </div>
      )}

    </div>
  )
}
