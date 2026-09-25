'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Contractor, Company } from '@/lib/types'
import { getContractorAlcRisk, getContractorDailyWage, cleanContractorPosition } from '@/lib/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import {
  HardHat, Phone, Plus, Pencil, Trash2, Search,
  Loader2, RefreshCw, ChevronDown, CheckCircle2, XCircle, AlertTriangle, Coins
} from 'lucide-react'

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

// Quick presets for common construction & technician roles
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

export default function ContractorsPage() {
  const supabase = useMemo(() => createClient(), [])
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Filters & State
  const [search, setSearch] = useState('')
  const [companyFilter, setCompanyFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  // Dialog State
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
      console.error('Fetch contractors error:', err)
      const message = err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลได้'
      toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล', { description: message })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Statistics calculation (ช่าง / ผู้รับเหมา)
  const stats = useMemo(() => {
    const technicianList = contractors.filter(c => c.employee_type !== 'employee')
    const total = technicianList.length
    const active = technicianList.filter(c => c.is_active).length
    const inactive = total - active
    const withCompany = technicianList.filter(c => !!c.company_name).length
    const alcRiskCount = technicianList.filter(c => getContractorAlcRisk(c)).length
    return { total, active, inactive, withCompany, alcRiskCount }
  }, [contractors])

  // Filtered List (เอาพนักงานประจำออก)
  const filteredList = useMemo(() => {
    return contractors
      .filter(c => c.employee_type !== 'employee')
      .filter(c => {
        // Status filter
        if (statusFilter === 'active' && !c.is_active) return false
        if (statusFilter === 'inactive' && c.is_active) return false

        // Company filter
        if (companyFilter !== 'all' && c.company_id !== companyFilter) return false

        // Search term
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

  // Open Create Dialog
  const openCreate = () => {
    setEditId(null)
    setFormData(defaultForm)
    setDialogOpen(true)
  }

  // Open Edit Dialog
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

  const handleCompanySelect = (companyId: string) => {
    if (companyId === '__none__') {
      setFormData(prev => ({ ...prev, company_id: '', company_name: '' }))
    } else {
      const co = companies.find(c => c.id === companyId)
      setFormData(prev => ({ ...prev, company_id: companyId, company_name: co?.name ?? '' }))
    }
  }

  // Save (Create or Update)
  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('กรุณากรอกชื่อ-นามสกุล')
      return
    }

    setSaving(true)
    const wageNum = formData.daily_wage ? parseFloat(formData.daily_wage) : null
    const cleanPos = formData.position.trim()
    
    // Construct position with embedded tags if DB columns don't exist
    let embeddedPos = cleanPos
    if (formData.alc_risk) embeddedPos += ' [เสี่ยง ALC]'
    if (wageNum) embeddedPos += ` [ค่าแรง:${wageNum}]`

    const payloadWithColumns: any = {
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
        let res = await supabase.from('contractors').update(payloadWithColumns).eq('id', editId)
        if (res.error && res.error.code === 'PGRST204') {
          res = await supabase.from('contractors').update(payloadFallback).eq('id', editId)
        }
        if (res.error) throw res.error
        toast.success('แก้ไขข้อมูลช่างเรียบร้อยแล้ว')
      } else {
        let res = await supabase.from('contractors').insert(payloadWithColumns)
        if (res.error && res.error.code === 'PGRST204') {
          res = await supabase.from('contractors').insert(payloadFallback)
        }
        if (res.error) throw res.error
        toast.success('เพิ่มข้อมูลช่างเรียบร้อยแล้ว')
      }

      setDialogOpen(false)
      fetchData(true)
    } catch (err: unknown) {
      console.error('Save contractor error:', err)
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'
      toast.error('บันทึกไม่สำเร็จ', { description: message })
    } finally {
      setSaving(false)
    }
  }

  // Toggle is_active status directly
  const handleToggleActive = async (c: Contractor) => {
    try {
      const nextActive = !c.is_active
      const { error } = await supabase
        .from('contractors')
        .update({ is_active: nextActive, updated_at: new Date().toISOString() })
        .eq('id', c.id)

      if (error) throw error
      setContractors(prev => prev.map(item => item.id === c.id ? { ...item, is_active: nextActive } : item))
      toast.success(nextActive ? `เปิดใช้งาน ${c.name} แล้ว` : `ปิดการใช้งาน ${c.name} แล้ว`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'
      toast.error('ไม่สามารถเปลี่ยนสถานะได้', { description: message })
    }
  }

  // Delete
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`ต้องการลบ "${name}" ออกจากระบบหรือไม่?`)) return

    try {
      const { error } = await supabase.from('contractors').delete().eq('id', id)
      if (error) throw error
      toast.success(`ลบ "${name}" สำเร็จ`)
      setContractors(prev => prev.filter(c => c.id !== id))
    } catch (err: unknown) {
      console.error('Delete contractor error:', err)
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'
      toast.error('ลบไม่สำเร็จ', { description: message })
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full gap-2 overflow-hidden">
      {/* ── Compact Top Controls Bar ── */}
      <div className="p-2 bg-white rounded-lg border border-slate-300 shadow-2xs flex flex-wrap items-center justify-between gap-2 shrink-0">
        
        {/* Left: Title & Quick Status Filter Badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-amber-50 text-amber-800 text-xs font-bold border border-amber-200">
            <HardHat className="w-3.5 h-3.5 text-amber-600" />
            <span>จัดการช่าง / ผู้รับเหมา</span>
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
              พร้อมปฏิบัติงาน ({stats.active})
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

        {/* Right: Company Select + Search + Refresh + Add */}
        <div className="flex items-center gap-1.5 ml-auto flex-wrap">
          {/* Company filter */}
          <div className="relative">
            <select
              value={companyFilter}
              onChange={e => setCompanyFilter(e.target.value)}
              className="text-xs h-7 pl-2 pr-6 rounded border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500 appearance-none cursor-pointer"
            >
              <option value="all">ทุกสังกัด / บริษัท</option>
              {companies.map(co => (
                <option key={co.id} value={co.id}>
                  {co.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Search box */}
          <div className="relative w-44 sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="search"
              placeholder="ค้นหาชื่อ, ตำแหน่ง, เบอร์..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full text-xs pl-8 pr-2.5 py-1 rounded border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
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
            className="h-7 px-2.5 text-xs bg-amber-600 hover:bg-amber-700 text-white font-medium shadow-2xs gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>เพิ่มช่าง</span>
          </Button>
        </div>
      </div>

      {/* ── Table Container (Spreadsheet Grid) ── */}
      <div className="border border-slate-300 rounded-lg overflow-hidden bg-white shadow-2xs flex-1 min-h-0 flex flex-col h-full">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
            <span className="text-xs">กำลังโหลดข้อมูลช่าง...</span>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-400 p-4">
            <HardHat className="w-8 h-8 stroke-1 text-slate-300" />
            <span className="text-xs font-medium text-slate-500">
              {search || companyFilter !== 'all' || statusFilter !== 'all'
                ? 'ไม่พบข้อมูลที่ตรงกับเงื่อนไขการค้นหา'
                : 'ยังไม่มีข้อมูลช่างในระบบ'}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={openCreate}
              className="h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> เพิ่มช่างคนแรก
            </Button>
          </div>
        ) : (
          <div className="flex-1 overflow-auto min-h-0 scrollbar-thin">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-slate-100 z-10 select-none">
                <tr className="text-[11px] font-bold text-slate-900 border-b border-slate-300">
                  <th className="py-2 px-2.5 text-center w-12 border-r border-slate-300">#</th>
                  <th className="py-2 px-3 border-r border-slate-300">ชื่อ - นามสกุล</th>
                  <th className="py-2 px-3 border-r border-slate-300">สังกัด / บริษัท</th>
                  <th className="py-2 px-3 border-r border-slate-300">ตำแหน่ง / ความชำนาญ</th>
                  <th className="py-2 px-3 text-right border-r border-slate-300">ค่าแรง (บาท/วัน)</th>
                  <th className="py-2 px-3 text-center border-r border-slate-300">ความเสี่ยง ALC</th>
                  <th className="py-2 px-3 border-r border-slate-300">เบอร์ติดต่อ</th>
                  <th className="py-2 px-3 text-center min-w-[130px] border-r border-slate-300 whitespace-nowrap">สถานะ</th>
                  <th className="py-2 px-2.5 text-center w-20">จัดการ</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-slate-200">
                {filteredList.map((c, idx) => {
                  const hasAlcRisk = getContractorAlcRisk(c)
                  const wage = getContractorDailyWage(c)
                  const displayPosition = cleanContractorPosition(c.position)

                  return (
                    <tr
                      key={c.id}
                      className={`hover:bg-amber-50/40 transition-colors ${
                        !c.is_active ? 'bg-slate-50/70 text-slate-400' : 'text-slate-800'
                      }`}
                    >
                      {/* Index */}
                      <td className="py-1.5 px-2.5 text-center text-[11px] text-slate-800 font-normal border-r border-slate-200">
                        {idx + 1}
                      </td>

                      {/* Full Name */}
                      <td className={`py-1.5 px-3 border-r border-slate-200 ${hasAlcRisk ? 'bg-amber-100/70' : ''}`}>
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-[11px] shrink-0 ${
                              !c.is_active
                                ? 'bg-slate-200 text-slate-600'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {c.name.trim().charAt(0) || '?'}
                          </div>
                          <span className={c.is_active ? 'text-slate-950 font-normal' : 'text-slate-500 font-normal'}>
                            {c.name}
                          </span>
                        </div>
                      </td>

                      {/* Company */}
                      <td className="py-1.5 px-3 border-r border-slate-200 font-normal">
                        {c.company_name ? (
                          <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-300 text-[11px] font-normal">
                            {c.company_name}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px] italic">รับจ้างอิสระ</span>
                        )}
                      </td>

                      {/* Position */}
                      <td className="py-1.5 px-3 border-r border-slate-200">
                        <span className="font-normal text-slate-800">
                          {displayPosition || '-'}
                        </span>
                      </td>

                      {/* Wage */}
                      <td className="py-1.5 px-3 border-r border-slate-200 text-right font-mono text-[11px]">
                        {wage ? (
                          <span className="font-semibold text-slate-950">฿{wage.toLocaleString()}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* ALC Risk */}
                      <td className="py-1.5 px-3 border-r border-slate-200 text-center">
                        {hasAlcRisk ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[10px] inline-flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-amber-700" />
                            เสี่ยง ALC
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-medium">
                            ✓ ปกติ
                          </span>
                        )}
                      </td>

                      {/* Phone */}
                      <td className="py-1.5 px-3 border-r border-slate-200 font-mono text-[11px]">
                        {c.phone ? (
                          <a
                            href={`tel:${c.phone}`}
                            className="text-blue-700 hover:underline flex items-center gap-1 font-normal"
                          >
                            <Phone className="w-3 h-3 text-slate-500" />
                            <span>{c.phone}</span>
                          </a>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Status Toggle */}
                      <td className="py-1.5 px-3 text-center border-r border-slate-200 whitespace-nowrap">
                        <button
                          onClick={() => handleToggleActive(c)}
                          className={`inline-flex items-center justify-center text-[11px] font-medium px-2.5 py-0.5 rounded-full cursor-pointer transition-colors whitespace-nowrap border ${
                            c.is_active
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-400 hover:bg-emerald-200'
                              : 'bg-slate-200 text-slate-800 border-slate-400 hover:bg-slate-300'
                          }`}
                          title="คลิกเพื่อสลับสถานะ"
                        >
                          {c.is_active ? 'พร้อมปฏิบัติงาน' : 'ปิดใช้งาน'}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-1.5 px-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEdit(c)}
                            className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 text-slate-500 hover:text-blue-600 transition-colors"
                            title="แก้ไขข้อมูล"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(c.id, c.name)}
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
            แสดง <span className="font-semibold text-slate-700">{filteredList.length}</span> จากทั้งหมด{' '}
            <span className="font-semibold text-slate-700">{stats.total}</span> คน
            {companyFilter !== 'all' && ' (กรองตามบริษัท)'}
          </div>
          <div className="flex items-center gap-3">
            {stats.alcRiskCount > 0 && (
              <span className="flex items-center gap-1 text-amber-900 font-semibold">
                <AlertTriangle className="w-3 h-3 text-amber-600" />
                กลุ่มเสี่ยง ALC {stats.alcRiskCount} คน
              </span>
            )}
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              พร้อมงาน {stats.active} คน
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
              ปิดใช้งาน {stats.inactive} คน
            </span>
          </div>
        </div>
      </div>

      {/* ── Dialog: Add & Edit Contractor / Technician ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md p-5 bg-white rounded-xl shadow-xl border border-slate-200">
          <DialogHeader className="pb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold shrink-0 bg-amber-100 text-amber-700">
                <HardHat className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-sm font-bold text-slate-900">
                  {editId ? 'แก้ไขข้อมูลช่าง / ผู้รับเหมา' : 'เพิ่มข้อมูลช่าง / ผู้รับเหมา'}
                </DialogTitle>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  ระบุข้อมูลช่างสำหรับตรวจเช็คชื่อและ PPE หน้างาน
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            {/* Name */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">ชื่อ - นามสกุล *</Label>
              <Input
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="เช่น นายสมชาย ใจดี"
                className="h-8 text-xs bg-white border-slate-300 font-medium text-slate-900"
                autoFocus
              />
            </div>

            {/* Company / Department */}
            <div className="space-y-1">
              <Label htmlFor="modal_company" className="text-xs font-semibold text-slate-700">
                สังกัด / บริษัท
              </Label>
              <div className="relative">
                <select
                  id="modal_company"
                  value={formData.company_id || ''}
                  onChange={e => handleCompanySelect(e.target.value || '__none__')}
                  className="w-full h-8 px-2.5 pr-8 rounded-md border border-slate-300 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 appearance-none cursor-pointer"
                >
                  <option value="">-- ไม่ระบุ / รับจ้างอิสระ --</option>
                  {companies.map(co => (
                    <option key={co.id} value={co.id}>
                      {co.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Position with quick preset chips */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">
                ตำแหน่ง / สายงานช่าง
              </Label>
              <Input
                value={formData.position}
                onChange={e => setFormData(prev => ({ ...prev, position: e.target.value }))}
                placeholder="เช่น ช่างไฟฟ้า, ช่างเชื่อม..."
                className="h-8 text-xs bg-white border-slate-300 text-slate-900"
              />
              <div className="flex flex-wrap gap-1 pt-0.5">
                {POSITION_PRESETS.map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, position: preset }))}
                    className={`text-[10px] px-2 py-0.5 rounded border transition-all cursor-pointer ${
                      formData.position === preset
                        ? 'bg-amber-600 border-amber-600 text-white font-semibold'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300'
                    }`}
                  >
                    + {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Wage & Phone in 2 Columns */}
            <div className="grid grid-cols-2 gap-2">
              {/* Daily Wage */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <Coins className="w-3 h-3 text-amber-600" />
                  ค่าแรง (บาท/วัน)
                </Label>
                <Input
                  value={formData.daily_wage}
                  onChange={e => setFormData(prev => ({ ...prev, daily_wage: e.target.value }))}
                  placeholder="เช่น 500"
                  className="h-8 text-xs bg-white border-slate-300 text-slate-900"
                  type="number"
                  min="0"
                />
              </div>

              {/* Phone */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">เบอร์โทรศัพท์</Label>
                <Input
                  value={formData.phone}
                  onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="เช่น 081-234-5678"
                  className="h-8 text-xs bg-white border-slate-300 text-slate-900"
                  type="tel"
                />
              </div>
            </div>

            {/* ALC Risk Toggle */}
            <label
              htmlFor="modal_alc_risk"
              className="flex items-center justify-between p-2 rounded-lg border border-amber-200 bg-amber-50/60 hover:bg-amber-100/60 cursor-pointer transition-all"
            >
              <div className="flex items-center gap-2">
                <Checkbox
                  id="modal_alc_risk"
                  checked={formData.alc_risk}
                  onCheckedChange={v => setFormData(prev => ({ ...prev, alc_risk: !!v }))}
                />
                <div>
                  <p className="text-xs font-semibold text-amber-950 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                    ความเสี่ยง ALC (แอลกอฮอล์)
                  </p>
                  <p className="text-[10px] text-amber-800">
                    หากติ๊กถูก จะมีแถบพื้นหลังสีเหลืองเตือนในตาราง Checklist
                  </p>
                </div>
              </div>
              <Badge
                variant="outline"
                className={
                  formData.alc_risk
                    ? 'bg-amber-100 text-amber-900 border-amber-300 text-[10px] font-bold'
                    : 'bg-white text-slate-500 border-slate-200 text-[10px]'
                }
              >
                {formData.alc_risk ? 'มีประวัติเสี่ยง' : 'ปกติ'}
              </Badge>
            </label>

            {/* Active Toggle */}
            <label
              htmlFor="modal_is_active"
              className="flex items-center justify-between p-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer transition-all"
            >
              <div className="flex items-center gap-2">
                <Checkbox
                  id="modal_is_active"
                  checked={formData.is_active}
                  onCheckedChange={v => setFormData(prev => ({ ...prev, is_active: !!v }))}
                />
                <div>
                  <p className="text-xs font-semibold text-slate-800">เปิดใช้งาน (Active)</p>
                  <p className="text-[10px] text-slate-400">แสดงในตาราง Checklist หน้างาน</p>
                </div>
              </div>
              <Badge
                variant="outline"
                className={
                  formData.is_active
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]'
                    : 'bg-slate-100 text-slate-500 text-[10px]'
                }
              >
                {formData.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </label>
          </div>

          <DialogFooter className="pt-2.5 border-t border-slate-100 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
              className="h-8 px-3 text-xs bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
            >
              ยกเลิก
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="h-8 px-4 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 shadow-2xs"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> กำลังบันทึก...
                </>
              ) : (
                editId ? 'บันทึกการแก้ไข' : 'บันทึกข้อมูล'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
