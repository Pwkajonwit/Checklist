'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Contractor, Company, ContractorDocuments } from '@/lib/types'
import {
  getContractorAlcRisk,
  getContractorDailyWage,
  cleanContractorPosition,
  getContractorCertifications,
  getContractorDocuments,
  getTrainingExpiryStatus,
  getDocumentStats,
  formatContractorPositionPayload,
  REQUIRED_DOCUMENT_LIST,
  DEFAULT_CONTRACTOR_DOCUMENTS,
} from '@/lib/types'
import { formatDateDisplay } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import {
  HardHat, Plus, Search, Phone, Pencil, Trash2,
  RefreshCw, CheckCircle2, XCircle, AlertTriangle,
  Coins, ChevronDown, Loader2, Award, FileText, Check, X,
  IdCard, Home, Stethoscope, ShieldCheck
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

const DOC_ICONS: Record<string, typeof IdCard> = {
  id_card: IdCard,
  house_reg: Home,
  medical_cert: Stethoscope,
  social_security: ShieldCheck,
  consent_form: FileText,
}

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
  insee_training_exp: string
  boomlift_training_exp: string
  documents: ContractorDocuments
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
  insee_training_exp: '',
  boomlift_training_exp: '',
  documents: { ...DEFAULT_CONTRACTOR_DOCUMENTS },
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
    setFormData({
      ...defaultForm,
      documents: { ...DEFAULT_CONTRACTOR_DOCUMENTS },
    })
    setDialogOpen(true)
  }

  const openEdit = (c: Contractor) => {
    setEditId(c.id)
    const wage = getContractorDailyWage(c)
    const certs = getContractorCertifications(c)
    const docs = getContractorDocuments(c)
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
      insee_training_exp: certs.insee_training_exp ?? '',
      boomlift_training_exp: certs.boomlift_training_exp ?? '',
      documents: docs,
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

    const embeddedPos = formatContractorPositionPayload(cleanPos, {
      dailyWage: wageNum,
      alcRisk: formData.alc_risk,
      certifications: {
        insee_training_exp: formData.insee_training_exp || null,
        boomlift_training_exp: formData.boomlift_training_exp || null,
      },
      documents: formData.documents,
    })

    const payloadFull: any = {
      name: formData.name.trim(),
      company_id: formData.company_id || null,
      company_name: formData.company_name.trim() || null,
      employee_type: 'contractor',
      position: embeddedPos || cleanPos || null,
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
      position: embeddedPos?.trim() || null,
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
      setContractors(prev => prev.filter(c => c.id !== id))
      toast.success(`ลบ "${name}" สำเร็จ`)
    } catch {
      toast.error('ลบไม่สำเร็จ')
    }
  }

  // Document Helpers inside dialog
  const dialogDocStats = useMemo(() => {
    return getDocumentStats(formData.documents)
  }, [formData.documents])

  const toggleAllDocs = () => {
    if (dialogDocStats.isComplete) {
      setFormData(prev => ({
        ...prev,
        documents: { ...DEFAULT_CONTRACTOR_DOCUMENTS },
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        documents: {
          id_card: true,
          house_reg: true,
          medical_cert: true,
          social_security: true,
          consent_form: true,
        },
      }))
    }
  }

  const setDocValue = (docId: keyof ContractorDocuments, val: boolean) => {
    setFormData(prev => ({
      ...prev,
      documents: {
        ...prev.documents,
        [docId]: val,
      },
    }))
  }

  const inseeDialogStatus = useMemo(() => {
    return getTrainingExpiryStatus(formData.insee_training_exp)
  }, [formData.insee_training_exp])

  const boomliftDialogStatus = useMemo(() => {
    return getTrainingExpiryStatus(formData.boomlift_training_exp)
  }, [formData.boomlift_training_exp])

  return (
    <div className="flex flex-col h-full bg-slate-100 overflow-hidden">
      {/* ── Compact Controls Header ── */}
      <div className="bg-white border-b border-slate-300 p-2.5 shadow-2xs space-y-2 shrink-0">
        <div className="flex items-center justify-between gap-2">
          {/* Title & Total Count */}
          <div className="flex items-center gap-1.5">
            <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center font-bold">
              <HardHat className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-xs font-bold text-slate-900 leading-tight">ช่าง / ผู้รับเหมา</h1>
              <p className="text-[11px] text-slate-600 font-normal">ทั้งหมด {stats.total} คน</p>
            </div>
          </div>

          {/* Quick Actions (Add + Refresh) */}
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              onClick={openCreate}
              className="h-8 px-2.5 text-xs bg-slate-900 hover:bg-slate-800 text-white font-semibold shadow-2xs gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>เพิ่มช่าง</span>
            </Button>
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing || loading}
              className="w-8 h-8 rounded-lg border border-slate-300 bg-white flex items-center justify-center text-slate-700 hover:bg-slate-50 transition-colors"
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing || loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="search"
            placeholder="ค้นหาชื่อ, ตำแหน่ง, เบอร์โทร..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-8 pl-8 pr-3 rounded-lg border border-slate-300 bg-slate-50 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-normal"
          />
        </div>

        {/* Filter Controls Row (Company + Status) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          {/* Company Filter Dropdown */}
          <div className="relative shrink-0">
            <select
              value={companyFilter}
              onChange={e => setCompanyFilter(e.target.value)}
              className="h-7 pl-2 pr-6 rounded-md border border-slate-300 bg-white text-xs font-semibold text-slate-800 appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="all">ทุกบริษัท ({stats.total})</option>
              {companies.map(co => (
                <option key={co.id} value={co.id}>
                  {co.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 text-slate-500 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1 shrink-0 bg-slate-100 p-0.5 rounded-md border border-slate-200">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2 py-0.5 rounded text-xs font-semibold transition-all ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ทั้งหมด
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-2 py-0.5 rounded text-xs font-semibold transition-all flex items-center gap-1 ${
                statusFilter === 'active'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-emerald-700 hover:text-emerald-900'
              }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              พร้อม ({stats.active})
            </button>
            {stats.inactive > 0 && (
              <button
                onClick={() => setStatusFilter('inactive')}
                className={`px-2 py-0.5 rounded text-xs font-semibold transition-all flex items-center gap-1 ${
                  statusFilter === 'inactive'
                    ? 'bg-slate-700 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <XCircle className="w-3 h-3" />
                ปิด ({stats.inactive})
              </button>
            )}
          </div>
        </div>

        {/* Subtle, Sleek ALC Risk summary banner */}
        {stats.alcRisk > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-700 font-normal">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>กลุ่มเสี่ยง ALC: <span className="font-semibold text-slate-900">{stats.alcRisk}</span> คน (เตือนใน Checklist)</span>
          </div>
        )}
      </div>

      {/* ── Contractor Card List ── */}
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
              className="h-8 text-xs bg-slate-900 hover:bg-slate-800 text-white font-semibold"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> เพิ่มช่างคนแรก
            </Button>
          </div>
        ) : (
          filtered.map(c => {
            const hasAlcRisk = getContractorAlcRisk(c)
            const wage = getContractorDailyWage(c)
            const displayPos = cleanContractorPosition(c.position)
            const certs = getContractorCertifications(c)
            const docs = getContractorDocuments(c)
            const docStat = getDocumentStats(docs)

            const inseeStatus = getTrainingExpiryStatus(certs.insee_training_exp)
            const boomStatus = getTrainingExpiryStatus(certs.boomlift_training_exp)

            return (
              <div
                key={c.id}
                className={`bg-white rounded-xl border p-2.5 shadow-2xs space-y-2 transition-all ${
                  !c.is_active
                    ? 'opacity-70 bg-slate-50 border-slate-200'
                    : hasAlcRisk
                    ? 'border-slate-300 border-l-[4px] border-l-amber-500 hover:border-slate-400'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Top Row: Name, Company, ALC, Action Icons */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h2 className="text-xs font-semibold text-slate-900 truncate leading-tight">
                        {c.name}
                      </h2>
                      {hasAlcRisk && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-300 font-medium text-[11px] flex items-center gap-0.5">
                          <AlertTriangle className="w-3 h-3 text-amber-600" /> เสี่ยง ALC
                        </span>
                      )}
                      {!c.is_active && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 border border-slate-300 font-normal text-[11px]">
                          ปิดใช้งาน
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-slate-700 font-normal mt-1">
                      {c.company_name ? (
                        <span className="bg-slate-100 text-slate-900 border border-slate-300 px-1.5 py-0.5 rounded truncate max-w-[160px] font-normal text-[11px]">
                          {c.company_name}
                        </span>
                      ) : (
                        <span className="italic text-slate-500 font-normal text-[11px]">รับจ้างอิสระ</span>
                      )}
                      {displayPos && <span className="text-slate-600 font-normal text-[11px]">• {displayPos}</span>}
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

                {/* Bottom Row: Wage & Phone (Left), Badges (Right) */}
                <div className="flex flex-wrap items-center justify-between gap-y-1.5 gap-x-2 pt-1.5 border-t border-slate-100 text-xs">
                  {/* Wage & Phone (Kept firmly together on one line) */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {wage ? (
                      <span className="text-slate-900 font-semibold flex items-center gap-1 text-[11px] bg-slate-50 border border-slate-200 px-2 py-0.5 rounded shrink-0">
                        <Coins className="w-3.5 h-3.5 text-slate-500" /> ฿{wage.toLocaleString()}/วัน
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-500 font-normal shrink-0">ไม่ระบุค่าแรง</span>
                    )}

                    {c.phone && (
                      <a
                        href={`tel:${c.phone}`}
                        className="text-blue-800 font-semibold text-[11px] flex items-center gap-1 hover:underline bg-blue-50 px-2 py-0.5 rounded border border-blue-200 shrink-0"
                      >
                        <Phone className="w-3 h-3" />
                        {c.phone}
                      </a>
                    )}
                  </div>

                  {/* Badges on Right: Insee, Boomlift, Documents */}
                  <div className="flex items-center gap-1 flex-wrap justify-end text-[11px]">
                    {/* Insee */}
                    {certs.insee_training_exp ? (
                      <span
                        title={
                          inseeStatus.status === 'expiring_soon'
                            ? `หมดอายุวันที่ ${formatDateDisplay(certs.insee_training_exp)} (เหลืออีก ${inseeStatus.daysLeft} วัน)`
                            : inseeStatus.status === 'expired'
                            ? `หมดอายุแล้วเมื่อ ${formatDateDisplay(certs.insee_training_exp)}`
                            : `หมดอายุวันที่ ${formatDateDisplay(certs.insee_training_exp)}`
                        }
                        className={`px-1.5 py-0.5 rounded font-semibold inline-flex items-center gap-1 border shrink-0 ${
                          inseeStatus.status === 'expired'
                            ? 'bg-rose-100 text-rose-900 border-rose-300'
                            : inseeStatus.status === 'expiring_soon'
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : 'bg-emerald-50 text-emerald-900 border-emerald-200'
                        }`}
                      >
                        {inseeStatus.status === 'expired' ? (
                          <AlertTriangle className="w-2.5 h-2.5 text-rose-700" />
                        ) : inseeStatus.status === 'expiring_soon' ? (
                          <AlertTriangle className="w-2.5 h-2.5 text-amber-700" />
                        ) : (
                          <Award className="w-2.5 h-2.5 text-emerald-700" />
                        )}
                        <span>
                          Insee: {
                            inseeStatus.status === 'expired'
                              ? 'หมดอายุแล้ว'
                              : inseeStatus.status === 'expiring_soon'
                              ? 'ใกล้หมดอายุ'
                              : formatDateDisplay(certs.insee_training_exp)
                          }
                        </span>
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded bg-slate-50 text-slate-400 border border-slate-200 font-normal shrink-0">
                        Insee: —
                      </span>
                    )}

                    {/* Boomlift */}
                    {certs.boomlift_training_exp ? (
                      <span
                        title={
                          boomStatus.status === 'expiring_soon'
                            ? `หมดอายุวันที่ ${formatDateDisplay(certs.boomlift_training_exp)} (เหลืออีก ${boomStatus.daysLeft} วัน)`
                            : boomStatus.status === 'expired'
                            ? `หมดอายุแล้วเมื่อ ${formatDateDisplay(certs.boomlift_training_exp)}`
                            : `หมดอายุวันที่ ${formatDateDisplay(certs.boomlift_training_exp)}`
                        }
                        className={`px-1.5 py-0.5 rounded font-semibold inline-flex items-center gap-1 border shrink-0 ${
                          boomStatus.status === 'expired'
                            ? 'bg-rose-100 text-rose-900 border-rose-300'
                            : boomStatus.status === 'expiring_soon'
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : 'bg-blue-50 text-blue-900 border-blue-200'
                        }`}
                      >
                        {boomStatus.status === 'expired' ? (
                          <AlertTriangle className="w-2.5 h-2.5 text-rose-700" />
                        ) : boomStatus.status === 'expiring_soon' ? (
                          <AlertTriangle className="w-2.5 h-2.5 text-amber-700" />
                        ) : (
                          <Award className="w-2.5 h-2.5 text-blue-700" />
                        )}
                        <span>
                          Boomlift: {
                            boomStatus.status === 'expired'
                              ? 'หมดอายุแล้ว'
                              : boomStatus.status === 'expiring_soon'
                              ? 'ใกล้หมดอายุ'
                              : formatDateDisplay(certs.boomlift_training_exp)
                          }
                        </span>
                      </span>
                    ) : null}

                    {/* Documents */}
                    {docStat.isComplete ? (
                      <span className="px-1.5 py-0.5 rounded font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1 shrink-0">
                        <Check className="w-2.5 h-2.5 text-emerald-600" /> ครบ 5/5
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded font-normal bg-slate-50 text-slate-600 border border-slate-200 inline-flex items-center gap-1 shrink-0">
                        <FileText className="w-2.5 h-2.5 text-slate-400" /> ขาด {docStat.missingItems.length} อย่าง
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* ── Dialog Form for Add & Edit Contractor ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md p-4 bg-white rounded-2xl shadow-xl border border-slate-300 max-h-[92vh] overflow-y-auto">
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
              <div className="flex flex-wrap gap-1 mt-1.5">
                {POSITION_PRESETS.map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setFormData(p => ({ ...p, position: preset }))}
                    className={`text-[10px] px-2 py-0.5 rounded border transition-all ${
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

            {/* ── กลุ่มที่ 1: ใบเซอร์ / อบรม ── */}
            <div className="p-2.5 rounded-xl border border-amber-200 bg-amber-50/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-950 flex items-center gap-1">
                  <Award className="w-3.5 h-3.5 text-amber-700" /> กลุ่ม 1: ใบเซอร์ / อบรม
                </span>
                <span className="text-[10px] text-amber-800 font-normal">ระบุวันหมดอายุ</span>
              </div>

              {/* Insee */}
              <div className="bg-white p-2 rounded-lg border border-amber-200 space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] font-semibold text-slate-800">1. บัตรอบรม Insee</Label>
                  <Badge
                    variant="outline"
                    className={`text-[9px] px-1 py-0 font-semibold ${
                      inseeDialogStatus.status === 'expired'
                        ? 'bg-rose-100 text-rose-800 border-rose-300'
                        : inseeDialogStatus.status === 'expiring_soon'
                        ? 'bg-amber-100 text-amber-800 border-amber-300'
                        : inseeDialogStatus.status === 'valid'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}
                  >
                    {inseeDialogStatus.label}
                  </Badge>
                </div>
                <Input
                  type="date"
                  value={formData.insee_training_exp}
                  onChange={e => setFormData(p => ({ ...p, insee_training_exp: e.target.value }))}
                  className="h-8 text-xs bg-slate-50 border-slate-300 text-slate-900 font-normal"
                />
              </div>

              {/* Boomlift */}
              <div className="bg-white p-2 rounded-lg border border-amber-200 space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] font-semibold text-slate-800">2. อบรม Boomlift</Label>
                  <Badge
                    variant="outline"
                    className={`text-[9px] px-1 py-0 font-semibold ${
                      boomliftDialogStatus.status === 'expired'
                        ? 'bg-rose-100 text-rose-800 border-rose-300'
                        : boomliftDialogStatus.status === 'expiring_soon'
                        ? 'bg-amber-100 text-amber-800 border-amber-300'
                        : boomliftDialogStatus.status === 'valid'
                        ? 'bg-blue-50 text-blue-800 border-blue-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}
                  >
                    {boomliftDialogStatus.label}
                  </Badge>
                </div>
                <Input
                  type="date"
                  value={formData.boomlift_training_exp}
                  onChange={e => setFormData(p => ({ ...p, boomlift_training_exp: e.target.value }))}
                  className="h-8 text-xs bg-slate-50 border-slate-300 text-slate-900 font-normal"
                />
              </div>
            </div>

            {/* ── กลุ่มที่ 2: สิทธิบัตร / เอกสารที่ต้องใช้ (5 รายการ) ── */}
            <div className="p-2.5 rounded-xl border border-blue-200 bg-blue-50/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-blue-700" /> กลุ่ม 2: เอกสาร (5 รายการ)
                </span>
                <button
                  type="button"
                  onClick={toggleAllDocs}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                    dialogDocStats.isComplete
                      ? 'bg-slate-100 text-slate-700 border-slate-300'
                      : 'bg-emerald-600 text-white border-emerald-600'
                  }`}
                >
                  {dialogDocStats.isComplete ? 'เคลียร์' : '✓ ติ๊กได้ครบทั้ง 5'}
                </button>
              </div>

              <div className="space-y-1.5">
                {REQUIRED_DOCUMENT_LIST.map((doc, idx) => {
                  const DocIcon = DOC_ICONS[doc.id] || FileText
                  const isChecked = formData.documents[doc.id as keyof ContractorDocuments]

                  return (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200"
                    >
                      <div className="flex items-center gap-2">
                        <DocIcon className="w-3.5 h-3.5 text-slate-600" />
                        <span className="text-xs font-semibold text-slate-800">
                          {idx + 1}. {doc.shortLabel}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setDocValue(doc.id as keyof ContractorDocuments, true)}
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                            isChecked
                              ? 'bg-emerald-600 text-white shadow-2xs'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          ✓ ได้แล้ว
                        </button>
                        <button
                          type="button"
                          onClick={() => setDocValue(doc.id as keyof ContractorDocuments, false)}
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                            !isChecked
                              ? 'bg-rose-100 text-rose-800 border border-rose-300 font-bold'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          ✕ ยังขาด
                        </button>
                      </div>
                    </div>
                  )
                })}
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
                  <p className="text-[10px] text-amber-900 font-normal">แสดงแถบเตือนสีเหลืองใน Checklist</p>
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
