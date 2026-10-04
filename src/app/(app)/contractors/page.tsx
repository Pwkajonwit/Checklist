'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
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
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import {
  HardHat, Phone, Plus, Pencil, Trash2, Search,
  Loader2, RefreshCw, ChevronDown, CheckCircle2, XCircle,
  AlertTriangle, Coins, Award, FileText, Check, X,
  IdCard, Home, Stethoscope, ShieldCheck
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

// Icon mapping for required documents
const DOC_ICONS: Record<string, typeof IdCard> = {
  id_card: IdCard,
  house_reg: Home,
  medical_cert: Stethoscope,
  social_security: ShieldCheck,
  consent_form: FileText,
}

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
  const [complianceFilter, setComplianceFilter] = useState<'all' | 'certs_warning' | 'docs_incomplete' | 'docs_complete'>('all')

  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [formData, setFormData] = useState<ContractorFormData>(defaultForm)
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true)
    else setRefreshing(true)

    try {
      const [cRes, coRes] = await Promise.all([
        fetch('/api/contractors'),
        fetch('/api/companies'),
      ])

      if (!cRes.ok || !coRes.ok) {
        throw new Error('ไม่สามารถโหลดข้อมูลได้')
      }

      const [{ data: cData }, { data: coData }] = await Promise.all([
        cRes.json(),
        coRes.json(),
      ])

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
  }, [])

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

    let certsWarningCount = 0
    let docsIncompleteCount = 0

    technicianList.forEach(c => {
      const certs = getContractorCertifications(c)
      const insee = getTrainingExpiryStatus(certs.insee_training_exp)
      const boom = getTrainingExpiryStatus(certs.boomlift_training_exp)
      if (insee.status === 'expired' || insee.status === 'expiring_soon' ||
          boom.status === 'expired' || boom.status === 'expiring_soon') {
        certsWarningCount++
      }

      const docs = getContractorDocuments(c)
      const docStat = getDocumentStats(docs)
      if (!docStat.isComplete) {
        docsIncompleteCount++
      }
    })

    return { total, active, inactive, withCompany, alcRiskCount, certsWarningCount, docsIncompleteCount }
  }, [contractors])

  // Filtered List (เอาพนักงานประจำออก)
  const filteredList = useMemo(() => {
    return contractors
      .filter(c => c.employee_type !== 'employee')
      .filter(c => {
        // Status filter
        if (statusFilter === 'active' && !c.is_active) return false
        if (statusFilter === 'inactive' && c.is_active) return false

        // Compliance filter
        if (complianceFilter === 'certs_warning') {
          const certs = getContractorCertifications(c)
          const insee = getTrainingExpiryStatus(certs.insee_training_exp)
          const boom = getTrainingExpiryStatus(certs.boomlift_training_exp)
          const hasWarning = insee.status === 'expired' || insee.status === 'expiring_soon' ||
                             boom.status === 'expired' || boom.status === 'expiring_soon'
          if (!hasWarning) return false
        } else if (complianceFilter === 'docs_incomplete') {
          const docs = getContractorDocuments(c)
          const docStat = getDocumentStats(docs)
          if (docStat.isComplete) return false
        } else if (complianceFilter === 'docs_complete') {
          const docs = getContractorDocuments(c)
          const docStat = getDocumentStats(docs)
          if (!docStat.isComplete) return false
        }

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
  }, [contractors, statusFilter, complianceFilter, companyFilter, search])

  // Open Create Dialog
  const openCreate = () => {
    setEditId(null)
    setFormData({
      ...defaultForm,
      documents: { ...DEFAULT_CONTRACTOR_DOCUMENTS },
    })
    setDialogOpen(true)
  }

  // Open Edit Dialog
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
    
    // Construct position with embedded tags so it works whether DB has columns or not
    const embeddedPos = formatContractorPositionPayload(cleanPos, {
      dailyWage: wageNum,
      alcRisk: formData.alc_risk,
      certifications: {
        insee_training_exp: formData.insee_training_exp || null,
        boomlift_training_exp: formData.boomlift_training_exp || null,
      },
      documents: formData.documents,
    })

    const payloadWithColumns: any = {
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

    try {
      const url = editId ? `/api/contractors/${editId}` : '/api/contractors'
      const method = editId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadWithColumns),
      })

      if (!res.ok) {
        const errJson = await res.json()
        throw new Error(errJson.error || 'บันทึกไม่สำเร็จ')
      }

      toast.success(editId ? 'แก้ไขข้อมูลช่างเรียบร้อยแล้ว' : 'เพิ่มข้อมูลช่างเรียบร้อยแล้ว')
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
      const res = await fetch(`/api/contractors/${c.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: nextActive, updated_at: new Date().toISOString() }),
      })
      if (!res.ok) {
        const errJson = await res.json()
        throw new Error(errJson.error || 'ไม่สามารถเปลี่ยนสถานะได้')
      }

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
      const res = await fetch(`/api/contractors/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const errJson = await res.json()
        throw new Error(errJson.error || 'ลบไม่สำเร็จ')
      }

      toast.success(`ลบ "${name}" สำเร็จ`)
      setContractors(prev => prev.filter(c => c.id !== id))
    } catch (err: unknown) {
      console.error('Delete contractor error:', err)
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'
      toast.error('ลบไม่สำเร็จ', { description: message })
    }
  }

  // Document Helpers inside dialog
  const dialogDocStats = useMemo(() => {
    return getDocumentStats(formData.documents)
  }, [formData.documents])

  const toggleAllDocs = () => {
    if (dialogDocStats.isComplete) {
      // Clear all
      setFormData(prev => ({
        ...prev,
        documents: { ...DEFAULT_CONTRACTOR_DOCUMENTS },
      }))
    } else {
      // Set all 5 to true
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

  const toggleDoc = (docId: keyof ContractorDocuments) => {
    setFormData(prev => ({
      ...prev,
      documents: {
        ...prev.documents,
        [docId]: !prev.documents[docId],
      },
    }))
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
    <div className="flex flex-col flex-1 min-h-0 h-full gap-2 overflow-hidden">
      {/* ── Compact Top Controls Bar (Standardized h-9) ── */}
      <div className="p-2 bg-white rounded-lg border border-slate-300 shadow-2xs flex flex-wrap items-center justify-between gap-2 shrink-0">
        
        {/* Left: Title & Quick Status Filter Badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="h-9 flex items-center gap-1.5 px-3 rounded-md bg-amber-50 text-amber-950 text-xs font-bold border border-amber-300 shrink-0">
            <HardHat className="w-4 h-4 text-amber-700" />
            <span>จัดการช่าง / ผู้รับเหมา</span>
          </div>

          {/* Quick status tabs (h-9 container) */}
          <div className="h-9 flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-md border border-slate-300 text-xs shrink-0">
            <button
              onClick={() => setStatusFilter('all')}
              className={`h-full px-2.5 rounded text-[11px] font-semibold transition-all ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200'
                  : 'text-slate-700 hover:text-slate-950'
              }`}
            >
              ทั้งหมด (<span className="font-bold">{stats.total}</span>)
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`h-full px-2.5 rounded text-[11px] font-semibold transition-all flex items-center gap-1 ${
                statusFilter === 'active'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-emerald-800 hover:text-emerald-950'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>พร้อมงาน (<span className="font-bold">{stats.active}</span>)</span>
            </button>
            {stats.inactive > 0 && (
              <button
                onClick={() => setStatusFilter('inactive')}
                className={`h-full px-2.5 rounded text-[11px] font-semibold transition-all flex items-center gap-1 ${
                  statusFilter === 'inactive'
                    ? 'bg-slate-700 text-white shadow-2xs'
                    : 'text-slate-700 hover:text-slate-950'
                }`}
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>ปิด (<span className="font-bold">{stats.inactive}</span>)</span>
              </button>
            )}
          </div>

          {/* Compliance filter chips (h-9) */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setComplianceFilter(prev => prev === 'certs_warning' ? 'all' : 'certs_warning')}
              className={`h-9 px-2.5 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1.5 border ${
                complianceFilter === 'certs_warning'
                  ? 'bg-rose-600 text-white border-rose-700 shadow-2xs'
                  : stats.certsWarningCount > 0
                  ? 'bg-rose-50 text-rose-900 border-rose-300 hover:bg-rose-100'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
              title="กรองเฉพาะคนที่ใบเซอร์ Insee/Boomlift หมดอายุหรือใกล้หมด"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              <span>ใบเซอร์เตือน (<span className="font-bold">{stats.certsWarningCount}</span>)</span>
            </button>

            <button
              onClick={() => setComplianceFilter(prev => prev === 'docs_incomplete' ? 'all' : 'docs_incomplete')}
              className={`h-9 px-2.5 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1.5 border ${
                complianceFilter === 'docs_incomplete'
                  ? 'bg-amber-600 text-white border-amber-700 shadow-2xs'
                  : stats.docsIncompleteCount > 0
                  ? 'bg-amber-50 text-amber-950 border-amber-300 hover:bg-amber-100'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
              title="กรองเฉพาะคนที่เอกสาร 5 รายการยังไม่ครบ"
            >
              <FileText className="w-3.5 h-3.5 text-amber-700" />
              <span>เอกสารไม่ครบ (<span className="font-bold">{stats.docsIncompleteCount}</span>)</span>
            </button>
          </div>
        </div>

        {/* Right: Company Select + Search + Refresh + Add (All h-9) */}
        <div className="flex items-center gap-1.5 ml-auto flex-wrap">
          {/* Company filter (h-9) */}
          <div className="relative">
            <select
              value={companyFilter}
              onChange={e => setCompanyFilter(e.target.value)}
              className="h-9 text-xs pl-2.5 pr-7 rounded-md border border-slate-300 bg-white text-slate-900 font-normal focus:outline-none focus:ring-1 focus:ring-amber-500 appearance-none cursor-pointer"
            >
              <option value="all">ทุกสังกัด / บริษัท</option>
              {companies.map(co => (
                <option key={co.id} value={co.id}>
                  {co.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Search box (h-9) */}
          <div className="relative w-44 sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              type="search"
              placeholder="ค้นหาชื่อ, ตำแหน่ง, เบอร์..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-9 text-xs pl-8 pr-2.5 rounded-md border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-900 font-normal placeholder-slate-500"
            />
          </div>

          {/* Refresh button (h-9 w-9) */}
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing || loading}
            className="w-9 h-9 flex items-center justify-center rounded-md border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 transition-colors disabled:opacity-50"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing || loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Add button (h-9) */}
          <Button
            size="sm"
            onClick={openCreate}
            className="h-9 px-3.5 text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-2xs gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>เพิ่มช่าง</span>
          </Button>
        </div>
      </div>

      {/* ── Table Container (Spreadsheet Grid) ── */}
      <div className="border border-slate-300 rounded-lg overflow-hidden bg-white shadow-2xs flex-1 min-h-0 flex flex-col h-full">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-600">
            <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
            <span className="text-xs font-normal">กำลังโหลดข้อมูลช่าง...</span>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-600 p-4">
            <HardHat className="w-8 h-8 stroke-1 text-slate-400" />
            <span className="text-xs font-semibold text-slate-800">
              {search || companyFilter !== 'all' || statusFilter !== 'all' || complianceFilter !== 'all'
                ? 'ไม่พบข้อมูลที่ตรงกับเงื่อนไขการค้นหา'
                : 'ยังไม่มีข้อมูลช่างในระบบ'}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={openCreate}
              className="h-9 px-3 text-xs border-amber-300 text-amber-900 hover:bg-amber-50 font-semibold"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> เพิ่มช่างคนแรก
            </Button>
          </div>
        ) : (
          <div className="flex-1 overflow-auto min-h-0 scrollbar-thin">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-slate-100 z-10 select-none">
                <tr className="text-[11px] font-bold text-slate-900 border-b border-slate-300">
                  <th className="py-2 px-2.5 text-center w-10 border-r border-slate-300">#</th>
                  <th className="py-2 px-3 border-r border-slate-300 min-w-[170px]">ชื่อ - นามสกุล</th>
                  <th className="py-2 px-3 border-r border-slate-300 min-w-[130px]">สังกัด / บริษัท</th>
                  <th className="py-2 px-3 border-r border-slate-300 min-w-[120px]">ตำแหน่ง / ช่าง</th>
                  <th className="py-2 px-3 border-r border-slate-300 min-w-[160px]">
                    <div className="flex items-center gap-1">
                      <Award className="w-3.5 h-3.5 text-amber-700" />
                      <span>ใบเซอร์ / อบรม</span>
                    </div>
                  </th>
                  <th className="py-2 px-3 border-r border-slate-300 min-w-[160px]">
                    <div className="flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-blue-700" />
                      <span>เอกสาร (5 รายการ)</span>
                    </div>
                  </th>
                  <th className="py-2 px-3 text-right border-r border-slate-300 w-24">ค่าแรง</th>
                  <th className="py-2 px-3 text-center border-r border-slate-300 w-24">ความเสี่ยง ALC</th>
                  <th className="py-2 px-3 border-r border-slate-300 w-28">เบอร์ติดต่อ</th>
                  <th className="py-2 px-3 text-center w-28 border-r border-slate-300 whitespace-nowrap">สถานะ</th>
                  <th className="py-2 px-2.5 text-center w-16">จัดการ</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-slate-200">
                {filteredList.map((c, idx) => {
                  const hasAlcRisk = getContractorAlcRisk(c)
                  const wage = getContractorDailyWage(c)
                  const displayPosition = cleanContractorPosition(c.position)
                  const certs = getContractorCertifications(c)
                  const docs = getContractorDocuments(c)
                  const docStat = getDocumentStats(docs)

                  const inseeStatus = getTrainingExpiryStatus(certs.insee_training_exp)
                  const boomStatus = getTrainingExpiryStatus(certs.boomlift_training_exp)

                  return (
                    <tr
                      key={c.id}
                      className={`hover:bg-amber-50/40 transition-colors ${
                        !c.is_active ? 'bg-slate-50/70 text-slate-500' : 'text-slate-900'
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
                                ? 'bg-slate-200 text-slate-700'
                                : 'bg-amber-100 text-amber-900'
                            }`}
                          >
                            {c.name.trim().charAt(0) || '?'}
                          </div>
                          <span className={c.is_active ? 'text-slate-950 font-normal' : 'text-slate-600 font-normal'}>
                            {c.name}
                          </span>
                        </div>
                      </td>

                      {/* Company */}
                      <td className="py-1.5 px-3 border-r border-slate-200 font-normal">
                        {c.company_name ? (
                          <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-900 border border-slate-300 text-[11px] font-normal">
                            {c.company_name}
                          </span>
                        ) : (
                          <span className="text-slate-600 text-[11px] italic font-normal">รับจ้างอิสระ</span>
                        )}
                      </td>

                      {/* Position */}
                      <td className="py-1.5 px-3 border-r border-slate-200">
                        <span className="font-normal text-slate-900">
                          {displayPosition || '-'}
                        </span>
                      </td>

                      {/* Certifications (Insee & Boomlift) */}
                      <td className="py-1.5 px-3 border-r border-slate-200">
                        <div className="flex flex-col gap-1">
                          {/* Insee */}
                          {certs.insee_training_exp ? (
                            <div className="flex items-center gap-1.5">
                              <span
                                title={
                                  inseeStatus.status === 'expiring_soon'
                                    ? `หมดอายุวันที่ ${formatDateDisplay(certs.insee_training_exp)} (เหลืออีก ${inseeStatus.daysLeft} วัน)`
                                    : inseeStatus.status === 'expired'
                                    ? `หมดอายุแล้วเมื่อ ${formatDateDisplay(certs.insee_training_exp)}`
                                    : `หมดอายุวันที่ ${formatDateDisplay(certs.insee_training_exp)}`
                                }
                                className={`text-[11px] px-1.5 py-0.5 rounded font-normal inline-flex items-center gap-1 border ${
                                  inseeStatus.status === 'expired'
                                    ? 'bg-rose-100 text-rose-950 border-rose-300 font-semibold'
                                    : inseeStatus.status === 'expiring_soon'
                                    ? 'bg-amber-100 text-amber-950 border-amber-300 font-semibold'
                                    : 'bg-emerald-50 text-emerald-950 border-emerald-300'
                                }`}
                              >
                                {inseeStatus.status === 'expired' && <AlertTriangle className="w-3 h-3 text-rose-700" />}
                                {inseeStatus.status === 'expiring_soon' && <AlertTriangle className="w-3 h-3 text-amber-700" />}
                                {inseeStatus.status === 'valid' && <Check className="w-3 h-3 text-emerald-700" />}
                                <span>
                                  Insee: {
                                    inseeStatus.status === 'expired'
                                      ? 'หมดอายุแล้ว'
                                      : inseeStatus.status === 'expiring_soon'
                                      ? `ใกล้หมดอายุ (${inseeStatus.daysLeft} วัน)`
                                      : formatDateDisplay(certs.insee_training_exp)
                                  }
                                </span>
                              </span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-500 font-normal">Insee: —</span>
                          )}

                          {/* Boomlift */}
                          {certs.boomlift_training_exp ? (
                            <div className="flex items-center gap-1.5">
                              <span
                                title={
                                  boomStatus.status === 'expiring_soon'
                                    ? `หมดอายุวันที่ ${formatDateDisplay(certs.boomlift_training_exp)} (เหลืออีก ${boomStatus.daysLeft} วัน)`
                                    : boomStatus.status === 'expired'
                                    ? `หมดอายุแล้วเมื่อ ${formatDateDisplay(certs.boomlift_training_exp)}`
                                    : `หมดอายุวันที่ ${formatDateDisplay(certs.boomlift_training_exp)}`
                                }
                                className={`text-[11px] px-1.5 py-0.5 rounded font-normal inline-flex items-center gap-1 border ${
                                  boomStatus.status === 'expired'
                                    ? 'bg-rose-100 text-rose-950 border-rose-300 font-semibold'
                                    : boomStatus.status === 'expiring_soon'
                                    ? 'bg-amber-100 text-amber-950 border-amber-300 font-semibold'
                                    : 'bg-blue-50 text-blue-950 border-blue-300'
                                }`}
                              >
                                {boomStatus.status === 'expired' && <AlertTriangle className="w-3 h-3 text-rose-700" />}
                                {boomStatus.status === 'expiring_soon' && <AlertTriangle className="w-3 h-3 text-amber-700" />}
                                {boomStatus.status === 'valid' && <Check className="w-3 h-3 text-blue-700" />}
                                <span>
                                  Boomlift: {
                                    boomStatus.status === 'expired'
                                      ? 'หมดอายุแล้ว'
                                      : boomStatus.status === 'expiring_soon'
                                      ? `ใกล้หมดอายุ (${boomStatus.daysLeft} วัน)`
                                      : formatDateDisplay(certs.boomlift_training_exp)
                                  }
                                </span>
                              </span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-500 font-normal">Boomlift: —</span>
                          )}
                        </div>
                      </td>

                      {/* Required Documents (5 Items) */}
                      <td className="py-1.5 px-3 border-r border-slate-200">
                        {docStat.isComplete ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-950 border border-emerald-300 font-bold text-[11px] inline-flex items-center gap-1">
                            <Check className="w-3 h-3 text-emerald-700" />
                            ได้ครบ 5/5
                          </span>
                        ) : docStat.completedCount === 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-900 border border-rose-300 text-[11px] font-normal inline-flex items-center gap-1">
                            <X className="w-3 h-3 text-rose-600" />
                            ยังขาด 5 รายการ
                          </span>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-950 border border-amber-300 font-semibold text-[11px] inline-flex items-center gap-1 w-fit">
                              <AlertTriangle className="w-3 h-3 text-amber-700" />
                              ขาด {docStat.missingItems.length} อย่าง ({docStat.completedCount}/5)
                            </span>
                            <span
                              className="text-[11px] text-slate-700 font-normal truncate max-w-[160px]"
                              title={docStat.missingItems.map(m => m.label).join(', ')}
                            >
                              ขาด: {docStat.missingItems.map(m => m.shortLabel).join(', ')}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Wage */}
                      <td className="py-1.5 px-3 border-r border-slate-200 text-right text-[11px]">
                        {wage ? (
                          <span className="font-bold text-slate-950">฿{wage.toLocaleString()}</span>
                        ) : (
                          <span className="text-slate-500 font-normal">—</span>
                        )}
                      </td>

                      {/* ALC Risk */}
                      <td className="py-1.5 px-3 border-r border-slate-200 text-center">
                        {hasAlcRisk ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-950 border border-amber-300 font-bold text-[11px] inline-flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-amber-700" />
                            เสี่ยง ALC
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-900 border border-emerald-300 text-[11px] font-normal">
                            ✓ ปกติ
                          </span>
                        )}
                      </td>

                      {/* Phone */}
                      <td className="py-1.5 px-3 border-r border-slate-200 text-[11px]">
                        {c.phone ? (
                          <a
                            href={`tel:${c.phone}`}
                            className="text-blue-800 hover:underline flex items-center gap-1 font-normal"
                          >
                            <Phone className="w-3 h-3 text-slate-600" />
                            <span>{c.phone}</span>
                          </a>
                        ) : (
                          <span className="text-slate-500 italic text-[11px] font-normal">—</span>
                        )}
                      </td>

                      {/* Status Toggle */}
                      <td className="py-1.5 px-3 text-center border-r border-slate-200 whitespace-nowrap">
                        <button
                          onClick={() => handleToggleActive(c)}
                          className={`inline-flex items-center justify-center text-[11px] font-semibold px-2.5 py-0.5 rounded-full cursor-pointer transition-colors whitespace-nowrap border ${
                            c.is_active
                              ? 'bg-emerald-100 text-emerald-950 border-emerald-400 hover:bg-emerald-200'
                              : 'bg-slate-200 text-slate-900 border-slate-400 hover:bg-slate-300'
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
                            className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 text-slate-700 hover:text-blue-700 transition-colors"
                            title="แก้ไขข้อมูล"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(c.id, c.name)}
                            className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 text-slate-600 hover:text-red-700 transition-colors"
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
        <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between text-[11px] text-slate-700 shrink-0 gap-2">
          <div>
            แสดง <span className="font-bold text-slate-950">{filteredList.length}</span> จากทั้งหมด{' '}
            <span className="font-bold text-slate-950">{stats.total}</span> คน
            {companyFilter !== 'all' && ' (กรองตามบริษัท)'}
            {complianceFilter === 'certs_warning' && ' (กรองใบเซอร์เตือน)'}
            {complianceFilter === 'docs_incomplete' && ' (กรองเอกสารไม่ครบ)'}
          </div>
          <div className="flex items-center gap-3 flex-wrap font-normal">
            <span className="flex items-center gap-1 text-slate-900 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              พร้อมงาน <span className="font-bold">{stats.active}</span> คน
            </span>
            {stats.alcRiskCount > 0 && (
              <span className="flex items-center gap-1 text-amber-950 font-semibold">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                กลุ่มเสี่ยง ALC <span className="font-bold">{stats.alcRiskCount}</span> คน
              </span>
            )}
            {stats.certsWarningCount > 0 && (
              <span className="flex items-center gap-1 text-rose-950 font-semibold">
                <Award className="w-3.5 h-3.5 text-rose-700" />
                ใบเซอร์เตือน <span className="font-bold">{stats.certsWarningCount}</span> คน
              </span>
            )}
            {stats.docsIncompleteCount > 0 && (
              <span className="flex items-center gap-1 text-amber-950 font-semibold">
                <FileText className="w-3.5 h-3.5 text-amber-700" />
                เอกสารยังไม่ครบ <span className="font-bold">{stats.docsIncompleteCount}</span> คน
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Add / Edit Contractor Modal Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl sm:max-w-2xl max-h-[92vh] flex flex-col p-0 overflow-hidden bg-white border border-slate-300 shadow-xl">
          <DialogHeader className="px-4 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold shrink-0 bg-amber-100 text-amber-800">
                <HardHat className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-sm font-bold text-slate-900">
                  {editId ? 'แก้ไขข้อมูลช่าง / ผู้รับเหมา' : 'เพิ่มข้อมูลช่าง / ผู้รับเหมา'}
                </DialogTitle>
                <p className="text-[11px] text-slate-700 mt-0.5 font-normal">
                  บันทึกข้อมูลส่วนตัว ใบเซอร์การอบรม และเช็คความครบถ้วนของเอกสาร
                </p>
              </div>
            </div>
          </DialogHeader>

          {/* Scrollable Form Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs scrollbar-thin">
            
            {/* ── Section: ข้อมูลพื้นฐาน ── */}
            <div className="space-y-3 bg-slate-50/70 p-3 rounded-lg border border-slate-300">
              <div className="text-[11px] font-bold text-slate-900 uppercase tracking-wide">
                ข้อมูลพื้นฐาน
              </div>

              {/* Name */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-900">ชื่อ - นามสกุล *</Label>
                <Input
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="เช่น นายสมชาย ใจดี"
                  className="h-9 text-xs bg-white border-slate-300 font-normal text-slate-900"
                  autoFocus
                />
              </div>

              {/* Company / Department */}
              <div className="space-y-1">
                <Label htmlFor="modal_company" className="text-xs font-semibold text-slate-900">
                  สังกัด / บริษัท
                </Label>
                <div className="relative">
                  <select
                    id="modal_company"
                    value={formData.company_id || ''}
                    onChange={e => handleCompanySelect(e.target.value || '__none__')}
                    className="w-full h-9 px-2.5 pr-8 rounded-md border border-slate-300 bg-white text-xs font-normal text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500 appearance-none cursor-pointer"
                  >
                    <option value="">-- ไม่ระบุ / รับจ้างอิสระ --</option>
                    {companies.map(co => (
                      <option key={co.id} value={co.id}>
                        {co.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Position with quick preset chips */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-900">
                  ตำแหน่ง / สายงานช่าง
                </Label>
                <Input
                  value={formData.position}
                  onChange={e => setFormData(prev => ({ ...prev, position: e.target.value }))}
                  placeholder="เช่น ช่างไฟฟ้า, ช่างเชื่อม..."
                  className="h-9 text-xs bg-white border-slate-300 text-slate-900 font-normal"
                />
                <div className="flex flex-wrap gap-1 pt-1">
                  {POSITION_PRESETS.map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, position: preset }))}
                      className={`text-[11px] px-2 py-0.5 rounded border transition-all cursor-pointer ${
                        formData.position === preset
                          ? 'bg-amber-600 border-amber-600 text-white font-semibold'
                          : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-100 font-normal'
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
                  <Label className="text-xs font-semibold text-slate-900 flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5 text-amber-700" />
                    ค่าแรง (บาท/วัน)
                  </Label>
                  <Input
                    value={formData.daily_wage}
                    onChange={e => setFormData(prev => ({ ...prev, daily_wage: e.target.value }))}
                    placeholder="เช่น 500"
                    className="h-9 text-xs bg-white border-slate-300 text-slate-900 font-normal"
                    type="number"
                    min="0"
                  />
                </div>

                {/* Phone */}
                <div className="space-y-1">
                  <Label htmlFor="contractor_phone" className="text-xs font-semibold text-slate-900 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-amber-700" />
                    เบอร์โทรศัพท์ / ติดต่อ
                  </Label>
                  <Input
                    id="contractor_phone"
                    value={formData.phone}
                    onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="เช่น 081-234-5678"
                    className="h-9 text-xs bg-white border-slate-300 text-slate-900 font-normal"
                    type="tel"
                    inputMode="tel"
                  />
                </div>
              </div>

              {/* ALC Risk & Active in 2 Columns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {/* ALC Risk Toggle */}
                <label
                  htmlFor="modal_alc_risk"
                  className="flex items-center justify-between p-2.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100/60 cursor-pointer transition-all"
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
                        เสี่ยง ALC
                      </p>
                      <p className="text-[11px] text-amber-900 font-normal">เตือนแถบเหลืองในตาราง</p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      formData.alc_risk
                        ? 'bg-amber-200 text-amber-950 border-amber-400 text-[11px] font-bold'
                        : 'bg-white text-slate-700 border-slate-300 text-[11px] font-normal'
                    }
                  >
                    {formData.alc_risk ? 'เสี่ยง' : 'ปกติ'}
                  </Badge>
                </label>

                {/* Active Toggle */}
                <label
                  htmlFor="modal_is_active"
                  className="flex items-center justify-between p-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100/80 cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="modal_is_active"
                      checked={formData.is_active}
                      onCheckedChange={v => setFormData(prev => ({ ...prev, is_active: !!v }))}
                    />
                    <div>
                      <p className="text-xs font-semibold text-slate-900">เปิดใช้งาน (Active)</p>
                      <p className="text-[11px] text-slate-600 font-normal">แสดงใน Checklist หน้างาน</p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      formData.is_active
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-300 text-[11px] font-semibold'
                        : 'bg-slate-100 text-slate-700 text-[11px] font-normal'
                    }
                  >
                    {formData.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </label>
              </div>
            </div>

            {/* ── Section: กลุ่มแรก (ด้านบน): ใบเซอร์/อบรม ── */}
            <div className="space-y-2.5 bg-amber-50/50 p-3 rounded-lg border border-amber-300">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-700" />
                  <span className="text-xs font-bold text-amber-950">
                    กลุ่มที่ 1: ใบเซอร์ / การอบรม
                  </span>
                </div>
                <span className="text-[11px] text-amber-900 font-normal">
                  ระบุวันหมดอายุของบัตรอบรม
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {/* 1. บัตรอบรม Insee */}
                <div className="bg-white p-2.5 rounded-lg border border-amber-300 space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-900">
                      1. บัตรอบรม Insee
                    </Label>
                    <Badge
                      variant="outline"
                      className={`text-[11px] px-1.5 py-0.5 font-semibold ${
                        inseeDialogStatus.status === 'expired'
                          ? 'bg-rose-100 text-rose-950 border-rose-300'
                          : inseeDialogStatus.status === 'expiring_soon'
                          ? 'bg-amber-100 text-amber-950 border-amber-300'
                          : inseeDialogStatus.status === 'valid'
                          ? 'bg-emerald-50 text-emerald-950 border-emerald-300'
                          : 'bg-slate-100 text-slate-700 border-slate-300'
                      }`}
                    >
                      {inseeDialogStatus.label}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-1">
                    <Input
                      type="date"
                      value={formData.insee_training_exp}
                      onChange={e => setFormData(prev => ({ ...prev, insee_training_exp: e.target.value }))}
                      className="h-9 text-xs bg-slate-50 border-slate-300 text-slate-900 font-normal"
                    />
                    {formData.insee_training_exp && (
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, insee_training_exp: '' }))}
                        className="h-9 w-9 shrink-0 flex items-center justify-center rounded border border-slate-300 hover:bg-slate-100 text-slate-600 hover:text-slate-900"
                        title="ล้างวันที่"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 font-normal">
                    แจ้งเตือนล่วงหน้าเมื่อใกล้หมดอายุภายใน 30 วัน
                  </p>
                </div>

                {/* 2. อบรม Boomlift */}
                <div className="bg-white p-2.5 rounded-lg border border-amber-300 space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-900">
                      2. อบรม Boomlift
                    </Label>
                    <Badge
                      variant="outline"
                      className={`text-[11px] px-1.5 py-0.5 font-semibold ${
                        boomliftDialogStatus.status === 'expired'
                          ? 'bg-rose-100 text-rose-950 border-rose-300'
                          : boomliftDialogStatus.status === 'expiring_soon'
                          ? 'bg-amber-100 text-amber-950 border-amber-300'
                          : boomliftDialogStatus.status === 'valid'
                          ? 'bg-blue-50 text-blue-950 border-blue-300'
                          : 'bg-slate-100 text-slate-700 border-slate-300'
                      }`}
                    >
                      {boomliftDialogStatus.label}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-1">
                    <Input
                      type="date"
                      value={formData.boomlift_training_exp}
                      onChange={e => setFormData(prev => ({ ...prev, boomlift_training_exp: e.target.value }))}
                      className="h-9 text-xs bg-slate-50 border-slate-300 text-slate-900 font-normal"
                    />
                    {formData.boomlift_training_exp && (
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, boomlift_training_exp: '' }))}
                        className="h-9 w-9 shrink-0 flex items-center justify-center rounded border border-slate-300 hover:bg-slate-100 text-slate-600 hover:text-slate-900"
                        title="ล้างวันที่"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 font-normal">
                    แจ้งเตือนล่วงหน้าเมื่อใกล้หมดอายุภายใน 30 วัน
                  </p>
                </div>
              </div>
            </div>

            {/* ── Section: กลุ่มที่สอง (ด้านล่าง): สิทธิบัตร / เอกสารที่ต้องใช้ ── */}
            <div className="space-y-2.5 bg-blue-50/50 p-3 rounded-lg border border-blue-300">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-blue-700" />
                  <span className="text-xs font-bold text-slate-950">
                    กลุ่มที่ 2: สิทธิบัตร / เอกสารที่ต้องใช้ (5 รายการ)
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-[11px] font-bold ${
                      dialogDocStats.isComplete
                        ? 'bg-emerald-100 text-emerald-950 border-emerald-300'
                        : 'bg-amber-100 text-amber-950 border-amber-300'
                    }`}
                  >
                    {dialogDocStats.completedCount}/5 ได้แล้ว
                  </Badge>
                </div>

                {/* Quick Toggle All Button */}
                <button
                  type="button"
                  onClick={toggleAllDocs}
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded border transition-all cursor-pointer ${
                    dialogDocStats.isComplete
                      ? 'bg-white text-slate-800 border-slate-300 hover:bg-slate-100'
                      : 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 shadow-2xs'
                  }`}
                >
                  {dialogDocStats.isComplete ? 'เคลียร์เอกสารทั้งหมด' : '✓ ติ๊กได้ครบทั้งหมด 5 รายการ'}
                </button>
              </div>

              {/* 5 Document Toggle Rows */}
              <div className="space-y-1.5 pt-1">
                {REQUIRED_DOCUMENT_LIST.map((doc, idx) => {
                  const DocIcon = DOC_ICONS[doc.id] || FileText
                  const isChecked = formData.documents[doc.id as keyof ContractorDocuments]

                  return (
                    <div
                      key={doc.id}
                      className={`flex items-center justify-between p-2.5 rounded-lg border transition-all ${
                        isChecked
                          ? 'bg-white border-emerald-300 hover:bg-emerald-50/40'
                          : 'bg-white border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {/* Left: Document Name & Icon */}
                      <div
                        onClick={() => toggleDoc(doc.id as keyof ContractorDocuments)}
                        className="flex items-center gap-2 cursor-pointer select-none flex-1 py-0.5"
                      >
                        <div
                          className={`w-7 h-7 rounded flex items-center justify-center shrink-0 ${
                            isChecked
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          <DocIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-900">
                            {idx + 1}. {doc.label}
                          </p>
                          <p className="text-[11px] text-slate-600 font-normal">
                            {isChecked ? '✓ มีเอกสารเรียบร้อยแล้ว' : '✕ ยังไม่ได้รับเอกสาร'}
                          </p>
                        </div>
                      </div>

                      {/* Right: Binary Selection (✓ ได้แล้ว vs ✕ ยังขาด) */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setDocValue(doc.id as keyof ContractorDocuments, true)}
                          className={`px-3 py-1 rounded text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                            isChecked
                              ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>ได้แล้ว</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setDocValue(doc.id as keyof ContractorDocuments, false)}
                          className={`px-3 py-1 rounded text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                            !isChecked
                              ? 'bg-rose-100 text-rose-950 border border-rose-300 font-bold shadow-2xs'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>ยังขาด</span>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

          </div>

          <DialogFooter className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
              className="h-9 px-3.5 text-xs bg-white text-slate-800 border-slate-300 hover:bg-slate-100 font-normal"
            >
              ยกเลิก
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="h-9 px-4 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 shadow-2xs"
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
