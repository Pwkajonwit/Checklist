'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Activity } from '@/lib/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import {
  Layers, Plus, Pencil, Trash2, Search, MapPin,
  Loader2, RefreshCw, CheckCircle2, XCircle, Hash,
  Building, Check, X, Wrench
} from 'lucide-react'

// รายการระบบงานหลัก สำหรับคลิกเลือกด่วน
const SYSTEM_WORK_PRESETS = [
  'งานปูกระเบื้อง',
  'งานก่ออิฐฉาบปูน',
  'งานทาสี',
  'งานระบบไฟฟ้า',
  'งานเชื่อมโครงสร้าง',
  'งานประปา / สุขาภิบาล',
  'งานฝ้าเพดาน',
  'งานโครงสร้างเหล็ก',
  'งานเทคอนกรีต',
  'งานติดตั้งกระจก/อะลูมิเนียม',
  'งานติดตั้งแอร์',
  'งานกันซึม / หลังคา',
]

export default function ActivitiesPage() {
  const supabase = useMemo(() => createClient(), [])
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [formCode, setFormCode] = useState('')
  const [formName, setFormName] = useState('')
  const [formTasks, setFormTasks] = useState<string[]>([])
  const [customTaskInput, setCustomTaskInput] = useState('')
  const [formLocation, setFormLocation] = useState('')
  const [formActive, setFormActive] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true)
    else setRefreshing(true)

    try {
      const res = await fetch('/api/activities')
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'ไม่สามารถโหลดข้อมูลได้')
      }
      const { data } = await res.json()
      setActivities(data ?? [])
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลได้'
      console.error('Fetch activities error:', message, err)
      toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล', { description: message })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Stats calculation
  const stats = useMemo(() => {
    const total = activities.length
    const active = activities.filter(a => a.is_active).length
    const inactive = total - active
    const withLocation = activities.filter(a => !!a.location).length
    return { total, active, inactive, withLocation }
  }, [activities])

  // Filtered List
  const filtered = useMemo(() => {
    return activities.filter(a => {
      if (statusFilter === 'active' && !a.is_active) return false
      if (statusFilter === 'inactive' && a.is_active) return false

      if (search.trim()) {
        const q = search.toLowerCase()
        const codeMatch = (a.code ?? '').toLowerCase().includes(q)
        const nameMatch = a.name.toLowerCase().includes(q)
        const tasksMatch = (a.tasks ?? '').toLowerCase().includes(q)
        const locMatch = (a.location ?? '').toLowerCase().includes(q)
        if (!codeMatch && !nameMatch && !tasksMatch && !locMatch) return false
      }

      return true
    })
  }, [activities, statusFilter, search])

  // Task selection helpers
  const toggleTask = (task: string) => {
    const trimmed = task.trim()
    if (!trimmed) return
    setFormTasks(prev =>
      prev.includes(trimmed) ? prev.filter(t => t !== trimmed) : [...prev, trimmed]
    )
  }

  const addCustomTask = () => {
    const trimmed = customTaskInput.trim()
    if (!trimmed) return
    if (!formTasks.includes(trimmed)) {
      setFormTasks(prev => [...prev, trimmed])
    }
    setCustomTaskInput('')
  }

  const removeTask = (task: string) => {
    setFormTasks(prev => prev.filter(t => t !== task))
  }

  const openCreate = () => {
    setEditId(null)
    setFormCode('')
    setFormName('')
    setFormTasks([])
    setCustomTaskInput('')
    setFormLocation('')
    setFormActive(true)
    setDialogOpen(true)
  }

  const openEdit = (a: Activity) => {
    setEditId(a.id)
    setFormCode(a.code ?? '')
    setFormName(a.name)
    if (a.tasks) {
      setFormTasks(a.tasks.split(',').map((s: string) => s.trim()).filter(Boolean))
    } else {
      setFormTasks([])
    }
    setCustomTaskInput('')
    setFormLocation(a.location ?? '')
    setFormActive(a.is_active)
    setDialogOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim()) {
      toast.error('กรุณาระบุชื่อกิจกรรม')
      return
    }

    setSaving(true)
    const tasksString = formTasks.length > 0 ? formTasks.join(', ') : null

    const payloadFull: Record<string, unknown> = {
      code: formCode.trim() || null,
      name: formName.trim(),
      tasks: tasksString,
      location: formLocation.trim() || null,
      is_active: formActive,
    }

    const payloadWithoutTasks: Record<string, unknown> = {
      code: formCode.trim() || null,
      name: formName.trim(),
      location: formLocation.trim() || null,
      is_active: formActive,
    }

    const payloadBasic: Record<string, unknown> = {
      name: formName.trim(),
      location: formLocation.trim() || null,
      is_active: formActive,
    }

    try {
      const url = editId ? `/api/activities/${editId}` : '/api/activities'
      const method = editId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadFull),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'เกิดข้อผิดพลาดในการบันทึก')
      }

      toast.success(editId ? 'แก้ไขข้อมูลกิจกรรมเรียบร้อยแล้ว' : 'เพิ่มกิจกรรมเรียบร้อยแล้ว')
      setDialogOpen(false)
      fetchData(true)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึก'
      toast.error('บันทึกไม่สำเร็จ', { description: message })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`ต้องการลบกิจกรรม "${name}" หรือไม่?`)) return
    try {
      const res = await fetch(`/api/activities/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'ลบไม่สำเร็จ')
      }
      toast.success(`ลบกิจกรรม "${name}" สำเร็จ`)
      setActivities(prev => prev.filter(a => a.id !== id))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'
      toast.error('ลบไม่สำเร็จ', { description: message })
    }
  }

  const handleToggleActive = async (a: Activity) => {
    const nextStatus = !a.is_active
    try {
      const res = await fetch(`/api/activities/${a.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: nextStatus }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'เปลี่ยนสถานะไม่สำเร็จ')
      }
      toast.success(nextStatus ? `เปิดใช้งาน "${a.name}" แล้ว` : `ปิดใช้งาน "${a.name}" แล้ว`)
      setActivities(prev => prev.map(item => item.id === a.id ? { ...item, is_active: nextStatus } : item))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'
      toast.error('เปลี่ยนสถานะไม่สำเร็จ', { description: message })
    }
  }


  return (
    <div className="flex flex-col flex-1 min-h-0 h-full gap-2 overflow-hidden">
      {/* ── Compact Top Controls Bar ── */}
      <div className="p-2 bg-white rounded-lg border border-slate-300 shadow-2xs flex flex-wrap items-center justify-between gap-2 shrink-0">
        
        {/* Left: Title & Status Filter Tabs */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-purple-50 text-purple-800 text-xs font-bold border border-purple-200">
            <Layers className="w-3.5 h-3.5 text-purple-600" />
            <span>จัดการกิจกรรมและระบบงาน</span>
          </div>

          {/* Quick status tabs */}
          <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded border border-slate-200 text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-800 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ทั้งหมด ({stats.total})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all flex items-center gap-1 ${
                statusFilter === 'active'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-emerald-700 hover:text-emerald-900'
              }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              เปิดใช้งาน ({stats.active})
            </button>
            {stats.inactive > 0 && (
              <button
                onClick={() => setStatusFilter('inactive')}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all flex items-center gap-1 ${
                  statusFilter === 'inactive'
                    ? 'bg-slate-700 text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <XCircle className="w-3 h-3" />
                ปิด ({stats.inactive})
              </button>
            )}
          </div>
        </div>

        {/* Right: Search + Refresh + Add */}
        <div className="flex items-center gap-1.5 ml-auto flex-wrap">
          {/* Search box */}
          <div className="relative w-44 sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="search"
              placeholder="ค้นหากิจกรรม, รหัส, สถานที่..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full text-xs pl-8 pr-2.5 py-1 rounded border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>

          {/* Refresh button */}
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing || loading}
            className="w-7 h-7 flex items-center justify-center rounded border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors disabled:opacity-50"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing || loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Add button */}
          <Button
            size="sm"
            onClick={openCreate}
            className="h-7 px-2.5 text-xs bg-purple-600 hover:bg-purple-700 text-white font-medium shadow-2xs gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>เพิ่มกิจกรรม</span>
          </Button>
        </div>
      </div>

      {/* ── Table Container (Spreadsheet Grid) ── */}
      <div className="border border-slate-300 rounded-lg overflow-hidden bg-white shadow-2xs flex-1 min-h-0 flex flex-col h-full">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
            <span className="text-xs">กำลังโหลดข้อมูลกิจกรรม...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-400 p-4">
            <Layers className="w-8 h-8 stroke-1 text-slate-300" />
            <span className="text-xs font-medium text-slate-500">
              {search || statusFilter !== 'all'
                ? 'ไม่พบข้อมูลที่ตรงกับเงื่อนไขการค้นหา'
                : 'ยังไม่มีข้อมูลกิจกรรมในระบบ'}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={openCreate}
              className="h-7 text-xs border-purple-300 text-purple-700 hover:bg-purple-50"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> เพิ่มกิจกรรมแรก
            </Button>
          </div>
        ) : (
          <div className="flex-1 overflow-auto min-h-0 scrollbar-thin">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-slate-100 z-10 select-none">
                <tr className="text-[11px] font-bold text-slate-700 border-b border-slate-300">
                  <th className="py-2 px-2.5 text-center w-12 border-r border-slate-300">#</th>
                  <th className="py-2 px-2.5 text-center w-24 border-r border-slate-300">รหัส (Code)</th>
                  <th className="py-2 px-3 border-r border-slate-300">ชื่อกิจกรรมหลัก / โครงการ</th>
                  <th className="py-2 px-3 border-r border-slate-300">ระบบงานย่อย / Tasks</th>
                  <th className="py-2 px-3 border-r border-slate-300">สถานที่ / อาคาร</th>
                  <th className="py-2 px-3 text-center min-w-[105px] border-r border-slate-300 whitespace-nowrap">สถานะ</th>
                  <th className="py-2 px-2.5 text-center w-20">จัดการ</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-slate-200">
                {filtered.map((a, idx) => {
                  const tasksList = a.tasks ? a.tasks.split(',').map(s => s.trim()).filter(Boolean) : []

                  return (
                    <tr
                      key={a.id}
                      className={`hover:bg-purple-50/30 transition-colors ${
                        !a.is_active ? 'bg-slate-50/70 text-slate-400' : 'text-slate-800'
                      }`}
                    >
                      {/* Index */}
                      <td className="py-1.5 px-2.5 text-center text-[11px] text-slate-400 font-medium border-r border-slate-200">
                        {idx + 1}
                      </td>

                      {/* Code */}
                      <td className="py-1.5 px-2.5 text-center border-r border-slate-200 font-mono text-[11px]">
                        {a.code ? (
                          <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-purple-700 font-bold border border-slate-200">
                            {a.code}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Name */}
                      <td className="py-1.5 px-3 font-semibold border-r border-slate-200">
                        <span className={a.is_active ? 'text-slate-900' : 'text-slate-500'}>
                          {a.name}
                        </span>
                      </td>

                      {/* Tasks Chips */}
                      <td className="py-1.5 px-3 border-r border-slate-200">
                        {tasksList.length > 0 ? (
                          <div className="flex flex-wrap gap-1 items-center">
                            {tasksList.map((task, tIdx) => (
                              <span
                                key={tIdx}
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200"
                              >
                                <Wrench className="w-2.5 h-2.5 text-purple-500" />
                                {task}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">ไม่มีระบบงานย่อย</span>
                        )}
                      </td>

                      {/* Location */}
                      <td className="py-1.5 px-3 border-r border-slate-200">
                        {a.location ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-700">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            {a.location}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>

                      {/* Status Toggle */}
                      <td className="py-1.5 px-3 text-center border-r border-slate-200 whitespace-nowrap">
                        <button
                          onClick={() => handleToggleActive(a)}
                          className={`inline-flex items-center justify-center text-[11px] font-medium px-2.5 py-0.5 rounded-full cursor-pointer transition-colors whitespace-nowrap border ${
                            a.is_active
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-400 hover:bg-emerald-200'
                              : 'bg-slate-200 text-slate-800 border-slate-400 hover:bg-slate-300'
                          }`}
                          title="คลิกเพื่อสลับสถานะ"
                        >
                          {a.is_active ? 'เปิดใช้งาน' : 'ปิด'}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-1.5 px-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEdit(a)}
                            className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 text-slate-500 hover:text-blue-600 transition-colors"
                            title="แก้ไขข้อมูล"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(a.id, a.name)}
                            className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                            title="ลบ"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Table Footer ── */}
        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
          <div>
            แสดง <span className="font-semibold text-slate-700">{filtered.length}</span> จากทั้งหมด{' '}
            <span className="font-semibold text-slate-700">{stats.total}</span> กิจกรรม
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              เปิดใช้งาน {stats.active} กิจกรรม
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
              ปิดใช้งาน {stats.inactive} กิจกรรม
            </span>
          </div>
        </div>
      </div>

      {/* ── Dialog Form (เพิ่ม / แก้ไข กิจกรรม และ ระบบงาน) ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md p-5 bg-white rounded-xl shadow-xl border border-slate-200">
          <form onSubmit={handleSave}>
            <DialogHeader className="pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold shrink-0 bg-purple-100 text-purple-700">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <DialogTitle className="text-sm font-bold text-slate-900">
                    {editId ? 'แก้ไขกิจกรรม' : 'เพิ่มกิจกรรมใหม่'}
                  </DialogTitle>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    กำหนดกิจกรรมและระบบงานสำหรับบันทึก Checklist
                  </p>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-2.5 py-2 text-xs">
              {/* Code & Name in one line if possible or stacked */}
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1 col-span-1">
                  <Label htmlFor="act_code" className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                    <Hash className="w-3 h-3 text-purple-600" />
                    รหัส Code
                  </Label>
                  <Input
                    id="act_code"
                    value={formCode}
                    onChange={e => setFormCode(e.target.value)}
                    placeholder="ACT-01"
                    className="h-8 text-xs font-mono bg-white border-slate-300 uppercase"
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label htmlFor="act_name" className="text-xs font-semibold text-slate-700">
                    ชื่อกิจกรรม / โครงการ *
                  </Label>
                  <Input
                    id="act_name"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder="เช่น งานปรับปรุงอาคาร..."
                    required
                    className="h-8 text-xs bg-white border-slate-300 font-medium text-slate-900"
                    autoFocus
                  />
                </div>
              </div>

              {/* Tasks section */}
              <div className="space-y-1.5 p-2 rounded-lg border border-purple-200 bg-purple-50/30">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] font-bold text-purple-900 flex items-center gap-1">
                    <Wrench className="w-3 h-3 text-purple-700" />
                    ระบบงานย่อย / Tasks:
                  </Label>
                  {formTasks.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setFormTasks([])}
                      className="text-[10px] text-rose-500 hover:underline cursor-pointer"
                    >
                      ล้างทั้งหมด ({formTasks.length})
                    </button>
                  )}
                </div>

                {/* Selected tasks chips */}
                {formTasks.length > 0 && (
                  <div className="flex flex-wrap gap-1 p-1 rounded bg-white border border-purple-200 items-center max-h-20 overflow-y-auto">
                    {formTasks.map(task => (
                      <span
                        key={task}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-800"
                      >
                        <Check className="w-2.5 h-2.5 text-purple-700" />
                        {task}
                        <button
                          type="button"
                          onClick={() => removeTask(task)}
                          className="w-3 h-3 rounded-full hover:bg-rose-200 hover:text-rose-700 inline-flex items-center justify-center cursor-pointer ml-0.5"
                          title="ลบ"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Preset Chips */}
                <div>
                  <span className="text-[10px] font-medium text-slate-500 block mb-1">
                    คลิกเลือกงานด่วน:
                  </span>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                    {SYSTEM_WORK_PRESETS.map(preset => {
                      const isSelected = formTasks.includes(preset)
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => toggleTask(preset)}
                          className={`text-[10px] px-1.5 py-0.5 rounded border transition-all cursor-pointer flex items-center gap-0.5 ${
                            isSelected
                              ? 'bg-purple-600 border-purple-600 text-white font-semibold'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-purple-50'
                          }`}
                        >
                          {isSelected ? <Check className="w-2.5 h-2.5" /> : <Plus className="w-2.5 h-2.5 text-slate-400" />}
                          {preset}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Custom task input */}
                <div className="flex gap-1 pt-0.5">
                  <Input
                    value={customTaskInput}
                    onChange={e => setCustomTaskInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addCustomTask()
                      }
                    }}
                    placeholder="พิมพ์ชื่องานอื่น ๆ..."
                    className="h-7 bg-white text-xs"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={addCustomTask}
                    variant="outline"
                    className="h-7 px-2 text-xs border-purple-300 text-purple-700 hover:bg-purple-50 shrink-0"
                  >
                    + เพิ่ม
                  </Button>
                </div>
              </div>

              {/* Location */}
              <div className="space-y-1">
                <Label htmlFor="act_location" className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <Building className="w-3 h-3 text-slate-500" />
                  สถานที่ / โรง / พื้นที่
                </Label>
                <Input
                  id="act_location"
                  value={formLocation}
                  onChange={e => setFormLocation(e.target.value)}
                  placeholder="เช่น โรง 3, อาคาร B..."
                  className="h-8 text-xs bg-white border-slate-300"
                />
              </div>

              {/* Active Toggle */}
              <label
                htmlFor="act_active"
                className="flex items-center justify-between p-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer transition-all"
              >
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="act_active"
                    checked={formActive}
                    onCheckedChange={v => setFormActive(!!v)}
                  />
                  <div>
                    <p className="text-xs font-semibold text-slate-800">เปิดใช้งานกิจกรรมนี้</p>
                    <p className="text-[10px] text-slate-400">แสดงในตัวเลือกแบบฟอร์ม Checklist</p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={
                    formActive
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]'
                      : 'bg-slate-100 text-slate-500 text-[10px]'
                  }
                >
                  {formActive ? 'Active' : 'Inactive'}
                </Badge>
              </label>
            </div>

            <DialogFooter className="pt-2.5 border-t border-slate-100 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDialogOpen(false)}
                className="h-8 px-3 text-xs bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
              >
                ยกเลิก
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={saving}
                className="h-8 px-4 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 shadow-2xs"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> กำลังบันทึก...
                  </>
                ) : (
                  editId ? 'บันทึกการแก้ไข' : 'บันทึกกิจกรรม'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
