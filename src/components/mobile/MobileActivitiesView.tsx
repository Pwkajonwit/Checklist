'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Activity } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import {
  Layers, Plus, Search, Pencil, Trash2, MapPin,
  RefreshCw, Loader2, CheckCircle2, XCircle, Wrench,
  Check, X, Hash, Building
} from 'lucide-react'

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

export function MobileActivitiesView() {
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
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .order('name')

      if (error) throw error
      setActivities(data ?? [])
    } catch (err: unknown) {
      console.error('Fetch activities mobile error:', err)
      toast.error('โหลดข้อมูลกิจกรรมไม่สำเร็จ')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const stats = useMemo(() => {
    const total = activities.length
    const active = activities.filter(a => a.is_active).length
    const inactive = total - active
    return { total, active, inactive }
  }, [activities])

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
      code: formCode.trim() ? formCode.trim().toUpperCase() : null,
      name: formName.trim(),
      tasks: tasksString,
      location: formLocation.trim() || null,
      is_active: formActive,
    }

    const payloadWithoutTasks: Record<string, unknown> = {
      code: formCode.trim() ? formCode.trim().toUpperCase() : null,
      name: formName.trim(),
      location: formLocation.trim() || null,
      is_active: formActive,
    }

    try {
      let result = editId
        ? await supabase.from('activities').update(payloadFull).eq('id', editId)
        : await supabase.from('activities').insert(payloadFull)

      if (result.error && result.error.message.includes('tasks')) {
        result = editId
          ? await supabase.from('activities').update(payloadWithoutTasks).eq('id', editId)
          : await supabase.from('activities').insert(payloadWithoutTasks)
      }

      if (result.error) throw result.error

      toast.success(editId ? 'แก้ไขกิจกรรมเรียบร้อยแล้ว' : 'เพิ่มกิจกรรมใหม่เรียบร้อยแล้ว')
      setDialogOpen(false)
      fetchData(true)
    } catch (err: unknown) {
      console.error('Save activity error:', err)
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'
      toast.error('บันทึกไม่สำเร็จ', { description: msg })
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (a: Activity) => {
    const nextActive = !a.is_active
    try {
      const { error } = await supabase
        .from('activities')
        .update({ is_active: nextActive })
        .eq('id', a.id)

      if (error) throw error
      toast.success(nextActive ? `เปิดใช้งาน "${a.name}" แล้ว` : `ปิดใช้งาน "${a.name}" แล้ว`)
      setActivities(prev =>
        prev.map(item => (item.id === a.id ? { ...item, is_active: nextActive } : item))
      )
    } catch {
      toast.error('ไม่สามารถเปลี่ยนสถานะได้')
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`ต้องการลบกิจกรรม "${name}" หรือไม่?`)) return
    try {
      const { error } = await supabase.from('activities').delete().eq('id', id)
      if (error) throw error
      toast.success(`ลบกิจกรรม "${name}" สำเร็จ`)
      setActivities(prev => prev.filter(a => a.id !== id))
    } catch {
      toast.error('ลบไม่สำเร็จ')
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full bg-slate-100 overflow-hidden">
      {/* ── Mobile Header (Premium Dark Gradient) ── */}
      <header className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-white px-3.5 py-2.5 shrink-0 flex items-center justify-between border-b border-slate-800 shadow-md">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 border border-purple-400/30 flex items-center justify-center text-white shadow-sm shrink-0">
            <Layers className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold tracking-tight text-white truncate leading-tight">
              กิจกรรมและระบบงาน
            </h1>
            <p className="text-xs text-slate-300 font-normal leading-tight mt-0.5">
              ทั้งหมด <span className="font-semibold text-white">{stats.total}</span> รายการ (<span className="font-semibold text-emerald-400">{stats.active}</span> เปิดใช้งาน)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing || loading}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-slate-200 border border-white/20 transition-all disabled:opacity-50 active:scale-95"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing || loading ? 'animate-spin text-purple-400' : ''}`} />
          </button>
          <Button
            size="sm"
            onClick={openCreate}
            className="h-8 px-3 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-sm border border-purple-400/30 gap-1 active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>เพิ่มกิจกรรม</span>
          </Button>
        </div>
      </header>

      {/* ── Filter Bar (Height h-9 for Search & Status Tabs) ── */}
      <div className="bg-white p-2.5 border-b border-slate-300 shadow-2xs space-y-2 shrink-0">
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs border border-slate-300">
            <button
              onClick={() => setStatusFilter('all')}
              className={`h-8 px-3 rounded text-xs transition-all flex items-center ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-950 font-semibold shadow-2xs'
                  : 'text-slate-700 hover:text-slate-950 font-normal'
              }`}
            >
              ทั้งหมด ({stats.total})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`h-8 px-3 rounded text-xs transition-all flex items-center gap-1 ${
                statusFilter === 'active'
                  ? 'bg-emerald-600 text-white font-semibold shadow-2xs'
                  : 'text-emerald-800 hover:text-emerald-950 font-normal'
              }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              เปิด ({stats.active})
            </button>
            {stats.inactive > 0 && (
              <button
                onClick={() => setStatusFilter('inactive')}
                className={`h-8 px-3 rounded text-xs transition-all flex items-center gap-1 ${
                  statusFilter === 'inactive'
                    ? 'bg-slate-700 text-white font-semibold shadow-2xs'
                    : 'text-slate-700 hover:text-slate-900 font-normal'
                }`}
              >
                <XCircle className="w-3 h-3" />
                ปิด ({stats.inactive})
              </button>
            )}
          </div>
        </div>

        {/* Search Input (h-9) */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            type="search"
            placeholder="ค้นหากิจกรรม, รหัส, สถานที่..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-9 text-xs pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 font-normal focus:outline-none focus:ring-1 focus:ring-purple-600 placeholder:text-slate-500"
          />
        </div>
      </div>

      {/* ── Activities Card List (mini-Compact Layout) ── */}
      <div className="flex-1 overflow-y-auto min-h-0 p-2 space-y-2">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
            <span className="text-xs font-normal">กำลังโหลดกิจกรรม...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-300 p-8 text-center flex flex-col items-center justify-center gap-2">
            <Layers className="w-10 h-10 stroke-1 text-slate-400" />
            <p className="text-xs font-semibold text-slate-900">ไม่พบกิจกรรม</p>
            <Button
              size="sm"
              onClick={openCreate}
              className="h-8 text-xs bg-purple-600 hover:bg-purple-700 text-white font-bold"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> เพิ่มกิจกรรมแรก
            </Button>
          </div>
        ) : (
          filtered.map(a => {
            const tasksList = a.tasks ? a.tasks.split(',').map(s => s.trim()).filter(Boolean) : []

            return (
              <div
                key={a.id}
                className={`bg-white rounded-xl border p-2.5 shadow-2xs space-y-2 transition-all ${
                  !a.is_active
                    ? 'opacity-70 bg-slate-50 border-slate-300'
                    : 'border-slate-300 hover:border-slate-400'
                }`}
              >
                {/* Header Row: Code badge, Name, Edit/Delete */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-950 border border-purple-300 flex items-center justify-center font-bold text-xs shrink-0">
                      {a.code || <Layers className="w-4 h-4" />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h2 className="text-xs font-semibold text-slate-900 leading-tight">
                          {a.name}
                        </h2>
                        {a.code && (
                          <span className="px-2 py-0.5 rounded font-bold text-xs bg-purple-50 text-purple-800 border border-purple-300">
                            [{a.code}]
                          </span>
                        )}
                      </div>

                      {a.location && (
                        <span className="text-xs text-slate-700 font-normal flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-500" />
                          {a.location}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(a)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:text-purple-800 hover:bg-purple-50 transition-colors"
                      title="แก้ไข"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(a.id, a.name)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                      title="ลบ"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Tasks Chips Row */}
                {tasksList.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 items-center pt-0.5">
                    {tasksList.map((t, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-normal bg-purple-50 text-purple-900 border border-purple-300"
                      >
                        <Wrench className="w-3 h-3 text-purple-600" />
                        {t}
                      </span>
                    ))}
                  </div>
                )}

                {/* Status Switch Footer */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-200 text-xs">
                  <span className="text-xs text-slate-600 font-normal">
                    {tasksList.length} ระบบงานย่อย
                  </span>

                  <button
                    onClick={() => handleToggleActive(a)}
                    className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border transition-all ${
                      a.is_active
                        ? 'bg-emerald-100 text-emerald-950 border-emerald-400 hover:bg-emerald-200'
                        : 'bg-slate-200 text-slate-800 border-slate-300 hover:bg-slate-300'
                    }`}
                  >
                    {a.is_active ? '● เปิดใช้งาน' : '○ ปิด'}
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* ── Dialog Form for Add & Edit Activity ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm p-4 bg-white rounded-2xl shadow-xl border border-slate-300 max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSave}>
            <DialogHeader className="pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center font-bold">
                  <Layers className="w-4 h-4" />
                </div>
                <DialogTitle className="text-sm font-bold text-slate-900">
                  {editId ? 'แก้ไขกิจกรรม' : 'เพิ่มกิจกรรมใหม่'}
                </DialogTitle>
              </div>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              {/* Code & Name */}
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <Label className="text-xs font-semibold text-slate-800 flex items-center gap-1">
                    <Hash className="w-3.5 h-3.5 text-purple-700" />
                    รหัส Code
                  </Label>
                  <Input
                    value={formCode}
                    onChange={e => setFormCode(e.target.value)}
                    placeholder="ACT-01"
                    className="h-9 text-xs uppercase mt-1 bg-white border-slate-300 text-slate-900 font-normal"
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs font-semibold text-slate-800">
                    ชื่อกิจกรรม *
                  </Label>
                  <Input
                    required
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder="เช่น งานปรับปรุงอาคาร..."
                    className="h-9 text-xs mt-1 bg-white border-slate-300 text-slate-900 font-normal"
                    autoFocus
                  />
                </div>
              </div>

              {/* Tasks Presets */}
              <div className="space-y-1.5 p-2.5 rounded-lg border border-purple-300 bg-purple-50">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-purple-950 flex items-center gap-1">
                    <Wrench className="w-3.5 h-3.5 text-purple-700" />
                    ระบบงานย่อย ({formTasks.length}):
                  </Label>
                  {formTasks.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setFormTasks([])}
                      className="text-xs text-rose-700 font-semibold hover:underline"
                    >
                      ล้างหมด
                    </button>
                  )}
                </div>

                {/* Selected task chips */}
                {formTasks.length > 0 && (
                  <div className="flex flex-wrap gap-1 p-1 bg-white rounded border border-purple-300 max-h-20 overflow-y-auto">
                    {formTasks.map(task => (
                      <span
                        key={task}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-normal bg-purple-100 text-purple-950"
                      >
                        {task}
                        <button
                          type="button"
                          onClick={() => removeTask(task)}
                          className="w-3.5 h-3.5 rounded-full hover:bg-rose-200 hover:text-rose-700 inline-flex items-center justify-center cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Preset choices */}
                <div className="flex flex-wrap gap-1.5 pt-1 max-h-24 overflow-y-auto">
                  {SYSTEM_WORK_PRESETS.map(preset => {
                    const isSelected = formTasks.includes(preset)
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => toggleTask(preset)}
                        className={`text-xs px-2 py-1 rounded border transition-all flex items-center gap-1 ${
                          isSelected
                            ? 'bg-purple-600 border-purple-600 text-white font-semibold'
                            : 'bg-white border-slate-300 text-slate-800 hover:bg-purple-100 font-normal'
                        }`}
                      >
                        {isSelected ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3 text-slate-500" />}
                        {preset}
                      </button>
                    )
                  })}
                </div>

                {/* Custom task input */}
                <div className="flex gap-1.5 pt-1">
                  <Input
                    value={customTaskInput}
                    onChange={e => setCustomTaskInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addCustomTask()
                      }
                    }}
                    placeholder="พิมพ์ชื่องานอื่น..."
                    className="h-9 bg-white text-xs text-slate-900 border-slate-300 font-normal"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={addCustomTask}
                    variant="outline"
                    className="h-9 px-3 text-xs border-purple-400 text-purple-900 hover:bg-purple-100 shrink-0 font-semibold"
                  >
                    + เพิ่ม
                  </Button>
                </div>
              </div>

              {/* Location */}
              <div>
                <Label className="text-xs font-semibold text-slate-800 flex items-center gap-1">
                  <Building className="w-3.5 h-3.5 text-slate-600" />
                  สถานที่ / โรง / พื้นที่
                </Label>
                <Input
                  value={formLocation}
                  onChange={e => setFormLocation(e.target.value)}
                  placeholder="เช่น โรง 3, อาคาร B..."
                  className="h-9 text-xs mt-1 bg-white border-slate-300 text-slate-900 font-normal"
                />
              </div>

              {/* Active checkbox */}
              <label
                htmlFor="modal_m_act_active"
                className="flex items-center justify-between p-2.5 rounded-lg border border-slate-300 bg-slate-50 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="modal_m_act_active"
                    checked={formActive}
                    onCheckedChange={v => setFormActive(!!v)}
                  />
                  <span className="text-xs font-semibold text-slate-900">
                    เปิดใช้งานกิจกรรมนี้
                  </span>
                </div>
              </label>
            </div>

            <DialogFooter className="pt-2 border-t border-slate-200 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDialogOpen(false)}
                className="h-8 px-3 text-xs bg-white text-slate-700 border-slate-300 font-normal"
              >
                ยกเลิก
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={saving}
                className="h-8 px-4 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'บันทึก'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
