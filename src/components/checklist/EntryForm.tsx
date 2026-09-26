'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { ChecklistEntryFormData, Contractor, Activity, ChecklistPpeItem } from '@/lib/types'
import { isAlcoholFailed, isAlcoholPassed, isAlcoholUnchecked, normalizeAlcForDb, DEFAULT_CHECKLIST_PPE_ITEMS } from '@/lib/types'
import { format } from 'date-fns'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  HardHat, User, Clock, Activity as ActivityIcon,
  Shield, Wine, Loader2, Save, ArrowLeft, AlertTriangle,
  Plus, X, Layers, Wrench, Check
} from 'lucide-react'
import Link from 'next/link'
import { PURPOSE_PRESETS } from './QuickTeamChecklist'
import { extractUserNote } from '@/lib/utils'

interface EntryFormProps {
  entryId?: string
  defaultDate?: string
}

const defaultFormData: ChecklistEntryFormData = {
  contractor_name: '',
  company_name: '',
  supervisor: '',
  purpose: '',
  check_in_time: '08:00',
  check_out_time: '17:00',
  card_code: '',
  card_name: '',
  activity_name: '',
  location: '',
  alc_result: '',
  ppe_helmet: false,
  ppe_vest: false,
  ppe_shirt: false,
  ppe_gloves: false,
  ppe_shoes: false,
  is_blacklisted: false,
  noise_area: false,
  daily_wage: null,
  meal_allowance: false,
  notes: '',
}

export function EntryForm({ entryId, defaultDate }: EntryFormProps) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [formData, setFormData] = useState<ChecklistEntryFormData>(defaultFormData)
  const [entryDate, setEntryDate] = useState(defaultDate ?? format(new Date(), 'yyyy-MM-dd'))
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)

  // Dynamic PPE Items from Settings
  const [ppeConfigItems, setPpeConfigItems] = useState<ChecklistPpeItem[]>(DEFAULT_CHECKLIST_PPE_ITEMS)
  const [ppeDetails, setPpeDetails] = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetch(`/api/settings?id=checklist_ppe_items&t=${Date.now()}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(json => {
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          setPpeConfigItems(json.data)
        }
      })
      .catch(() => {})
  }, [])

  const activePpeItems = useMemo(() => {
    const active = ppeConfigItems.filter(i => i.is_active)
    return active.length > 0 ? active : DEFAULT_CHECKLIST_PPE_ITEMS
  }, [ppeConfigItems])

  // Load master data
  useEffect(() => {
    const loadData = async () => {
      const [{ data: c }, { data: a }] = await Promise.all([
        supabase.from('contractors').select('*, companies(name)').eq('is_active', true).order('name'),
        supabase.from('activities').select('*').eq('is_active', true).order('name'),
      ])
      setContractors(c ?? [])
      setActivities(a ?? [])

      // Load existing entry if editing
      if (entryId) {
        const res = await fetch(`/api/checklist/${entryId}`)
        const json = await res.json()
        const entry = json.data
        if (entry) {
          let loadedPpeDetails: Record<string, boolean> = {}
          try {
            if (entry.notes) {
              const parsed = JSON.parse(entry.notes)
              if (parsed?.ppe_details && typeof parsed.ppe_details === 'object') {
                loadedPpeDetails = parsed.ppe_details
              }
            }
          } catch {}
          setPpeDetails(loadedPpeDetails)

          setEntryDate(entry.entry_date)
          setFormData({
            contractor_id: entry.contractor_id ?? undefined,
            contractor_name: entry.contractor_name,
            company_name: entry.company_name ?? '',
            supervisor: entry.supervisor ?? '',
            purpose: entry.purpose ?? '',
            check_in_time: entry.check_in_time ?? '',
            check_out_time: entry.check_out_time ?? '',
            card_code: entry.card_code ?? '',
            card_name: entry.card_name ?? '',
            activity_id: entry.activity_id ?? undefined,
            activity_name: entry.activity_name ?? '',
            location: entry.location ?? '',
            alc_result: entry.alc_result,
            ppe_helmet: entry.ppe_helmet,
            ppe_vest: entry.ppe_vest,
            ppe_shirt: entry.ppe_shirt,
            ppe_gloves: entry.ppe_gloves,
            ppe_shoes: entry.ppe_shoes,
            is_blacklisted: entry.is_blacklisted,
            noise_area: entry.noise_area,
            daily_wage: entry.daily_wage,
            meal_allowance: entry.meal_allowance,
            notes: extractUserNote(entry.notes),
          })
        }
      }
      setLoadingData(false)
    }
    loadData()
  }, [entryId])

  const handleActivitySelect = (activityId: string) => {
    if (activityId === '__manual__') {
      setFormData(prev => ({ ...prev, activity_id: undefined, activity_name: '', location: '' }))
      return
    }
    const a = activities.find(a => a.id === activityId)
    if (a) {
      const displayName = a.tasks ? `${a.name} (${a.tasks})` : a.name
      setFormData(prev => ({
        ...prev,
        activity_id: a.id,
        activity_name: displayName,
        location: a.location ?? '',
      }))
    }
  }

  const handleContractorSelect = (contractorId: string) => {
    if (contractorId === '__manual__') {
      setFormData(prev => ({ ...prev, contractor_id: undefined, contractor_name: '', company_name: '' }))
      return
    }
    const c = contractors.find(c => c.id === contractorId)
    if (c) {
      setFormData(prev => ({
        ...prev,
        contractor_id: c.id,
        contractor_name: c.name,
        company_name: c.company_name ?? '',
      }))
    }
  }

  const allChecked = activePpeItems.length > 0 && activePpeItems.every(item => {
    if (typeof ppeDetails[item.id] === 'boolean') return ppeDetails[item.id]
    if (item.id === 'helmet') return !!formData.ppe_helmet
    if (item.id === 'vest') return !!formData.ppe_vest
    if (item.id === 'glasses' || item.id === 'shirt') return !!formData.ppe_shirt
    if (item.id === 'gloves') return !!formData.ppe_gloves
    if (item.id === 'shoes') return !!formData.ppe_shoes
    return false
  })

  const handleCheckAllPPE = () => {
    const nextVal = !allChecked
    const updated: Record<string, boolean> = {}
    activePpeItems.forEach(it => { updated[it.id] = nextVal })
    setPpeDetails(updated)
    setFormData(prev => ({
      ...prev,
      ppe_helmet: nextVal,
      ppe_vest: nextVal,
      ppe_shirt: nextVal,
      ppe_gloves: nextVal,
      ppe_shoes: nextVal,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.contractor_name.trim()) {
      toast.error('กรุณากรอกชื่อผู้รับเหมา')
      return
    }
    setLoading(true)

    const finalPpeDetails: Record<string, boolean> = {}
    activePpeItems.forEach(it => {
      if (typeof ppeDetails[it.id] === 'boolean') {
        finalPpeDetails[it.id] = ppeDetails[it.id]
      } else if (it.id === 'helmet') finalPpeDetails[it.id] = !!formData.ppe_helmet
      else if (it.id === 'vest') finalPpeDetails[it.id] = !!formData.ppe_vest
      else if (it.id === 'glasses' || it.id === 'shirt') finalPpeDetails[it.id] = !!formData.ppe_shirt
      else if (it.id === 'gloves') finalPpeDetails[it.id] = !!formData.ppe_gloves
      else if (it.id === 'shoes') finalPpeDetails[it.id] = !!formData.ppe_shoes
      else finalPpeDetails[it.id] = false
    })

    let notesStr: string | null = null
    try {
      const cleanUserNote = extractUserNote(formData.notes)
      notesStr = JSON.stringify({
        ppe_details: finalPpeDetails,
        ...(cleanUserNote ? { user_note: cleanUserNote } : {})
      })
    } catch {
      notesStr = JSON.stringify({ ppe_details: finalPpeDetails })
    }

    const payload = {
      ...formData,
      entry_date: entryDate,
      alc_result: normalizeAlcForDb(formData.alc_result),
      ppe_helmet: finalPpeDetails['helmet'] ?? !!formData.ppe_helmet,
      ppe_vest: finalPpeDetails['vest'] ?? !!formData.ppe_vest,
      ppe_shirt: finalPpeDetails['glasses'] ?? finalPpeDetails['shirt'] ?? !!formData.ppe_shirt,
      ppe_gloves: finalPpeDetails['gloves'] ?? !!formData.ppe_gloves,
      ppe_shoes: finalPpeDetails['shoes'] ?? !!formData.ppe_shoes,
      notes: notesStr,
    }

    try {
      const url = entryId ? `/api/checklist/${entryId}` : '/api/checklist'
      const method = entryId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'บันทึกไม่สำเร็จ')
      }
      toast.success(entryId ? 'แก้ไขสำเร็จ' : 'เพิ่มรายการสำเร็จ')
      router.push('/checklist')
      router.refresh()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ'
      toast.error('บันทึกไม่สำเร็จ', { description: message })
    }
    setLoading(false)
  }

  const ppeCount = activePpeItems.filter(item => {
    if (typeof ppeDetails[item.id] === 'boolean') return ppeDetails[item.id]
    if (item.id === 'helmet') return !!formData.ppe_helmet
    if (item.id === 'vest') return !!formData.ppe_vest
    if (item.id === 'glasses' || item.id === 'shirt') return !!formData.ppe_shirt
    if (item.id === 'gloves') return !!formData.ppe_gloves
    if (item.id === 'shoes') return !!formData.ppe_shoes
    return false
  }).length

  if (loadingData) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pb-24 md:pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/checklist">
          <Button type="button" variant="ghost" size="icon" className="shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold">{entryId ? 'แก้ไขรายการ' : 'เพิ่มรายการ Checklist'}</h1>
          <p className="text-sm text-muted-foreground">บันทึกการเข้าโครงการ</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-4">

          {/* ข้อมูลพื้นฐาน */}
          <Card className="shadow-xs">
            <CardHeader className="py-3.5 px-5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-slate-800">ข้อมูลผู้รับเหมา</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              {/* Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">วันที่</Label>
                  <Input
                    type="date"
                    value={entryDate}
                    onChange={e => setEntryDate(e.target.value)}
                    className="h-10"
                  />
                </div>
              </div>

              {/* Contractor Select */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">ผู้รับเหมา (เลือกจากรายชื่อ)</Label>
                <Select
                  value={formData.contractor_id ?? '__manual__'}
                  onValueChange={(v: string | null) => v && handleContractorSelect(v)}
                >
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue placeholder="เลือกผู้รับเหมา..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__manual__">-- กรอกเอง --</SelectItem>
                    {contractors.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} {c.company_name ? `(${c.company_name})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="contractor_name" className="text-xs font-semibold text-slate-700">
                    ชื่อผู้รับเหมา <span className="text-rose-500 font-bold">*</span>
                  </Label>
                  <Input
                    id="contractor_name"
                    value={formData.contractor_name}
                    onChange={e => setFormData(prev => ({ ...prev, contractor_name: e.target.value }))}
                    placeholder="กรอกชื่อ..."
                    required
                    className="h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="company_name" className="text-xs font-semibold text-slate-700">บริษัท / แผนก</Label>
                  <Input
                    id="company_name"
                    value={formData.company_name ?? ''}
                    onChange={e => setFormData(prev => ({ ...prev, company_name: e.target.value }))}
                    placeholder="ช.หลุยส์, ช.ป๊อบ..."
                    className="h-10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="supervisor" className="text-xs font-semibold text-slate-700">ผู้ควบคุม</Label>
                  <Input
                    id="supervisor"
                    value={formData.supervisor ?? ''}
                    onChange={e => setFormData(prev => ({ ...prev, supervisor: e.target.value }))}
                    placeholder="ชื่อผู้ควบคุม..."
                    className="h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="purpose" className="text-xs font-semibold text-slate-700">แจ้งความประสงค์</Label>
                  <Input
                    id="purpose"
                    list="entry-form-purpose-list"
                    value={formData.purpose ?? ''}
                    onChange={e => setFormData(prev => ({ ...prev, purpose: e.target.value }))}
                    placeholder="เช่น ไม่มา, ขอเข้า 09:00..."
                    className="h-10"
                  />
                  <datalist id="entry-form-purpose-list">
                    {PURPOSE_PRESETS.map(p => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* เวลาและบัตร */}
          <Card className="shadow-xs">
            <CardHeader className="py-3.5 px-5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <CardTitle className="text-sm font-bold text-slate-800">เวลาปฏิบัติงาน (เข้า - ออก)</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="check_in_time" className="text-xs font-semibold text-slate-700">เวลาเข้า</Label>
                  <Input
                    id="check_in_time"
                    type="time"
                    value={formData.check_in_time ?? '08:00'}
                    onChange={e => setFormData(prev => ({ ...prev, check_in_time: e.target.value }))}
                    className="h-10 font-mono bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="check_out_time" className="text-xs font-semibold text-slate-700">เวลาออก</Label>
                  <Input
                    id="check_out_time"
                    type="time"
                    value={formData.check_out_time ?? '17:00'}
                    onChange={e => setFormData(prev => ({ ...prev, check_out_time: e.target.value }))}
                    className="h-10 font-mono bg-white"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* กิจกรรมและสถานที่ */}
          <Card className="shadow-xs">
            <CardHeader className="py-3.5 px-5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold shrink-0">
                  <ActivityIcon className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold text-slate-800">กิจกรรมและสถานที่</CardTitle>
                  <p className="text-xs text-slate-500 font-normal">เลือกกิจกรรมที่เข้าปฏิบัติงานจากระบบ</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">กิจกรรม (เลือกจากระบบ)</Label>
                <Select
                  value={formData.activity_id ?? '__manual__'}
                  onValueChange={(v: string | null) => v && handleActivitySelect(v)}
                >
                  <SelectTrigger className="h-10 w-full bg-white">
                    <SelectValue placeholder="เลือกกิจกรรม..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__manual__">-- กรอกเอง --</SelectItem>
                    {activities.map(a => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} {a.tasks ? `(${a.tasks})` : ''} {a.location ? `· ${a.location}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="activity_name" className="text-xs font-semibold text-slate-700">ชื่อกิจกรรม / ระบบงาน</Label>
                  <Input
                    id="activity_name"
                    value={formData.activity_name ?? ''}
                    onChange={e => setFormData(prev => ({ ...prev, activity_name: e.target.value }))}
                    placeholder="เช่น งานปูกระเบื้อง..."
                    className="h-10 bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="location" className="text-xs font-semibold text-slate-700">สถานที่ / โรง</Label>
                  <Input
                    id="location"
                    value={formData.location ?? ''}
                    onChange={e => setFormData(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="เช่น โรง 3, พื้นที่ A..."
                    className="h-10 bg-white"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* ALC */}
          <Card className="shadow-xs">
            <CardHeader className="py-3.5 px-5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold shrink-0">
                  <Wine className="w-4 h-4" />
                </div>
                <CardTitle className="text-sm font-bold text-slate-800">ผลตรวจ ALC</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-5">
              <div className="grid grid-cols-3 gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, alc_result: '0' }))}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                    isAlcoholPassed(formData.alc_result)
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm ring-2 ring-emerald-200'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-white hover:border-slate-300'
                  }`}
                >
                  0 (ปกติ)
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, alc_result: isAlcoholFailed(formData.alc_result) ? formData.alc_result : '25' }))}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                    isAlcoholFailed(formData.alc_result)
                      ? 'bg-rose-600 text-white border-rose-600 shadow-sm ring-2 ring-rose-200'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-white hover:border-slate-300'
                  }`}
                >
                  ระบุค่าเกิน (&gt;0)
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, alc_result: '' }))}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                    isAlcoholUnchecked(formData.alc_result)
                      ? 'bg-slate-700 text-white border-slate-700 shadow-sm ring-2 ring-slate-200'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-white hover:border-slate-300'
                  }`}
                >
                  ยังไม่ได้ตรวจ (ว่าง)
                </button>
              </div>
              <div className="space-y-1">
                <Label htmlFor="custom-alc" className="text-xs text-slate-600 font-normal">หรือพิมพ์ระบุตัวเลข ALC โดยตรง:</Label>
                <Input
                  id="custom-alc"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  placeholder="ยังไม่ได้ตรวจ (ใส่ตัวเลข เช่น 0, 15, 25)"
                  value={isAlcoholUnchecked(formData.alc_result) ? '' : (formData.alc_result ?? '')}
                  onChange={e => setFormData(prev => ({ ...prev, alc_result: e.target.value }))}
                  className="font-mono text-xs"
                />
              </div>
              {isAlcoholFailed(formData.alc_result) && (
                <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <p className="text-xs text-rose-700 font-semibold">พบแอลกอฮอล์! ({formData.alc_result}) ต้องปฏิบัติตามกฎความปลอดภัย</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* PPE */}
          <Card className="shadow-xs">
            <CardHeader className="py-3.5 px-5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold shrink-0">
                  <HardHat className="w-4 h-4" />
                </div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-bold text-slate-800">PPE</CardTitle>
                  <Badge className={`text-xs font-semibold ${ppeCount === activePpeItems.length ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : ppeCount >= Math.ceil(activePpeItems.length / 2) ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-rose-100 text-rose-800 border-rose-300'}`} variant="outline">
                    {ppeCount}/{activePpeItems.length}
                  </Badge>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCheckAllPPE}
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold px-2 py-1 rounded hover:bg-blue-50 transition-colors"
              >
                {allChecked ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
              </button>
            </CardHeader>
            <CardContent className="p-5 space-y-2">
              {activePpeItems.map(item => {
                const isChecked = typeof ppeDetails[item.id] === 'boolean'
                  ? ppeDetails[item.id]
                  : item.id === 'helmet' ? !!formData.ppe_helmet
                  : item.id === 'vest' ? !!formData.ppe_vest
                  : item.id === 'glasses' || item.id === 'shirt' ? !!formData.ppe_shirt
                  : item.id === 'gloves' ? !!formData.ppe_gloves
                  : item.id === 'shoes' ? !!formData.ppe_shoes
                  : false

                return (
                  <label
                    key={item.id}
                    className={`flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer ${
                      isChecked
                        ? 'bg-blue-50/40 border-blue-200 text-slate-900 shadow-xs'
                        : 'bg-slate-50/60 border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id={item.id}
                        checked={isChecked}
                        onCheckedChange={v => {
                          const checked = !!v
                          setPpeDetails(prev => ({ ...prev, [item.id]: checked }))
                          if (item.id === 'helmet') setFormData(prev => ({ ...prev, ppe_helmet: checked }))
                          if (item.id === 'vest') setFormData(prev => ({ ...prev, ppe_vest: checked }))
                          if (item.id === 'glasses' || item.id === 'shirt') setFormData(prev => ({ ...prev, ppe_shirt: checked }))
                          if (item.id === 'gloves') setFormData(prev => ({ ...prev, ppe_gloves: checked }))
                          if (item.id === 'shoes') setFormData(prev => ({ ...prev, ppe_shoes: checked }))
                        }}
                      />
                      <span className="font-medium text-sm">{item.icon} {item.label}</span>
                      {item.required && (
                        <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded font-semibold">บังคับ</span>
                      )}
                    </div>
                    {isChecked ? (
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">✓ ครบ</span>
                    ) : (
                      <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">✗ ไม่มี</span>
                    )}
                  </label>
                )
              })}
            </CardContent>
          </Card>

          {/* อื่นๆ */}
          <Card className="shadow-xs">
            <CardHeader className="py-3.5 px-5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center font-bold shrink-0">
                  <Shield className="w-4 h-4" />
                </div>
                <CardTitle className="text-sm font-bold text-slate-800">อื่นๆ</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="daily_wage" className="text-xs font-semibold text-slate-700">ค่าแรงประจำวัน (บาท)</Label>
                <Input
                  id="daily_wage"
                  type="number"
                  value={formData.daily_wage ?? ''}
                  onChange={e => setFormData(prev => ({
                    ...prev, daily_wage: e.target.value ? Number(e.target.value) : null
                  }))}
                  placeholder="500, 600..."
                  className="h-10"
                />
              </div>
              <Separator className="my-2" />
              <div className="space-y-2">
                {[
                  { key: 'meal_allowance' as const, label: '🍱 เบี้ยเลี้ยงอาหาร (กิน)', activeBorder: 'border-amber-200 bg-amber-50/40 text-amber-900' },
                  { key: 'noise_area' as const, label: '🔊 พื้นที่เสียงดัง', activeBorder: 'border-orange-200 bg-orange-50/40 text-orange-900' },
                  { key: 'is_blacklisted' as const, label: '⛔ บัญชีดำ (ห้ามเข้าปฏิบัติงาน)', activeBorder: 'border-rose-300 bg-rose-50/60 text-rose-900' },
                ].map(f => (
                  <label
                    key={f.key}
                    htmlFor={f.key}
                    className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all cursor-pointer ${
                      formData[f.key]
                        ? f.activeBorder + ' font-medium shadow-xs'
                        : 'bg-slate-50/60 border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    <Checkbox
                      id={f.key}
                      checked={formData[f.key]}
                      onCheckedChange={v => setFormData(prev => ({ ...prev, [f.key]: !!v }))}
                    />
                    <span className="text-sm">{f.label}</span>
                  </label>
                ))}
              </div>
              <Separator className="my-2" />
              <div className="space-y-1.5">
                <Label htmlFor="notes" className="text-xs font-semibold text-slate-700">หมายเหตุ</Label>
                <Input
                  id="notes"
                  value={formData.notes ?? ''}
                  onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="บันทึกเพิ่มเติม..."
                  className="h-10"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Submit Buttons - Fixed on Mobile */}
      <div className="fixed bottom-0 left-0 right-0 md:relative md:bottom-auto bg-white md:bg-transparent border-t md:border-0 p-4 md:p-0 flex gap-3 z-40 shadow-lg md:shadow-none">
        <Link href="/checklist" className="flex-1 md:flex-none">
          <Button type="button" variant="outline" className="w-full md:w-auto">
            ยกเลิก
          </Button>
        </Link>
        <Button
          type="submit"
          disabled={loading}
          className="flex-1 gradient-primary border-0 text-white hover:opacity-90"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> กำลังบันทึก...</>
          ) : (
            <><Save className="w-4 h-4 mr-2" /> {entryId ? 'บันทึกการแก้ไข' : 'เพิ่มรายการ'}</>
          )}
        </Button>
      </div>
    </form>
  )
}
