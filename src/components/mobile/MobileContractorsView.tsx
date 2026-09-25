'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Contractor, Company } from '@/lib/types'
import { getContractorAlcRisk, getContractorDailyWage, cleanContractorPosition } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import {
  HardHat, Plus, Search, Phone, Pencil, Trash2,
  RefreshCw, CheckCircle2, XCircle, AlertTriangle,
  Coins, ChevronDown, Loader2
} from 'lucide-react'

const POSITION_PRESETS = [
  'ช่างไฟฟ้า',
  'ช่างเชื่อม',
  'ช่างแอร์',
  'ช่างสี',
  'ช่างปูน/กระเบื้อง',
  'ช่างยนต์/เครื่องกล',
  'โฟร์แมน',
  'วิศวกร',
  'จป.วิชาชีพ',
  'ช่างทั่วไป',
]

interface ContractorFormData {
  name: string
  company_id: string
  company_name: string
  employee_type: 'contractor'
  position: string
  phone: string
  daily_wage: string
  alc_risk: boolean
  is_active: boolean
}

const defaultForm: ContractorFormData = {
  name: '',
  company_id: '',
  company_name: '',
  employee_type: 'contractor',
  position: '',
  phone: '',
  daily_wage: '',
  alc_risk: false,
  is_active: true,
}

export function MobileContractorsView() {
  const supabase = useMemo(() => createClient(), [])
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [companyFilter, setCompanyFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  // Modal State
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [formData, setFormData] = useState<ContractorFormData>(defaultForm)
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true)
    else setRefreshing(true)

    try {
      const [{ data: cData, error: cErr }, { data: coData, error: coErr }] = await Promise.all([
        supabase.from('contractors').select('*').order('name'),
        supabase.from('companies').select('*').order('name'),
      ])

      if (cErr) throw cErr
      if (coErr) throw coErr

      setContractors(cData ?? [])
      setCompanies(coData ?? [])
    } catch (err: unknown) {
      console.error('Fetch contractors mobile error:', err)
      toast.error('ไม่สามารถโหลดข้อมูลช่างได้')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const stats = useMemo(() => {
    const list = contractors.filter(c => c.employee_type !== 'employee')
    const total = list.length
    const active = list.filter(c => c.is_active).length
    const inactive = total - active
    const alcRisk = list.filter(c => getContractorAlcRisk(c)).length
    return { total, active, inactive, alcRisk }
  }, [contractors])

  const filtered = useMemo(() => {
    return contractors
      .filter(c => c.employee_type !== 'employee')
      .filter(c => {
        if (statusFilter === 'active' && !c.is_active) return false
        if (statusFilter === 'inactive' && c.is_active) return false
        if (companyFilter !== 'all' && c.company_id !== companyFilter) return false

        if (search.trim()) {
          const q = search.toLowerCase()
          const nameMatch = c.name.toLowerCase().includes(q)
          const compMatch = (c.company_name ?? '').toLowerCase().includes(q)
          const posMatch = (c.position ?? '').toLowerCase().includes(q)
          const phoneMatch = (c.phone ?? '').toLowerCase().includes(q)
          if (!nameMatch && !compMatch && !posMatch && !phoneMatch) return false
        }
        return true
      })
  }, [contractors, statusFilter, companyFilter, search])

  const openCreate = () => {
    setEditId(null)
    setFormData(defaultForm)
    setDialogOpen(true)
  }

  const openEdit = (c: Contractor) => {
    setEditId(c.id)
    const wage = getContractorDailyWage(c)
    setFormData({
      name: c.name,
      company_id: c.company_id ?? '',
      company_name: c.company_name ?? '',
      employee_type: 'contractor',
      position: cleanContractorPosition(c.position),
      phone: c.phone ?? '',
      daily_wage: wage ? String(wage) : '',
      alc_risk: getContractorAlcRisk(c),
      is_active: c.is_active,
    })
    setDialogOpen(true)
  }

  const handleCompanySelect = (coId: string) => {
    if (!coId || coId === '__none__') {
      setFormData(prev => ({ ...prev, company_id: '', company_name: '' }))
    } else {
      const co = companies.find(c => c.id === coId)
      setFormData(prev => ({ ...prev, company_id: coId, company_name: co?.name ?? '' }))
    }
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('กรุณากรอกชื่อช่าง')
      return
    }

    setSaving(true)
    const wageNum = formData.daily_wage ? parseFloat(formData.daily_wage) : null
    const cleanPos = formData.position.trim()

    let embeddedPos = cleanPos
    if (formData.alc_risk) embeddedPos += ' [เสี่ยง ALC]'
    if (wageNum) embeddedPos += ` [ค่าแรง:${wageNum}]`

    const payloadFull: any = {
      name: formData.name.trim(),
      company_id: formData.company_id || null,
      company_name: formData.company_name.trim() || null,
      employee_type: 'contractor',
      position: cleanPos || null,
      phone: formData.phone.trim() || null,
      daily_wage: wageNum,
      alc_risk: formData.alc_risk,
      is_active: formData.is_active,
      updated_at: new Date().toISOString(),
    }

    const payloadFallback: any = {
      name: formData.name.trim(),
      company_id: formData.company_id || null,
      company_name: formData.company_name.trim() || null,
      employee_type: 'contractor',
      position: embeddedPos.trim() || null,
      phone: formData.phone.trim() || null,
      is_active: formData.is_active,
      updated_at: new Date().toISOString(),
    }

    try {
      if (editId) {
        let res = await supabase.from('contractors').update(payloadFull).eq('id', editId)
        if (res.error && res.error.code === 'PGRST204') {
          res = await supabase.from('contractors').update(payloadFallback).eq('id', editId)
        }
        if (res.error) throw res.error
        toast.success('แก้ไขข้อมูลช่างเรียบร้อยแล้ว')
      } else {
        let res = await supabase.from('contractors').insert(payloadFull)
        if (res.error && res.error.code === 'PGRST204') {
          res = await supabase.from('contractors').insert(payloadFallback)
        }
        if (res.error) throw res.error
        toast.success('เพิ่มช่างเรียบร้อยแล้ว')
      }

      setDialogOpen(false)
      fetchData(true)
    } catch (err: unknown) {
      console.error('Save contractor error:', err)
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'
      toast.error('บันทึกไม่สำเร็จ', { description: msg })
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (c: Contractor) => {
    const nextActive = !c.is_active
    try {
      const { error } = await supabase
        .from('contractors')
        .update({ is_active: nextActive, updated_at: new Date().toISOString() })
        .eq('id', c.id)

      if (error) throw error
      setContractors(prev =>
        prev.map(item => (item.id === c.id ? { ...item, is_active: nextActive } : item))
      )
      toast.success(nextActive ? `เปิดใช้งาน ${c.name}` : `ปิดใช้งาน ${c.name}`)
    } catch {
      toast.error('ไม่สามารถเปลี่ยนสถานะได้')
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`ต้องการลบ "${name}" ออกจากระบบหรือไม่?`)) return
    try {
      const { error } = await supabase.from('contractors').delete().eq('id', id)
      if (error) throw error
      toast.success(`ลบ "${name}" แล้ว`)
      setContractors(prev => prev.filter(c => c.id !== id))
    } catch {
      toast.error('ลบไม่สำเร็จ')
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full bg-slate-100 overflow-hidden">
      {/* ── Mobile Header (Premium Dark Gradient) ── */}
      <header className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-white px-3.5 py-2.5 shrink-0 flex items-center justify-between border-b border-slate-800 shadow-md">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 border border-amber-400/30 flex items-center justify-center text-white shadow-sm shrink-0">
            <HardHat className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold tracking-tight text-white truncate leading-tight">
              จัดการช่าง / รับเหมา
            </h1>
            <p className="text-xs text-slate-300 font-normal leading-tight mt-0.5">
              ทั้งหมด <span className="font-semibold text-white">{stats.total}</span> คน (<span className="font-semibold text-emerald-400">{stats.active}</span> พร้อมงาน)
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
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing || loading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
          <Button
            size="sm"
            onClick={openCreate}
            className="h-8 px-3 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold shadow-sm border border-amber-300/40 gap-1 active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>เพิ่มช่าง</span>
          </Button>
        </div>
      </header>

      {/* ── Filter Bar (Height h-9 for Search & Controls) ── */}
      <div className="bg-white p-2.5 border-b border-slate-300 shadow-2xs space-y-2 shrink-0">
        {/* Quick Status Tabs + Company Selector (h-9) */}
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs border border-slate-300">
            <button
              onClick={() => setStatusFilter('all')}
              className={`h-8 px-2.5 rounded text-xs transition-all flex items-center ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-950 font-semibold shadow-2xs'
                  : 'text-slate-700 hover:text-slate-950 font-normal'
              }`}
            >
              ทั้งหมด ({stats.total})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`h-8 px-2.5 rounded text-xs transition-all flex items-center gap-1 ${
                statusFilter === 'active'
                  ? 'bg-emerald-600 text-white font-semibold shadow-2xs'
                  : 'text-emerald-800 hover:text-emerald-950 font-normal'
              }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              พร้อม ({stats.active})
            </button>
            {stats.inactive > 0 && (
              <button
                onClick={() => setStatusFilter('inactive')}
                className={`h-8 px-2.5 rounded text-xs transition-all flex items-center gap-1 ${
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

          {/* Company Filter Dropdown (h-9) */}
          <div className="relative">
            <select
              value={companyFilter}
              onChange={e => setCompanyFilter(e.target.value)}
              className="text-xs h-9 pl-2.5 pr-6 rounded-lg border border-slate-300 bg-white text-slate-900 font-normal focus:outline-none focus:ring-1 focus:ring-amber-500 appearance-none max-w-[140px] truncate"
            >
              <option value="all">ทุกสังกัด</option>
              {companies.map(co => (
                <option key={co.id} value={co.id}>
                  {co.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-600 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Search Input (h-9) */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            type="search"
            placeholder="ค้นหาชื่อช่าง, ตำแหน่ง, เบอร์โทร..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-9 text-xs pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 font-normal focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder:text-slate-500"
          />
        </div>

        {/* High Contrast ALC Risk summary banner if any */}
        {stats.alcRisk > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-100 border border-amber-300 text-xs text-amber-950 font-semibold">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span>กลุ่มเสี่ยง ALC: {stats.alcRisk} คน (มีแถบเตือนสีเหลืองใน Checklist)</span>
          </div>
        )}
      </div>

      {/* ── Contractor Card List (mini-Compact Layout) ── */}
      <div className="flex-1 overflow-y-auto min-h-0 p-2 space-y-2">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
            <span className="text-xs font-normal">กำลังโหลดรายชื่อช่าง...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-300 p-8 text-center flex flex-col items-center justify-center gap-2">
            <HardHat className="w-10 h-10 stroke-1 text-slate-400" />
            <p className="text-xs font-semibold text-slate-900">ไม่พบข้อมูลช่าง</p>
            <Button
              size="sm"
              onClick={openCreate}
              className="h-8 text-xs bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> เพิ่มช่างคนแรก
            </Button>
          </div>
        ) : (
          filtered.map(c => {
            const hasAlcRisk = getContractorAlcRisk(c)
            const wage = getContractorDailyWage(c)
            const displayPos = cleanContractorPosition(c.position)

            return (
              <div
                key={c.id}
                className={`bg-white rounded-xl border p-2.5 shadow-2xs space-y-2 transition-all ${
                  !c.is_active
                    ? 'opacity-70 bg-slate-50 border-slate-300'
                    : hasAlcRisk
                    ? 'border-amber-400 bg-amber-50/40'
                    : 'border-slate-300 hover:border-slate-400'
                }`}
              >
                {/* Top Row: Avatar, Name, Company, Action Icons */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                        !c.is_active
                          ? 'bg-slate-200 text-slate-700 border border-slate-300'
                          : hasAlcRisk
                          ? 'bg-amber-200 text-amber-950 border border-amber-400'
                          : 'bg-amber-100 text-amber-950 border border-amber-300'
                      }`}
                    >
                      {c.name.trim().charAt(0) || <HardHat className="w-4 h-4" />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h2 className="text-xs font-semibold text-slate-900 truncate leading-tight">
                          {c.name}
                        </h2>
                        {hasAlcRisk && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-950 border border-amber-400 font-bold text-xs flex items-center gap-0.5">
                            <AlertTriangle className="w-3 h-3 text-amber-700" /> เสี่ยง ALC
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-slate-700 font-normal mt-0.5">
                        {c.company_name ? (
                          <span className="bg-slate-100 text-slate-900 border border-slate-300 px-1.5 py-0.2 rounded truncate max-w-[140px] font-normal">
                            {c.company_name}
                          </span>
                        ) : (
                          <span className="italic text-slate-500 font-normal">รับจ้างอิสระ</span>
                        )}
                        {displayPos && <span className="text-slate-600 font-normal">• {displayPos}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Actions (Edit / Delete) */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(c)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:text-blue-700 hover:bg-slate-100 transition-colors"
                      title="แก้ไข"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(c.id, c.name)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                      title="ลบ"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Bottom Row: Wage, Phone, Status Switch */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200 text-xs">
                  {/* Wage & Phone */}
                  <div className="flex items-center gap-2">
                    {wage ? (
                      <span className="text-slate-900 font-semibold flex items-center gap-1 text-xs bg-slate-100 border border-slate-300 px-2 py-0.5 rounded">
                        <Coins className="w-3.5 h-3.5 text-amber-700" /> ฿{wage.toLocaleString()}/วัน
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500 font-normal">ไม่ระบุค่าแรง</span>
                    )}

                    {c.phone && (
                      <a
                        href={`tel:${c.phone}`}
                        className="text-blue-800 font-semibold text-xs flex items-center gap-1 hover:underline bg-blue-50 px-2 py-0.5 rounded border border-blue-300"
                      >
                        <Phone className="w-3 h-3" />
                        {c.phone}
                      </a>
                    )}
                  </div>

                  {/* Status Toggle Button */}
                  <button
                    onClick={() => handleToggleActive(c)}
                    className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border transition-all ${
                      c.is_active
                        ? 'bg-emerald-100 text-emerald-950 border-emerald-400 hover:bg-emerald-200'
                        : 'bg-slate-200 text-slate-800 border-slate-300 hover:bg-slate-300'
                    }`}
                  >
                    {c.is_active ? '● พร้อมงาน' : '○ ปิดใช้งาน'}
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* ── Dialog Form for Add & Edit Contractor ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm p-4 bg-white rounded-2xl shadow-xl border border-slate-300 max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-2 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                <HardHat className="w-4 h-4" />
              </div>
              <DialogTitle className="text-sm font-bold text-slate-900">
                {editId ? 'แก้ไขข้อมูลช่าง' : 'เพิ่มช่างใหม่'}
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            {/* Name */}
            <div>
              <Label className="text-xs font-semibold text-slate-800">ชื่อ - นามสกุล *</Label>
              <Input
                value={formData.name}
                onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                placeholder="เช่น นายสมชาย ใจดี"
                className="h-9 text-xs mt-1 bg-white border-slate-300 text-slate-900 font-normal"
                autoFocus
              />
            </div>

            {/* Company Select */}
            <div>
              <Label className="text-xs font-semibold text-slate-800">สังกัด / บริษัท</Label>
              <div className="relative mt-1">
                <select
                  value={formData.company_id || ''}
                  onChange={e => handleCompanySelect(e.target.value)}
                  className="w-full h-9 px-2.5 pr-8 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 font-normal appearance-none"
                >
                  <option value="">-- รับจ้างอิสระ / ไม่ระบุ --</option>
                  {companies.map(co => (
                    <option key={co.id} value={co.id}>
                      {co.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Position + Preset Chips */}
            <div>
              <Label className="text-xs font-semibold text-slate-800">ตำแหน่ง / ความชำนาญ</Label>
              <Input
                value={formData.position}
                onChange={e => setFormData(p => ({ ...p, position: e.target.value }))}
                placeholder="เช่น ช่างไฟฟ้า, ช่างเชื่อม..."
                className="h-9 text-xs mt-1 bg-white border-slate-300 text-slate-900 font-normal"
              />
              <div className="flex flex-wrap gap-1.5 mt-1.5 max-h-20 overflow-y-auto">
                {POSITION_PRESETS.map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setFormData(p => ({ ...p, position: preset }))}
                    className={`text-xs px-2 py-0.5 rounded border transition-all ${
                      formData.position === preset
                        ? 'bg-amber-600 text-white font-semibold border-amber-600'
                        : 'bg-slate-50 border-slate-300 text-slate-800 hover:bg-slate-100 font-normal'
                    }`}
                  >
                    + {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Wage & Phone */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold text-slate-800">ค่าแรง (บาท/วัน)</Label>
                <Input
                  type="number"
                  value={formData.daily_wage}
                  onChange={e => setFormData(p => ({ ...p, daily_wage: e.target.value }))}
                  placeholder="เช่น 500"
                  className="h-9 text-xs mt-1 bg-white border-slate-300 text-slate-900 font-normal"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-800">เบอร์โทรศัพท์</Label>
                <Input
                  type="tel"
                  value={formData.phone}
                  onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                  placeholder="081-xxx-xxxx"
                  className="h-9 text-xs mt-1 bg-white border-slate-300 text-slate-900 font-normal"
                />
              </div>
            </div>

            {/* ALC Risk checkbox */}
            <label
              htmlFor="modal_m_alc"
              className="flex items-center justify-between p-2.5 rounded-lg border border-amber-300 bg-amber-50 cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Checkbox
                  id="modal_m_alc"
                  checked={formData.alc_risk}
                  onCheckedChange={v => setFormData(p => ({ ...p, alc_risk: !!v }))}
                />
                <div>
                  <p className="text-xs font-semibold text-amber-950 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-700" /> เสี่ยง ALC (แอลกอฮอล์)
                  </p>
                  <p className="text-xs text-amber-900 font-normal">แสดงแถบเตือนสีเหลืองใน Checklist</p>
                </div>
              </div>
            </label>

            {/* Active checkbox */}
            <label
              htmlFor="modal_m_active"
              className="flex items-center justify-between p-2.5 rounded-lg border border-slate-300 bg-slate-50 cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Checkbox
                  id="modal_m_active"
                  checked={formData.is_active}
                  onCheckedChange={v => setFormData(p => ({ ...p, is_active: !!v }))}
                />
                <span className="text-xs font-semibold text-slate-900">
                  เปิดใช้งาน (พร้อมปฏิบัติงาน)
                </span>
              </div>
            </label>
          </div>

          <DialogFooter className="pt-2 border-t border-slate-200 flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogOpen(false)}
              className="h-8 px-3 text-xs bg-white text-slate-700 border-slate-300 font-normal"
            >
              ยกเลิก
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="h-8 px-4 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
