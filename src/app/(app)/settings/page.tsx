'use client'

import React, { useState, useEffect } from 'react'
import {
  Sliders, Plus, Trash2, Edit2, Check, ArrowUp, ArrowDown,
  RotateCcw, Save, ShieldCheck, Sparkles, RefreshCw, Layers
} from 'lucide-react'
import { ChecklistPpeItem, DEFAULT_CHECKLIST_PPE_ITEMS } from '@/lib/types'
import { toast } from 'sonner'

const PRESET_ICONS = [
  '⛑️', '🦺', '🥽', '🧤', '👢', '🎧', '😷', '🧗', '🛡️', '🧯', '🔦', '🦻', '👓'
]

export default function SettingsPage() {
  const [items, setItems] = useState<ChecklistPpeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Edit / Add form state
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [itemLabel, setItemLabel] = useState('')
  const [itemIcon, setItemIcon] = useState('🛡️')
  const [itemRequired, setItemRequired] = useState(true)

  useEffect(() => {
    loadSettings()
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
    updated[index] = temp
    setItems(updated)
  }

  const handleMoveDown = (index: number) => {
    if (index === items.length - 1) return
    const updated = [...items]
    const temp = updated[index + 1]
    updated[index + 1] = updated[index]
    updated[index] = temp
    setItems(updated)
  }

  const handleDelete = (index: number) => {
    const target = items[index]
    if (items.length <= 1) {
      toast.warning('ต้องมีรายการเช็คลิสต์อย่างน้อย 1 รายการ')
      return
    }
    const updated = items.filter((_, i) => i !== index)
    setItems(updated)
    toast.info(`ลบ "${target.label}" แล้ว`)
  }

  const handleResetDefaults = () => {
    if (confirm('ต้องการรีเซ็ตรายการเช็คลิสต์กลับเป็น 5 รายการมาตรฐานใช่หรือไม่?')) {
      setItems(DEFAULT_CHECKLIST_PPE_ITEMS)
      setIsAdding(false)
      setEditingIndex(null)
      toast.info('รีเซ็ตเป็นค่าเริ่มต้นแล้ว (อย่าลืมกดบันทึก)')
    }
  }

  const handleSaveAll = async () => {
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

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-sm">
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">ตั้งค่าระบบ (Settings)</h1>
            <p className="text-sm text-slate-500">กำหนดรายการอุปกรณ์ความปลอดภัย (PPE Checklist) ที่ต้องการตรวจเช็คหน้างาน</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadSettings}
            disabled={loading}
            className="h-10 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
            <span>โหลดใหม่</span>
          </button>

          <button
            type="button"
            onClick={handleSaveAll}
            disabled={saving || loading}
            className="h-10 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-sm disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}</span>
          </button>
        </div>
      </div>

      {/* Main Settings Card */}
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">ชื่ออุปกรณ์ / รายการตรวจ</label>
                  <input
                    type="text"
                    value={itemLabel}
                    onChange={e => setItemLabel(e.target.value)}
                    placeholder="เช่น แว่นตา, สายรัดนิรภัย, ที่อุดหู..."
                    autoFocus
                    className="w-full h-9 text-xs px-3 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">เลือกไอคอนสัญลักษณ์</label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {PRESET_ICONS.map(ic => (
                      <button
                        key={ic}
                        type="button"
                        onClick={() => setItemIcon(ic)}
                        className={`w-8 h-8 rounded-lg text-base flex items-center justify-center border transition-all ${
                          itemIcon === ic
                            ? 'bg-emerald-600 text-white border-emerald-600 scale-105 shadow-2xs'
                            : 'bg-white hover:bg-slate-100 border-slate-200'
                        }`}
                      >
                        {ic}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-emerald-200">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-800 font-medium">
                  <input
                    type="checkbox"
                    checked={itemRequired}
                    onChange={e => setItemRequired(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-0 w-4 h-4"
                  />
                  <span>บังคับต้องมี (หากไม่ติ๊ก = ไม่ผ่านการตรวจ)</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCancelForm}
                    className="h-8 px-3 rounded-lg border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 text-xs font-normal"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveItem}
                    className="h-8 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs"
                  >
                    {isAdding ? 'เพิ่มลงในรายการ' : 'อัปเดตรายการ'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Table / List */}
          <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
            {items.map((item, idx) => (
              <div
                key={item.id}
                className={`p-3 transition-colors flex items-center justify-between gap-3 ${
                  item.is_active ? 'bg-white hover:bg-slate-50/70' : 'bg-slate-100/60 opacity-60'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="w-6 text-center text-xs font-bold text-slate-500 shrink-0">
                    #{idx + 1}
                  </span>

                  <span className="text-xl shrink-0">
                    {item.icon || '🛡️'}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-900">
                        {item.label}
                      </span>
                      {item.required && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200 text-xs font-semibold">
                          ต้องผ่าน
                        </span>
                      )}
                      {!item.is_active && (
                        <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 text-xs font-medium">
                          ปิดใช้งาน
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Move Up/Down */}
                  <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
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

                  {/* Toggle Active */}
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

                  {/* Edit */}
                  <button
                    type="button"
                    onClick={() => handleStartEdit(idx)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 transition-all"
                    title="แก้ไข"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  {/* Delete */}
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

        {/* Card Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={saving || loading}
            className="h-10 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-sm disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่าทั้งหมด'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
