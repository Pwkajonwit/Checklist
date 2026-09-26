'use client'

import React, { useState, useEffect } from 'react'
import {
  ShieldCheck, Plus, Trash2, Edit2, Check, X, ArrowUp, ArrowDown,
  RotateCcw, Save, AlertCircle, Sparkles, Sliders, HelpCircle
} from 'lucide-react'
import { ChecklistPpeItem, DEFAULT_CHECKLIST_PPE_ITEMS } from '@/lib/types'
import { toast } from 'sonner'

interface PpeSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  onSaved?: (items: ChecklistPpeItem[]) => void
}

const PRESET_ICONS = [
  '⛑️', '🦺', '🥽', '🧤', '👢', '🎧', '😷', '🧗', '🛡️', '🧯', '🔦', '🦻', '👓', '🦺'
]

export function PpeSettingsModal({ isOpen, onClose, onSaved }: PpeSettingsModalProps) {
  const [items, setItems] = useState<ChecklistPpeItem[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Edit / Add form state
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [itemLabel, setItemLabel] = useState('')
  const [itemIcon, setItemIcon] = useState('🛡️')
  const [itemRequired, setItemRequired] = useState(true)

  // Fetch current items on open
  useEffect(() => {
    if (isOpen) {
      loadSettings()
    }
  }, [isOpen])

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

  // Handle Add Click
  const handleStartAdd = () => {
    setIsAdding(true)
    setEditingIndex(null)
    setItemLabel('')
    setItemIcon('🛡️')
    setItemRequired(true)
  }

  // Handle Edit Click
  const handleStartEdit = (index: number) => {
    const it = items[index]
    setEditingIndex(index)
    setIsAdding(false)
    setItemLabel(it.label)
    setItemIcon(it.icon || '🛡️')
    setItemRequired(it.required ?? true)
  }

  // Handle Cancel Edit/Add
  const handleCancelForm = () => {
    setIsAdding(false)
    setEditingIndex(null)
    setItemLabel('')
  }

  // Handle Save Item (Add or Edit)
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

  // Toggle Active State
  const handleToggleActive = (index: number) => {
    const updated = [...items]
    updated[index].is_active = !updated[index].is_active
    setItems(updated)
  }

  // Move Item Up
  const handleMoveUp = (index: number) => {
    if (index === 0) return
    const updated = [...items]
    const temp = updated[index - 1]
    updated[index - 1] = updated[index]
    updated[index] = temp
    setItems(updated)
  }

  // Move Item Down
  const handleMoveDown = (index: number) => {
    if (index === items.length - 1) return
    const updated = [...items]
    const temp = updated[index + 1]
    updated[index + 1] = updated[index]
    updated[index] = temp
    setItems(updated)
  }

  // Delete Item
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

  // Reset to Defaults
  const handleResetDefaults = () => {
    if (confirm('ต้องการรีเซ็ตรายการเช็คลิสต์กลับเป็น 5 รายการมาตรฐานใช่หรือไม่?')) {
      setItems(DEFAULT_CHECKLIST_PPE_ITEMS)
      setIsAdding(false)
      setEditingIndex(null)
      toast.info('รีเซ็ตเป็นค่าเริ่มต้นแล้ว (อย่าลืมกดบันทึก)')
    }
  }

  // Save all to backend
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
        if (onSaved) onSaved(json.data || items)
        onClose()
      } else {
        toast.error(json.error || 'บันทึกล้มเหลว')
      }
    } catch (err: any) {
      toast.error('เกิดข้อผิดพลาดในการบันทึก: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-white px-4 py-3 shrink-0 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">ตั้งค่ารายการเช็คลิสต์ (PPE)</h2>
              <p className="text-[11px] text-slate-300">เพิ่ม แก้ไข ลด หรือจัดลำดับรายการตรวจความปลอดภัย</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3 scrollbar-thin">
          
          {/* Header Action Bar */}
          <div className="flex items-center justify-between gap-2 pb-1">
            <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
              <span>รายการทั้งหมด ({items.length} รายการ)</span>
              <span className="text-[11px] text-emerald-700 font-normal">
                (เปิดใช้ {items.filter(i => i.is_active).length})
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleResetDefaults}
                className="text-[11px] font-medium text-slate-600 hover:text-slate-900 px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center gap-1 transition-all"
                title="รีเซ็ตเป็นค่าเริ่มต้น"
              >
                <RotateCcw className="w-3 h-3 text-slate-500" />
                <span>รีเซ็ต</span>
              </button>

              {!isAdding && editingIndex === null && (
                <button
                  type="button"
                  onClick={handleStartAdd}
                  className="text-xs font-semibold text-white px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 shadow-2xs flex items-center gap-1 active:scale-95 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>เพิ่มรายการ</span>
                </button>
              )}
            </div>
          </div>

          {/* Add / Edit Form Card */}
          {(isAdding || editingIndex !== null) && (
            <div className="p-3 bg-emerald-50/70 border border-emerald-300 rounded-xl space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-950">
                <span>{isAdding ? '➕ เพิ่มรายการเช็คลิสต์ใหม่' : '✏️ แก้ไขรายการ'}</span>
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="text-slate-500 hover:text-slate-800 text-[11px] font-normal"
                >
                  ยกเลิก
                </button>
              </div>

              <div className="space-y-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 mb-1 block">ชื่ออุปกรณ์ / รายการตรวจ</label>
                  <input
                    type="text"
                    value={itemLabel}
                    onChange={e => setItemLabel(e.target.value)}
                    placeholder="เช่น แว่นตา, สายรัดนิรภัย, ที่อุดหู..."
                    autoFocus
                    className="w-full h-8 text-xs px-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 mb-1 block">เลือกไอคอนสัญลักษณ์</label>
                  <div className="flex items-center gap-1 flex-wrap">
                    {PRESET_ICONS.map(ic => (
                      <button
                        key={ic}
                        type="button"
                        onClick={() => setItemIcon(ic)}
                        className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center border transition-all ${
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

                <div className="flex items-center justify-between pt-1 border-t border-emerald-200/80">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-800 font-medium">
                    <input
                      type="checkbox"
                      checked={itemRequired}
                      onChange={e => setItemRequired(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-0 w-4 h-4"
                    />
                    <span>บังคับต้องมี (ขาด = ไม่ผ่าน)</span>
                  </label>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleCancelForm}
                      className="h-7 px-2.5 rounded-lg border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 text-xs font-normal"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveItem}
                      className="h-7 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-2xs"
                    >
                      {isAdding ? 'เพิ่มรายการ' : 'บันทึกแก้ไข'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* List of Items */}
          <div className="space-y-1.5">
            {items.map((item, idx) => (
              <div
                key={item.id}
                className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                  item.is_active
                    ? 'bg-white border-slate-200 shadow-2xs'
                    : 'bg-slate-100/70 border-slate-200 opacity-60'
                }`}
              >
                {/* Drag / Index & Info */}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="w-5 text-center text-xs font-bold text-slate-600 shrink-0">
                    {idx + 1}
                  </span>

                  <span className="text-base shrink-0">
                    {item.icon || '🛡️'}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {item.label}
                      </span>
                      {item.required && (
                        <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-900 border border-amber-200 text-[10px] font-semibold">
                          บังคับ
                        </span>
                      )}
                      {!item.is_active && (
                        <span className="px-1.5 py-0.2 rounded bg-slate-200 text-slate-600 text-[10px] font-medium">
                          ปิดใช้งาน
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {/* Move Up / Down */}
                  <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                    <button
                      type="button"
                      onClick={() => handleMoveUp(idx)}
                      disabled={idx === 0}
                      className="w-6 h-6 flex items-center justify-center text-slate-600 hover:text-slate-950 disabled:opacity-30 disabled:hover:text-slate-600 hover:bg-slate-200 transition-colors"
                      title="ย้ายขึ้น"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <div className="w-[1px] h-3 bg-slate-200" />
                    <button
                      type="button"
                      onClick={() => handleMoveDown(idx)}
                      disabled={idx === items.length - 1}
                      className="w-6 h-6 flex items-center justify-center text-slate-600 hover:text-slate-950 disabled:opacity-30 disabled:hover:text-slate-600 hover:bg-slate-200 transition-colors"
                      title="ย้ายลง"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Toggle Active Button */}
                  <button
                    type="button"
                    onClick={() => handleToggleActive(idx)}
                    className={`h-6 px-1.5 rounded text-[11px] font-semibold border transition-all ${
                      item.is_active
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-slate-200 text-slate-600 border-slate-300'
                    }`}
                    title={item.is_active ? 'กดเพื่อปิดใช้งาน' : 'กดเพื่อเปิดใช้งาน'}
                  >
                    {item.is_active ? 'เปิด' : 'ปิด'}
                  </button>

                  {/* Edit */}
                  <button
                    type="button"
                    onClick={() => handleStartEdit(idx)}
                    className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 transition-all"
                    title="แก้ไข"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => handleDelete(idx)}
                    className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition-all"
                    title="ลบรายการนี้"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Live Preview Box */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
            <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>ตัวอย่างปุ่มที่จะแสดงในฟอร์มตรวจเช็ค ({items.filter(i => i.is_active).length} รายการที่เปิดใช้งาน):</span>
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {items.filter(i => i.is_active).map(it => (
                <div
                  key={it.id}
                  className="h-8 px-2 rounded-lg bg-white border border-emerald-300 text-emerald-950 font-semibold text-xs flex items-center justify-center gap-1 shadow-2xs"
                >
                  <Check className="w-3.5 h-3.5 stroke-[3] text-emerald-600" />
                  <span>{it.icon} {it.label}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-3.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-all"
          >
            ยกเลิก
          </button>

          <button
            type="button"
            onClick={handleSaveAll}
            disabled={saving}
            className="h-9 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่าทั้งหมด'}</span>
          </button>
        </div>

      </div>
    </div>
  )
}
