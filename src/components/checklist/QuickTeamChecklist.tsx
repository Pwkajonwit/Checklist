'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ChecklistEntry, Contractor, Company, Activity, ALCResult, ChecklistPpeItem } from '@/lib/types'
import { getContractorAlcRisk, getContractorDailyWage, isAlcoholPassed, isAlcoholFailed, isAlcoholUnchecked, normalizeAlcForDb, DEFAULT_CHECKLIST_PPE_ITEMS } from '@/lib/types'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  Building2, Users, Check, X, Plus, Search, Sparkles,
  Save, Clock, RotateCcw, Loader2, CheckCircle2, AlertTriangle, Wine, ChevronDown,
  Smartphone, TableProperties, Zap, ChevronUp, ChevronRight, SlidersHorizontal, CheckCheck
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { cleanContractorPosition } from '@/lib/types'
import { extractUserNote } from '@/lib/utils'

// รายการระบบงานหลัก สำหรับคลิกเลือกด่วน หรือแสดงในดรอปดาวน์
const COMMON_TASK_PRESETS = [
  'งานปูกระเบื้อง',
  'งานฝ้าเพดาน',
  'งานก่ออิฐฉาบปูน',
  'งานทาสี',
  'งานระบบไฟฟ้า',
  'งานเชื่อมโครงสร้าง',
  'งานประปา / สุขาภิบาล',
  'งานโครงสร้างเหล็ก',
  'งานเทคอนกรีต',
  'งานติดตั้งกระจก/อะลูมิเนียม',
  'งานติดตั้งแอร์',
  'งานกันซึม / หลังคา',
  'งานทั่วไป',
]

// รายการตัวเลือกแจ้งความประสงค์ด่วน
export const PURPOSE_PRESETS = [
  'ไม่มา',
  'ขอเข้า 08:30',
  'ขอเข้า 09:00',
  'ขอเข้า 09:30',
  'ขอเข้า 10:00',
  ,
]

interface QuickTeamChecklistProps {
  date: string
  entries: ChecklistEntry[]
  onRefreshEntries: () => void
}

interface RowChecklistState {
  alc_result: ALCResult
  ppe_helmet: boolean
  ppe_vest: boolean
  ppe_shirt: boolean
  ppe_gloves: boolean
  ppe_shoes: boolean
  ppe_details?: Record<string, boolean>
  activity_id?: string
  activity_name?: string
  supervisor?: string
  purpose?: string
  location?: string
  notes?: string
}

export function QuickTeamChecklist({ date, entries, onRefreshEntries }: QuickTeamChecklistProps) {
  const supabase = useMemo(() => createClient(), [])

  const [contractors, setContractors] = useState<Contractor[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [savingRowId, setSavingRowId] = useState<string | null>(null)
  const [savingAll, setSavingAll] = useState(false)

  // ── Dynamic Checklist PPE Items ──
  const [ppeConfigItems, setPpeConfigItems] = useState<ChecklistPpeItem[]>(DEFAULT_CHECKLIST_PPE_ITEMS)

  const loadPpeSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings?id=checklist_ppe_items')
      const json = await res.json()
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        setPpeConfigItems(json.data)
      }
    } catch { }
  }, [])

  useEffect(() => {
    loadPpeSettings()
  }, [loadPpeSettings])

  const activePpeItems = useMemo(() => {
    const active = ppeConfigItems.filter(i => i.is_active)
    return active.length > 0 ? active : DEFAULT_CHECKLIST_PPE_ITEMS
  }, [ppeConfigItems])

  const getRowPpeValue = useCallback((st: RowChecklistState, itemId: string): boolean => {
    if (st.ppe_details && typeof st.ppe_details[itemId] === 'boolean') {
      return st.ppe_details[itemId]
    }
    if (itemId === 'helmet') return !!st.ppe_helmet
    if (itemId === 'vest') return !!st.ppe_vest
    if (itemId === 'glasses' || itemId === 'shirt') return !!st.ppe_shirt
    if (itemId === 'gloves') return !!st.ppe_gloves
    if (itemId === 'shoes') return !!st.ppe_shoes
    return false
  }, [])

  const updateRowPpeValue = useCallback((contractorId: string, itemId: string, val: boolean) => {
    setRowStates(prev => {
      const cur = prev[contractorId] || {
        alc_result: '',
        ppe_helmet: false,
        ppe_vest: false,
        ppe_shirt: false,
        ppe_gloves: false,
        ppe_shoes: false,
      }
      const curDetails = cur.ppe_details || {
        helmet: !!cur.ppe_helmet,
        vest: !!cur.ppe_vest,
        glasses: !!cur.ppe_shirt,
        shirt: !!cur.ppe_shirt,
        gloves: !!cur.ppe_gloves,
        shoes: !!cur.ppe_shoes,
      }
      const nextDetails = { ...curDetails, [itemId]: val }
      const updates: Partial<RowChecklistState> = { ppe_details: nextDetails }
      if (itemId === 'helmet') updates.ppe_helmet = val
      if (itemId === 'vest') updates.ppe_vest = val
      if (itemId === 'glasses' || itemId === 'shirt') updates.ppe_shirt = val
      if (itemId === 'gloves') updates.ppe_gloves = val
      if (itemId === 'shoes') updates.ppe_shoes = val

      return {
        ...prev,
        [contractorId]: { ...cur, ...updates },
      }
    })
  }, [])

  const getRowPpePassedCount = useCallback((st: RowChecklistState): number => {
    return activePpeItems.filter(it => getRowPpeValue(st, it.id)).length
  }, [activePpeItems, getRowPpeValue])

  const isRowAllPpePassed = useCallback((st: RowChecklistState): boolean => {
    return activePpeItems.every(it => {
      if (!it.required) return true
      return getRowPpeValue(st, it.id)
    })
  }, [activePpeItems, getRowPpeValue])

  // Filtering
  const [selectedCompany, setSelectedCompany] = useState<string>('all')
  const [searchAffiliation, setSearchAffiliation] = useState('')
  const [searchMember, setSearchMember] = useState('')

  // View mode & Mobile states
  const [viewMode, setViewMode] = useState<'auto' | 'mobile' | 'desktop'>('auto')
  const [isSmallScreen, setIsSmallScreen] = useState(false)
  const [mobileStatusFilter, setMobileStatusFilter] = useState<'all' | 'pending' | 'checked'>('all')
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({})
  const [showMobilePresets, setShowMobilePresets] = useState(false)

  useEffect(() => {
    const checkSize = () => setIsSmallScreen(window.innerWidth < 1024)
    checkSize()
    window.addEventListener('resize', checkSize)
    return () => window.removeEventListener('resize', checkSize)
  }, [])

  const effectiveView = viewMode === 'auto' ? (isSmallScreen ? 'mobile' : 'desktop') : viewMode

  // Presets: กำหนดเวลาเข้า-ออก และค่าเริ่มต้นของทีม
  const [defaultCheckIn, setDefaultCheckIn] = useState('08:00')
  const [defaultCheckOut, setDefaultCheckOut] = useState('17:00')
  const [defaultSupervisor, setDefaultSupervisor] = useState('')
  const [currentUserSupervisor, setCurrentUserSupervisor] = useState('')
  const [defaultActivityId, setDefaultActivityId] = useState('')
  const [defaultActivityName, setDefaultActivityName] = useState('')
  const [defaultLocation, setDefaultLocation] = useState('')

  // Load Logged-in User Profile to set Default Supervisor
  useEffect(() => {
    const fetchSupervisor = async () => {
      try {
        // 1. Try session from /api/auth/me (Current Login Session)
        const res = await fetch('/api/auth/me')
        if (res.ok) {
          const authData = await res.json()
          if (authData.success && authData.user) {
            const sName =
              authData.user.full_name?.trim() ||
              authData.user.email?.trim() ||
              authData.user.phone?.trim() ||
              ''
            if (sName) {
              setCurrentUserSupervisor(sName)
              setDefaultSupervisor(prev => prev || sName)
              return
            }
          }
        }

        // 2. Fallback to Supabase Auth
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('full_name, email')
            .eq('id', user.id)
            .single()
          const sName = profile?.full_name?.trim() || user.user_metadata?.full_name?.trim() || profile?.email || user.email || ''
          if (sName) {
            setCurrentUserSupervisor(sName)
            setDefaultSupervisor(prev => prev || sName)
          }
        }
      } catch (e) { }
    }
    fetchSupervisor()
  }, [supabase])

  // Sync default supervisor to empty rows
  useEffect(() => {
    if (defaultSupervisor) {
      setRowStates(prev => {
        let changed = false
        const next = { ...prev }
        Object.keys(next).forEach(id => {
          if (!next[id]?.supervisor) {
            next[id] = { ...next[id], supervisor: defaultSupervisor }
            changed = true
          }
        })
        return changed ? next : prev
      })
    }
  }, [defaultSupervisor])

  // Row states
  const [rowStates, setRowStates] = useState<Record<string, RowChecklistState>>({})

  // Quick Add Member Dialog
  const [newMemberOpen, setNewMemberOpen] = useState(false)
  const [newMemberName, setNewMemberName] = useState('')
  const [newMemberPosition, setNewMemberPosition] = useState('')
  const [newMemberPhone, setNewMemberPhone] = useState('')
  const [savingNewMember, setSavingNewMember] = useState(false)

  // Fetch Master Data
  const loadMasterData = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data: cData, error: cErr }, { data: coData, error: coErr }, { data: aData, error: aErr }] =
        await Promise.all([
          supabase.from('contractors').select('*').eq('is_active', true).order('name'),
          supabase.from('companies').select('*').order('name'),
          supabase.from('activities').select('*').eq('is_active', true).order('name'),
        ])

      if (cErr) throw cErr
      if (coErr) throw coErr
      const loadedActivities = aData ?? []
      setContractors(cData ?? [])
      setCompanies(coData ?? [])
      setActivities(loadedActivities)

      if (loadedActivities.length > 0 && !defaultActivityId) {
        const firstAct = loadedActivities[0]
        setDefaultActivityId(firstAct.id)
        const firstTasks = firstAct.tasks ? (firstAct.tasks as string).split(/[,;\n]/).map((s: string) => s.trim()).filter(Boolean) : []
        setDefaultActivityName(firstTasks[0] || firstAct.name)
        setDefaultLocation(firstAct.location ?? '')
      }
    } catch (err: unknown) {
      console.error('Master data load error:', err)
      toast.error('ไม่สามารถโหลดข้อมูลหลักได้')
    } finally {
      setLoading(false)
    }
  }, [supabase, defaultActivityId])

  // Helper เพื่อดึงรายชื่องานของกิจกรรมนั้น ๆ โดยตรงจากข้อมูลกิจกรรม (tasks)
  const getTasksForActivity = useCallback((activityId?: string) => {
    const targetId = activityId || defaultActivityId
    const act = activities.find(a => a.id === targetId)
    if (!act) return []

    const actTasks = act.tasks
      ? (act.tasks as string).split(/[,;\n]/).map((s: string) => s.trim()).filter(Boolean)
      : []

    if (actTasks.length > 0) {
      return Array.from(new Set(actTasks))
    }

    return [act.name]
  }, [activities, defaultActivityId])

  useEffect(() => {
    loadMasterData()
  }, [loadMasterData])

  // Sync Supabase entries into rowStates
  useEffect(() => {
    const newStates: Record<string, RowChecklistState> = {}

    contractors.forEach(c => {
      const entry = entries.find(
        e => (e.contractor_id && e.contractor_id === c.id) || e.contractor_name === c.name
      )

      if (entry) {
        let details: Record<string, boolean> | undefined = undefined
        try {
          if (entry.notes) {
            const parsed = JSON.parse(entry.notes)
            if (parsed?.ppe_details && typeof parsed.ppe_details === 'object') {
              details = parsed.ppe_details
            }
          }
        } catch { }

        newStates[c.id] = {
          alc_result: entry.alc_result,
          ppe_helmet: entry.ppe_helmet ?? false,
          ppe_vest: entry.ppe_vest ?? false,
          ppe_shirt: entry.ppe_shirt ?? false,
          ppe_gloves: entry.ppe_gloves ?? false,
          ppe_shoes: entry.ppe_shoes ?? false,
          ppe_details: details,
          supervisor: entry.supervisor ?? defaultSupervisor ?? currentUserSupervisor ?? undefined,
          activity_id: entry.activity_id ?? undefined,
          activity_name: entry.activity_name ?? undefined,
          purpose: entry.purpose ?? undefined,
          location: entry.location ?? undefined,
          notes: extractUserNote(entry.notes) || undefined,
        }
      } else {
        newStates[c.id] = newStates[c.id] || {
          alc_result: '',
          ppe_helmet: false,
          ppe_vest: false,
          ppe_shirt: false,
          ppe_gloves: false,
          ppe_shoes: false,
          supervisor: defaultSupervisor || currentUserSupervisor || undefined,
          activity_id: defaultActivityId || undefined,
          activity_name: defaultActivityName || undefined,
          location: defaultLocation || undefined,
        }
      }
    })

    setRowStates(prev => ({ ...newStates, ...prev }))
  }, [contractors, entries, defaultActivityId, defaultActivityName, defaultLocation, defaultSupervisor, currentUserSupervisor])

  // Affiliation summary for LEFT COLUMN
  const affiliationList = useMemo(() => {
    const map = new Map<string, { id?: string; name: string; total: number; checked: number }>()

    companies.forEach(co => {
      map.set(co.name.trim(), {
        id: co.id,
        name: co.name.trim(),
        total: 0,
        checked: 0,
      })
    })

    contractors.forEach(c => {
      const compName = (c.company_name || 'ไม่ระบุสังกัด').trim()
      if (!map.has(compName)) {
        map.set(compName, {
          id: c.company_id ?? undefined,
          name: compName,
          total: 0,
          checked: 0,
        })
      }
      const entry = map.get(compName)!
      entry.total += 1

      const isChecked = entries.some(
        e => (e.contractor_id && e.contractor_id === c.id) || e.contractor_name === c.name
      )
      if (isChecked) entry.checked += 1
    })

    const allItems = Array.from(map.values()).sort((a, b) => {
      if (a.name === 'ไม่ระบุสังกัด') return 1
      if (b.name === 'ไม่ระบุสังกัด') return -1
      return a.name.localeCompare(b.name, 'th')
    })

    if (!searchAffiliation) return allItems
    return allItems.filter(item =>
      item.name.toLowerCase().includes(searchAffiliation.toLowerCase())
    )
  }, [companies, contractors, entries, searchAffiliation])

  // Filtered members for current company
  const currentTeamMembers = useMemo(() => {
    return contractors.filter(c => {
      const compName = (c.company_name || 'ไม่ระบุสังกัด').trim()
      const matchComp = selectedCompany === 'all' || compName === selectedCompany
      const matchSearch =
        !searchMember ||
        c.name.toLowerCase().includes(searchMember.toLowerCase()) ||
        (c.position && c.position.toLowerCase().includes(searchMember.toLowerCase())) ||
        (c.phone && c.phone.includes(searchMember))
      return matchComp && matchSearch
    })
  }, [contractors, selectedCompany, searchMember])

  const getEntryForContractor = useCallback(
    (c: Contractor): ChecklistEntry | undefined => {
      return entries.find(
        e => (e.contractor_id && e.contractor_id === c.id) || e.contractor_name === c.name
      )
    },
    [entries]
  )

  const getRowState = (contractorId: string): RowChecklistState => {
    return (
      rowStates[contractorId] || {
        alc_result: '',
        ppe_helmet: false,
        ppe_vest: false,
        ppe_shirt: false,
        ppe_gloves: false,
        ppe_shoes: false,
        supervisor: defaultSupervisor || currentUserSupervisor || undefined,
        activity_id: defaultActivityId || undefined,
        activity_name: defaultActivityName || undefined,
        location: defaultLocation || undefined,
      }
    )
  }

  const updateRow = (contractorId: string, updates: Partial<RowChecklistState>) => {
    setRowStates(prev => {
      const cur = prev[contractorId] || {
        alc_result: '',
        ppe_helmet: false,
        ppe_vest: false,
        ppe_shirt: false,
        ppe_gloves: false,
        ppe_shoes: false,
        supervisor: defaultSupervisor || currentUserSupervisor || undefined,
        activity_id: defaultActivityId || undefined,
        activity_name: defaultActivityName || undefined,
        location: defaultLocation || undefined,
      }
      return {
        ...prev,
        [contractorId]: { ...cur, ...updates },
      }
    })
  }

  // Toggle row PPE
  const togglePassAllRow = (contractorId: string) => {
    const cur = getRowState(contractorId)
    const isAllPass = isRowAllPpePassed(cur) && isAlcoholPassed(cur.alc_result)
    const targetState = !isAllPass

    const nextDetails: Record<string, boolean> = {}
    activePpeItems.forEach(it => {
      nextDetails[it.id] = targetState
    })

    updateRow(contractorId, {
      alc_result: targetState ? '0' : '',
      ppe_helmet: targetState,
      ppe_vest: targetState,
      ppe_shirt: targetState,
      ppe_gloves: targetState,
      ppe_shoes: targetState,
      ppe_details: nextDetails,
    })
  }

  // Bulk column toggles
  const bulkToggleColumn = (itemId: string) => {
    const allCurrentTrue = currentTeamMembers.every(c => getRowPpeValue(getRowState(c.id), itemId))
    const nextVal = !allCurrentTrue

    setRowStates(prev => {
      const updated = { ...prev }
      currentTeamMembers.forEach(c => {
        const cur = updated[c.id] || {
          alc_result: '',
          ppe_helmet: false,
          ppe_vest: false,
          ppe_shirt: false,
          ppe_gloves: false,
          ppe_shoes: false,
        }
        const curDetails = cur.ppe_details || {
          helmet: !!cur.ppe_helmet,
          vest: !!cur.ppe_vest,
          glasses: !!cur.ppe_shirt,
          shirt: !!cur.ppe_shirt,
          gloves: !!cur.ppe_gloves,
          shoes: !!cur.ppe_shoes,
        }
        const nextDetails = { ...curDetails, [itemId]: nextVal }
        const patch: Partial<RowChecklistState> = { ppe_details: nextDetails }
        if (itemId === 'helmet') patch.ppe_helmet = nextVal
        if (itemId === 'vest') patch.ppe_vest = nextVal
        if (itemId === 'glasses' || itemId === 'shirt') patch.ppe_shirt = nextVal
        if (itemId === 'gloves') patch.ppe_gloves = nextVal
        if (itemId === 'shoes') patch.ppe_shoes = nextVal

        updated[c.id] = { ...cur, ...patch }
      })
      return updated
    })
  }

  const bulkToggleALC = () => {
    const all0 = currentTeamMembers.every(c => isAlcoholPassed(getRowState(c.id).alc_result))
    const nextVal: ALCResult = all0 ? '' : '0'

    setRowStates(prev => {
      const updated = { ...prev }
      currentTeamMembers.forEach(c => {
        const cur = updated[c.id] || {
          alc_result: '',
          ppe_helmet: false,
          ppe_vest: false,
          ppe_shirt: false,
          ppe_gloves: false,
          ppe_shoes: false,
        }
        updated[c.id] = { ...cur, alc_result: nextVal }
      })
      return updated
    })
  }

  const handlePassAllTeam = () => {
    const nextDetails: Record<string, boolean> = {}
    activePpeItems.forEach(it => {
      nextDetails[it.id] = true
    })

    setRowStates(prev => {
      const updated = { ...prev }
      currentTeamMembers.forEach(c => {
        const cur = updated[c.id] || {}
        updated[c.id] = {
          ...cur,
          alc_result: '0%',
          ppe_helmet: true,
          ppe_vest: true,
          ppe_shirt: true,
          ppe_gloves: true,
          ppe_shoes: true,
          ppe_details: nextDetails,
          activity_id: cur.activity_id || defaultActivityId || undefined,
          activity_name: cur.activity_name || defaultActivityName || undefined,
          location: cur.location || defaultLocation || undefined,
        }
      })
      return updated
    })
    toast.success('ตั้งค่าให้ลูกทีมทุกคนผ่าน Checklist ครบทุกข้อแล้ว')
  }

  const getErrorMessage = (err: any): string => {
    if (!err) return 'ข้อผิดพลาดที่ไม่ทราบสาเหตุ'
    if (typeof err === 'string') return err
    return err.message || err.details || err.hint || JSON.stringify(err)
  }

  // Save single row
  const handleSaveRow = async (contractor: Contractor) => {
    setSavingRowId(contractor.id)
    const st = getRowState(contractor.id)
    const existingEntry = getEntryForContractor(contractor)

    const memberWage = getContractorDailyWage(contractor)

    const ppeDetails: Record<string, boolean> = {}
    activePpeItems.forEach(it => {
      ppeDetails[it.id] = getRowPpeValue(st, it.id)
    })

    let notesStr: string | null = null
    try {
      const cleanUserNote = extractUserNote(st.notes) || extractUserNote(existingEntry?.notes)
      notesStr = JSON.stringify({
        ppe_details: ppeDetails,
        ...(cleanUserNote ? { user_note: cleanUserNote } : {})
      })
    } catch {
      notesStr = JSON.stringify({ ppe_details: ppeDetails })
    }

    const payload = {
      entry_date: date,
      contractor_id: contractor.id || null,
      contractor_name: contractor.name,
      company_name: contractor.company_name || (selectedCompany !== 'all' ? selectedCompany : null),
      supervisor: (st.supervisor || defaultSupervisor || currentUserSupervisor || '').trim() || null,
      purpose: (st.purpose || '').trim() || null,
      activity_id: (st.activity_id || defaultActivityId || '').trim() || null,
      activity_name: (st.activity_name || defaultActivityName || '').trim() || null,
      location: (st.location || defaultLocation || '').trim() || null,
      check_in_time: (defaultCheckIn || '').trim() || null,
      check_out_time: (defaultCheckOut || '').trim() || null,
      alc_result: normalizeAlcForDb(st.alc_result),
      ppe_helmet: ppeDetails['helmet'] ?? !!st.ppe_helmet,
      ppe_vest: ppeDetails['vest'] ?? !!st.ppe_vest,
      ppe_shirt: ppeDetails['glasses'] ?? ppeDetails['shirt'] ?? !!st.ppe_shirt,
      ppe_gloves: ppeDetails['gloves'] ?? !!st.ppe_gloves,
      ppe_shoes: ppeDetails['shoes'] ?? !!st.ppe_shoes,
      daily_wage: (memberWage !== null && memberWage !== undefined && !isNaN(memberWage)) ? memberWage : (existingEntry?.daily_wage ?? null),
      status: 'active' as const,
      is_blacklisted: false,
      meal_allowance: false,
      notes: notesStr,
    }

    try {
      if (existingEntry) {
        const res = await fetch(`/api/checklist/${existingEntry.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const errData = await res.json()
          throw new Error(errData.error)
        }
        toast.success(`อัปเดต ${contractor.name} สำเร็จ`)
      } else {
        const res = await fetch('/api/checklist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const errData = await res.json()
          throw new Error(errData.error)
        }
        toast.success(`บันทึก ${contractor.name} สำเร็จ`)
      }
      onRefreshEntries()
    } catch (err: any) {
      console.error('Save checklist error:', {
        message: err?.message,
        details: err?.details,
        hint: err?.hint,
        code: err?.code,
        raw: err,
      })
      toast.error(`บันทึกไม่สำเร็จ: ${getErrorMessage(err)}`)
    } finally {
      setSavingRowId(null)
    }
  }

  // Save all rows
  const handleSaveAll = async () => {
    setSavingAll(true)
    try {
      const inserts: any[] = []
      const updates: { id: string; payload: any }[] = []

      currentTeamMembers.forEach(c => {
        const st = getRowState(c.id)
        const existingEntry = getEntryForContractor(c)
        const memberWage = getContractorDailyWage(c)

        const ppeDetails: Record<string, boolean> = {}
        activePpeItems.forEach(it => {
          ppeDetails[it.id] = getRowPpeValue(st, it.id)
        })

        let notesStr: string | null = null
        try {
          const cleanUserNote = extractUserNote(st.notes) || extractUserNote(existingEntry?.notes)
          notesStr = JSON.stringify({
            ppe_details: ppeDetails,
            ...(cleanUserNote ? { user_note: cleanUserNote } : {})
          })
        } catch {
          notesStr = JSON.stringify({ ppe_details: ppeDetails })
        }

        const payload = {
          entry_date: date,
          contractor_id: c.id || null,
          contractor_name: c.name,
          company_name: c.company_name || (selectedCompany !== 'all' ? selectedCompany : null),
          supervisor: (st.supervisor || defaultSupervisor || currentUserSupervisor || '').trim() || null,
          purpose: (st.purpose || '').trim() || null,
          activity_id: (st.activity_id || defaultActivityId || '').trim() || null,
          activity_name: (st.activity_name || defaultActivityName || '').trim() || null,
          location: (st.location || defaultLocation || '').trim() || null,
          check_in_time: (defaultCheckIn || '').trim() || null,
          check_out_time: (defaultCheckOut || '').trim() || null,
          alc_result: normalizeAlcForDb(st.alc_result),
          ppe_helmet: ppeDetails['helmet'] ?? !!st.ppe_helmet,
          ppe_vest: ppeDetails['vest'] ?? !!st.ppe_vest,
          ppe_shirt: ppeDetails['glasses'] ?? ppeDetails['shirt'] ?? !!st.ppe_shirt,
          ppe_gloves: ppeDetails['gloves'] ?? !!st.ppe_gloves,
          ppe_shoes: ppeDetails['shoes'] ?? !!st.ppe_shoes,
          daily_wage: (memberWage !== null && memberWage !== undefined && !isNaN(memberWage)) ? memberWage : (existingEntry?.daily_wage ?? null),
          status: 'active' as const,
          is_blacklisted: false,
          meal_allowance: false,
          notes: notesStr,
        }

        if (existingEntry) {
          updates.push({ id: existingEntry.id, payload })
        } else {
          inserts.push(payload)
        }
      })

      if (inserts.length > 0) {
        const res = await fetch('/api/checklist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(inserts),
        })
        if (!res.ok) {
          const errData = await res.json()
          throw new Error(errData.error)
        }
      }

      for (const u of updates) {
        const res = await fetch(`/api/checklist/${u.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(u.payload),
        })
        if (!res.ok) {
          const errData = await res.json()
          throw new Error(errData.error)
        }
      }

      toast.success(`บันทึก Checklist ${currentTeamMembers.length} คนเรียบร้อยแล้ว`)
      onRefreshEntries()
    } catch (err: any) {
      console.error('Save all checklist error:', {
        message: err?.message,
        details: err?.details,
        hint: err?.hint,
        code: err?.code,
        raw: err,
      })
      toast.error(`บันทึกไม่สำเร็จ: ${getErrorMessage(err)}`)
    } finally {
      setSavingAll(false)
    }
  }

  const handleDeleteRowEntry = async (entryId: string, name: string) => {
    if (!confirm(`ต้องการยกเลิกการบันทึก Checklist ของ "${name}" ใช่หรือไม่?`)) return
    try {
      const res = await fetch(`/api/checklist/${entryId}`, { method: 'DELETE' })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'ยกเลิกไม่สำเร็จ')
      }
      toast.info(`ยกเลิกผลการตรวจของ ${name} แล้ว`)
      onRefreshEntries()
    } catch (err: unknown) {
      console.error('Delete entry error:', err)
      toast.error('ยกเลิกไม่สำเร็จ')
    }
  }

  const handleSaveNewMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMemberName.trim()) {
      toast.error('กรุณากรอกชื่อลูกทีม')
      return
    }

    setSavingNewMember(true)
    const compName = selectedCompany !== 'all' ? selectedCompany : ''
    const compObj = companies.find(c => c.name.trim() === compName)

    try {
      const { data, error } = await supabase
        .from('contractors')
        .insert({
          name: newMemberName.trim(),
          company_id: compObj ? compObj.id : null,
          company_name: compName || null,
          position: newMemberPosition.trim() || null,
          phone: newMemberPhone.trim() || null,
          employee_type: 'contractor',
          is_active: true,
        })
        .select()
        .single()

      if (error) throw error

      toast.success(`เพิ่ม "${newMemberName}" เข้าทีมสำเร็จ`)
      setContractors(prev => [...prev, data])
      setNewMemberName('')
      setNewMemberPosition('')
      setNewMemberPhone('')
      setNewMemberOpen(false)
    } catch (err: unknown) {
      console.error('Add member error:', err)
      toast.error('เพิ่มลูกทีมไม่สำเร็จ')
    } finally {
      setSavingNewMember(false)
    }
  }

  const totalContractorsCount = contractors.length
  const totalEntriesCount = entries.length
  const checkedCount = currentTeamMembers.filter(c => getEntryForContractor(c)).length
  const totalCount = currentTeamMembers.length
  const uncheckedCount = currentTeamMembers.filter(c => !getEntryForContractor(c)).length

  // Filtered members for Mobile (support pending / checked / all tabs)
  const mobileFilteredMembers = useMemo(() => {
    if (mobileStatusFilter === 'pending') {
      return currentTeamMembers.filter(c => !getEntryForContractor(c))
    }
    if (mobileStatusFilter === 'checked') {
      return currentTeamMembers.filter(c => !!getEntryForContractor(c))
    }
    return currentTeamMembers
  }, [currentTeamMembers, mobileStatusFilter, getEntryForContractor])

  // ⚡ 1-Tap Quick Pass for Single Member
  const handleQuickPassMember = async (contractor: Contractor) => {
    setSavingRowId(contractor.id)
    const existingEntry = getEntryForContractor(contractor)
    const memberWage = getContractorDailyWage(contractor)

    const quickPpeDetails: Record<string, boolean> = {}
    activePpeItems.forEach(it => { quickPpeDetails[it.id] = true })

    const updatedRowState: RowChecklistState = {
      ...getRowState(contractor.id),
      alc_result: '0%',
      ppe_helmet: true,
      ppe_vest: true,
      ppe_shirt: true,
      ppe_gloves: true,
      ppe_shoes: true,
      ppe_details: quickPpeDetails,
      activity_id: defaultActivityId || undefined,
      activity_name: defaultActivityName || undefined,
      location: defaultLocation || undefined,
    }
    updateRow(contractor.id, updatedRowState)

    const payload = {
      entry_date: date,
      contractor_id: contractor.id || null,
      contractor_name: contractor.name,
      company_name: contractor.company_name || (selectedCompany !== 'all' ? selectedCompany : null),
      supervisor: (updatedRowState.supervisor || defaultSupervisor || currentUserSupervisor || '').trim() || null,
      purpose: (updatedRowState.purpose || '').trim() || null,
      activity_id: (updatedRowState.activity_id || defaultActivityId || '').trim() || null,
      activity_name: (updatedRowState.activity_name || defaultActivityName || '').trim() || null,
      location: (updatedRowState.location || defaultLocation || '').trim() || null,
      check_in_time: (defaultCheckIn || '').trim() || null,
      check_out_time: (defaultCheckOut || '').trim() || null,
      alc_result: '0' as ALCResult,
      ppe_helmet: quickPpeDetails['helmet'] ?? true,
      ppe_vest: quickPpeDetails['vest'] ?? true,
      ppe_shirt: quickPpeDetails['glasses'] ?? quickPpeDetails['shirt'] ?? true,
      ppe_gloves: quickPpeDetails['gloves'] ?? true,
      ppe_shoes: quickPpeDetails['shoes'] ?? true,
      daily_wage: (memberWage !== null && memberWage !== undefined && !isNaN(memberWage)) ? memberWage : (existingEntry?.daily_wage ?? null),
      status: 'active' as const,
      is_blacklisted: false,
      meal_allowance: false,
      notes: JSON.stringify({
        ppe_details: quickPpeDetails,
        ...(extractUserNote(existingEntry?.notes) ? { user_note: extractUserNote(existingEntry?.notes) } : {}),
      }),
    }

    try {
      if (existingEntry) {
        const res = await fetch(`/api/checklist/${existingEntry.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const errData = await res.json()
          throw new Error(errData.error)
        }
      } else {
        const res = await fetch('/api/checklist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const errData = await res.json()
          throw new Error(errData.error)
        }
      }
      toast.success(`⚡ ตรวจผ่าน: ${contractor.name}`)
      onRefreshEntries()
    } catch (err: any) {
      console.error('Quick pass error:', {
        message: err?.message,
        details: err?.details,
        hint: err?.hint,
        code: err?.code,
        raw: err,
      })
      toast.error(`บันทึกไม่สำเร็จ: ${getErrorMessage(err)}`)
    } finally {
      setSavingRowId(null)
    }
  }

  // ⚡ 1-Tap Quick Pass for All Remaining Unchecked in Team
  const handleQuickPassRemaining = async () => {
    const pending = currentTeamMembers.filter(c => !getEntryForContractor(c))
    if (pending.length === 0) {
      toast.info('ทุกคนในสังกัดนี้ตรวจบันทึกครบแล้ว')
      return
    }

    setSavingAll(true)
    try {
      const defaultPpeDetails: Record<string, boolean> = {}
      activePpeItems.forEach(it => { defaultPpeDetails[it.id] = true })

      const inserts = pending.map(c => {
        const row = getRowState(c.id)
        const memberWage = getContractorDailyWage(c)
        return {
          entry_date: date,
          contractor_id: c.id || null,
          contractor_name: c.name,
          company_name: c.company_name || (selectedCompany !== 'all' ? selectedCompany : null),
          supervisor: (row.supervisor || defaultSupervisor || currentUserSupervisor || '').trim() || null,
          purpose: (row.purpose || '').trim() || null,
          activity_id: (row.activity_id || defaultActivityId || '').trim() || null,
          activity_name: (row.activity_name || defaultActivityName || '').trim() || null,
          location: (row.location || defaultLocation || '').trim() || null,
          check_in_time: (defaultCheckIn || '').trim() || null,
          check_out_time: (defaultCheckOut || '').trim() || null,
          alc_result: '0' as ALCResult,
          ppe_helmet: true,
          ppe_vest: true,
          ppe_shirt: true,
          ppe_gloves: true,
          ppe_shoes: true,
          daily_wage: (memberWage !== null && memberWage !== undefined && !isNaN(memberWage)) ? memberWage : null,
          status: 'active' as const,
          is_blacklisted: false,
          meal_allowance: false,
          notes: JSON.stringify({
            ppe_details: row.ppe_details || defaultPpeDetails,
            ...(extractUserNote(row.notes) ? { user_note: extractUserNote(row.notes) } : {}),
          }),
        }
      })

      const res = await fetch('/api/checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inserts),
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error)
      }
      toast.success(`⚡ ตรวจผ่านด่วนทั้งหมด ${inserts.length} คน เรียบร้อย!`)
      onRefreshEntries()
    } catch (err: any) {
      console.error('Quick pass all error:', {
        message: err?.message,
        details: err?.details,
        hint: err?.hint,
        code: err?.code,
        raw: err,
      })
      toast.error(`บันทึกไม่สำเร็จ: ${getErrorMessage(err)}`)
    } finally {
      setSavingAll(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-135px)] min-h-[500px] select-none">
      {/* ══════════════════════════════════════════════════════════════════════════
          1. MOBILE VIEW (โหมดการ์ดตรวจด่วนบนมือถือ แตะผ่านเร็ว 1-Tap)
      ══════════════════════════════════════════════════════════════════════════ */}
      {effectiveView === 'mobile' ? (
        <div className="flex flex-col flex-1 min-h-0 h-full bg-slate-100 rounded-lg border border-slate-300 overflow-hidden shadow-2xs">
          {/* Top Horizontal Affiliation Carousel (Chips) */}
          <div className="bg-slate-200/90 border-b border-slate-300 p-2 shrink-0">
            <div className="flex items-center justify-between mb-1.5 px-0.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                <Building2 className="w-4 h-4 text-blue-700" />
                <span>สังกัด / บริษัท</span>
              </div>

              <div className="flex items-center gap-1.5">
                {/* View Mode Toggle */}
                <div className="flex items-center p-0.5 rounded bg-white border border-slate-300 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setViewMode('mobile')}
                    className="px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-all bg-blue-600 text-white shadow-2xs"
                    title="โหมดการ์ดตรวจด่วนบนมือถือ"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>การ์ด</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('desktop')}
                    className="px-2.5 py-1 rounded text-xs font-normal flex items-center gap-1 transition-all text-slate-600 hover:text-slate-900"
                    title="โหมดตาราง Spreadsheet"
                  >
                    <TableProperties className="w-3.5 h-3.5" />
                    <span>ตาราง</span>
                  </button>
                </div>

                <button
                  onClick={() => setNewMemberOpen(true)}
                  className="text-xs font-semibold px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white inline-flex items-center gap-1 shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>เพิ่มคน</span>
                </button>
              </div>
            </div>

            {/* Horizontal Scrollable Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none select-none">
              {/* All */}
              <button
                onClick={() => setSelectedCompany('all')}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs transition-all flex items-center gap-1.5 ${selectedCompany === 'all'
                  ? 'bg-blue-700 text-white font-semibold shadow-sm ring-2 ring-blue-400'
                  : 'bg-white text-slate-800 font-normal border border-slate-300 hover:bg-slate-50'
                  }`}
              >
                <Users className="w-4 h-4" />
                <span>ทุกลูกทีม</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-mono font-normal ${selectedCompany === 'all' ? 'bg-blue-800 text-blue-100' : 'bg-slate-200 text-slate-800'
                    }`}
                >
                  {totalEntriesCount}/{totalContractorsCount}
                </span>
              </button>

              {/* Individual Companies */}
              {affiliationList.map(item => {
                const isSelected = selectedCompany === item.name
                const isCompleted = item.total > 0 && item.checked === item.total

                return (
                  <button
                    key={item.name}
                    onClick={() => setSelectedCompany(item.name)}
                    className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs transition-all flex items-center gap-1.5 ${isSelected
                      ? 'bg-blue-700 text-white font-semibold shadow-sm ring-2 ring-blue-400'
                      : 'bg-white text-slate-800 font-normal border border-slate-300 hover:bg-slate-50'
                      }`}
                  >
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${isCompleted
                        ? 'bg-emerald-400 ring-2 ring-emerald-200'
                        : item.checked > 0
                          ? 'bg-amber-400'
                          : 'bg-slate-400'
                        }`}
                    />
                    <span className="truncate max-w-[150px]">{item.name}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-mono font-normal ${isSelected ? 'bg-blue-800 text-blue-100' : 'bg-slate-200 text-slate-800'
                        }`}
                    >
                      {item.checked}/{item.total}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Mobile Toolbar: Search + Status Filter Tabs + Settings Toggle */}
          <div className="p-2.5 bg-white border-b border-slate-200 shrink-0 space-y-2">
            {/* Search & Batch Pass button */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="ค้นหาชื่อลูกทีม, เบอร์โทร..."
                  value={searchMember}
                  onChange={e => setSearchMember(e.target.value)}
                  className="w-full text-xs pl-9 pr-8 py-2 rounded-lg border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 font-normal placeholder:text-slate-400"
                />
                {searchMember && (
                  <button
                    onClick={() => setSearchMember('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowMobilePresets(!showMobilePresets)}
                className={`p-2 rounded-lg border text-xs flex items-center gap-1.5 font-normal transition-colors ${showMobilePresets
                  ? 'bg-blue-50 text-blue-800 border-blue-300'
                  : 'bg-slate-100 text-slate-700 border-slate-300'
                  }`}
                title="ตั้งค่าเวลากะและกิจกรรมทีม"
              >
                <Clock className="w-4 h-4" />
                <span className="text-xs">{defaultCheckIn}</span>
              </button>
            </div>

            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-100 border border-slate-200">
              <button
                onClick={() => setMobileStatusFilter('all')}
                className={`flex-1 py-1.5 text-center text-xs rounded-md transition-all ${mobileStatusFilter === 'all'
                  ? 'bg-white text-blue-900 font-semibold shadow-2xs'
                  : 'text-slate-600 font-normal hover:text-slate-900'
                  }`}
              >
                ทั้งหมด ({currentTeamMembers.length})
              </button>
              <button
                onClick={() => setMobileStatusFilter('pending')}
                className={`flex-1 py-1.5 text-center text-xs rounded-md transition-all ${mobileStatusFilter === 'pending'
                  ? 'bg-amber-500 text-white font-semibold shadow-2xs'
                  : 'text-slate-600 font-normal hover:text-slate-900'
                  }`}
              >
                ⏳ รอตรวจ ({uncheckedCount})
              </button>
              <button
                onClick={() => setMobileStatusFilter('checked')}
                className={`flex-1 py-1.5 text-center text-xs rounded-md transition-all ${mobileStatusFilter === 'checked'
                  ? 'bg-emerald-600 text-white font-semibold shadow-2xs'
                  : 'text-slate-600 font-normal hover:text-slate-900'
                  }`}
              >
                ✓ ตรวจแล้ว ({checkedCount})
              </button>
            </div>

            {/* Collapsible Mobile Presets */}
            {showMobilePresets && (
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-2.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
                    ตั้งค่าเวลากะ & กิจกรรมของทีม
                  </span>
                  <button
                    onClick={() => setShowMobilePresets(false)}
                    className="text-slate-500 hover:text-slate-800 text-xs font-normal"
                  >
                    ปิด
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-xs text-slate-500 font-normal block mb-1">เวลาเข้า - ออก</label>
                    <div className="flex items-center gap-1 bg-white p-1.5 rounded border border-slate-300">
                      <input
                        type="time"
                        value={defaultCheckIn}
                        onChange={e => setDefaultCheckIn(e.target.value)}
                        className="w-full text-xs font-normal text-slate-900 outline-none"
                      />
                      <span className="text-slate-400">-</span>
                      <input
                        type="time"
                        value={defaultCheckOut}
                        onChange={e => setDefaultCheckOut(e.target.value)}
                        className="w-full text-xs font-normal text-slate-900 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-slate-500 font-normal block mb-1">กิจกรรมทีม</label>
                    <select
                      value={defaultActivityId}
                      onChange={e => {
                        const actId = e.target.value
                        const act = activities.find(a => a.id === actId)
                        const rawTasks = act?.tasks
                          ? act.tasks.split(/[,;\n]/).map(s => s.trim()).filter(Boolean)
                          : []
                        const firstTask = rawTasks[0] || act?.name || ''
                        setDefaultActivityId(actId)
                        setDefaultActivityName(firstTask)
                        if (act?.location) setDefaultLocation(act.location)
                      }}
                      className="w-full text-xs font-normal text-slate-900 bg-white p-1.5 rounded border border-slate-300 outline-none truncate"
                    >
                      <option value="">-- เลือกกิจกรรมทีม --</option>
                      {activities.map(act => (
                        <option key={act.id} value={act.id}>
                          {act.code ? `[${act.code}] ` : ''}
                          {act.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Card Feed */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 min-h-0">
            {mobileFilteredMembers.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
                <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700">ไม่พบรายชื่อลูกทีมในเงื่อนไขนี้</p>
                <p className="text-xs text-slate-500 font-normal mt-1">ลองเปลี่ยนตัวกรอง หรือค้นหาใหม่อีกครั้ง</p>
              </div>
            ) : (
              mobileFilteredMembers.map((member, idx) => {
                const entry = getEntryForContractor(member)
                const isSaved = !!entry
                const st = getRowState(member.id)
                const isRowSaving = savingRowId === member.id
                const hasAlcRisk = getContractorAlcRisk(member)
                const isExpanded = !!expandedDetails[member.id]

                const ppePassedCount = getRowPpePassedCount(st)
                const isAllPpePassed = isRowAllPpePassed(st)
                const effectiveActivityId = st.activity_id || defaultActivityId
                const tasksForMember = getTasksForActivity(effectiveActivityId)
                const selectedTaskValue = st.activity_name || ''

                return (
                  <div
                    key={member.id}
                    className={`rounded-xl border transition-all ${isSaved
                      ? 'bg-emerald-50/50 border-emerald-300 shadow-2xs'
                      : hasAlcRisk
                        ? 'bg-amber-50/40 border-amber-300 shadow-2xs'
                        : 'bg-white border-slate-200 shadow-2xs'
                      }`}
                  >
                    <div className="p-3.5">
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-normal shrink-0 ${isSaved
                              ? 'bg-emerald-600 text-white'
                              : hasAlcRisk
                                ? 'bg-amber-500 text-white'
                                : 'bg-slate-200 text-slate-800'
                              }`}
                          >
                            {idx + 1}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="text-sm font-semibold text-slate-900 truncate">{member.name}</h4>
                              {hasAlcRisk && (
                                <span className="px-2 py-0.5 rounded text-xs font-normal bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 animate-pulse">
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                                  เสี่ยง ALC
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 font-normal truncate mt-0.5">
                              {member.company_name || 'ไม่ระบุสังกัด'} •{' '}
                              {cleanContractorPosition(member.position) || 'ช่างหน้างาน'}
                            </p>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="shrink-0">
                          {isSaved ? (
                            <span className="px-2.5 py-1 rounded-full text-xs font-normal bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1">
                              <Check className="w-3.5 h-3.5 text-emerald-700 stroke-[2.5]" />
                              ตรวจแล้ว
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-xs font-normal bg-slate-100 text-slate-600 border border-slate-200">
                              ยังไม่ตรวจ
                            </span>
                          )}
                        </div>
                      </div>

                      {/* ⚡ 1-TAP QUICK PASS BUTTON (If Not Saved) */}
                      {!isSaved ? (
                        <div className="mt-3">
                          <button
                            onClick={() => handleQuickPassMember(member)}
                            disabled={isRowSaving}
                            className="w-full py-2.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-[0.98] disabled:opacity-50"
                          >
                            {isRowSaving ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Zap className="w-4 h-4 fill-white" />
                            )}
                            <span>⚡ ผ่านทันที 1-Tap (ALC 0% + PPE ครบ)</span>
                          </button>
                        </div>
                      ) : (
                        /* Saved Status Banner */
                        <div className="mt-2.5 py-2 px-3 rounded-lg bg-emerald-100/70 border border-emerald-300 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 text-emerald-950 font-normal min-w-0">
                            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                            <span className="truncate">
                              ผล: {isAlcoholPassed(st.alc_result) ? `ALC ${st.alc_result || '0%'}` : `ALC ${st.alc_result || '>0%'} (เกิน)`} • PPE {ppePassedCount}/{activePpeItems.length} ชิ้น
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            <button
                              onClick={() => handleSaveRow(member)}
                              disabled={isRowSaving}
                              className="px-2.5 py-1 rounded bg-white text-emerald-900 font-medium border border-emerald-300 text-xs hover:bg-emerald-50"
                            >
                              {isRowSaving ? '...' : 'อัปเดต'}
                            </button>
                            <button
                              onClick={() => handleDeleteRowEntry(entry.id, member.name)}
                              className="p-1.5 rounded text-slate-500 hover:text-red-700 hover:bg-red-50"
                              title="ยกเลิกผลการตรวจ"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Ergonomic Safety Toggles */}
                      <div className="mt-3 pt-2.5 border-t border-slate-200/80 space-y-2.5">
                        {/* ALC Toggle & Custom Input */}
                        <div>
                          <div className="text-xs font-semibold text-slate-600 mb-1.5 flex items-center justify-between">
                            <span>ผลตรวจแอลกอฮอล์</span>
                            <span className={`text-xs font-mono px-2 py-0.5 rounded border ${isAlcoholUnchecked(st.alc_result)
                              ? 'bg-slate-100 text-slate-700 border-slate-300'
                              : isAlcoholPassed(st.alc_result)
                                ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                                : 'bg-red-50 text-red-900 border-red-300 font-semibold'
                              }`}>
                              {isAlcoholUnchecked(st.alc_result)
                                ? 'ยังไม่ได้ตรวจ'
                                : isAlcoholPassed(st.alc_result)
                                  ? `${st.alc_result} (ปกติ) ✓`
                                  : `${st.alc_result} (เกินเกณฑ์ ❌)`}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-1.5 mb-2">
                            <button
                              type="button"
                              onClick={() => updateRow(member.id, { alc_result: '0' })}
                              className={`py-1.5 px-2 rounded-lg text-xs font-normal border flex items-center justify-center gap-1 transition-all ${isAlcoholPassed(st.alc_result)
                                ? 'bg-emerald-600 text-white font-semibold border-emerald-700 shadow-2xs'
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                                }`}
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>0 ปกติ</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => updateRow(member.id, { alc_result: isAlcoholFailed(st.alc_result) ? st.alc_result : '25' })}
                              className={`py-1.5 px-2 rounded-lg text-xs font-normal border flex items-center justify-center gap-1 transition-all ${isAlcoholFailed(st.alc_result)
                                ? 'bg-red-600 text-white font-semibold border-red-700 shadow-2xs animate-pulse'
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                                }`}
                            >
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>&gt;0 เกิน</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => updateRow(member.id, { alc_result: '' })}
                              className={`py-1.5 px-2 rounded-lg text-xs font-normal border flex items-center justify-center gap-1 transition-all ${isAlcoholUnchecked(st.alc_result)
                                ? 'bg-slate-700 text-white font-semibold border-slate-800 shadow-2xs'
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                                }`}
                            >
                              <span>ยังไม่ตรวจ</span>
                            </button>
                          </div>
                          <div className="relative flex items-center">
                            <input
                              type="number"
                              inputMode="decimal"
                              step="any"
                              min="0"
                              placeholder="ยังไม่ได้ตรวจ (ใส่ตัวเลข เช่น 0, 15, 25)"
                              value={isAlcoholUnchecked(st.alc_result) ? '' : (st.alc_result ?? '')}
                              onChange={e => updateRow(member.id, { alc_result: e.target.value })}
                              className="w-full text-xs font-normal px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white placeholder:text-slate-400 font-mono"
                            />
                          </div>
                        </div>

                        {/* PPE 5 Items Chips */}
                        <div>
                          <div className="text-xs font-semibold text-slate-600 mb-1.5 flex items-center justify-between">
                            <span>อุปกรณ์ PPE (แตะเพื่อเปิด/ปิด)</span>
                            <button
                              type="button"
                              onClick={() => togglePassAllRow(member.id)}
                              className="text-xs font-normal text-blue-700 hover:text-blue-900"
                            >
                              {isAllPpePassed ? 'ปิดทั้งหมด' : `ผ่านครบ ${activePpeItems.length} ชิ้น`}
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {activePpeItems.map(item => {
                              const val = getRowPpeValue(st, item.id)
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => updateRowPpeValue(member.id, item.id, !val)}
                                  className={`flex items-center gap-1 py-1 px-2 rounded-lg border text-center transition-all active:scale-95 ${val
                                    ? 'bg-emerald-50 text-emerald-900 border-emerald-400 font-semibold shadow-2xs'
                                    : 'bg-slate-50 text-slate-400 border-slate-300 font-normal opacity-60'
                                    }`}
                                >
                                  <span className="text-sm">{item.icon}</span>
                                  <span className="text-xs">{item.label}</span>
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        {/* Expandable Details (Purpose, Task, Custom Save) */}
                        <div>
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedDetails(prev => ({
                                ...prev,
                                [member.id]: !prev[member.id],
                              }))
                            }
                            className="text-xs font-normal text-blue-700 hover:text-blue-900 inline-flex items-center gap-1 mt-1"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                            <span>{isExpanded ? 'ซ่อนรายละเอียดเพิ่มเติม' : 'แก้ไขงาน / ความประสงค์...'}</span>
                          </button>

                          {isExpanded && (
                            <div className="mt-2.5 p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5 text-xs animate-in fade-in duration-100">
                              <div>
                                <label className="text-xs text-slate-500 font-normal block mb-1">งานที่ปฏิบัติ</label>
                                <select
                                  value={
                                    tasksForMember.includes(selectedTaskValue)
                                      ? selectedTaskValue
                                      : selectedTaskValue
                                        ? '__custom_val__'
                                        : ''
                                  }
                                  onChange={e => {
                                    const val = e.target.value
                                    if (val === '__custom__') {
                                      const customVal = window.prompt(
                                        'ระบุชื่องานที่ต้องการ:',
                                        selectedTaskValue || ''
                                      )
                                      if (customVal !== null && customVal.trim() !== '') {
                                        updateRow(member.id, { activity_name: customVal.trim() })
                                      }
                                    } else if (val === '__custom_val__') {
                                      // keep
                                    } else {
                                      updateRow(member.id, { activity_name: val })
                                    }
                                  }}
                                  className="w-full text-xs font-normal p-2 rounded border border-slate-300 bg-white"
                                >
                                  <option value="">-- เลือกงาน --</option>
                                  {tasksForMember.map(t => (
                                    <option key={t} value={t}>
                                      {t}
                                    </option>
                                  ))}
                                  {selectedTaskValue && !tasksForMember.includes(selectedTaskValue) && (
                                    <option value="__custom_val__">{selectedTaskValue} (ระบุเอง)</option>
                                  )}
                                  <option value="__custom__">+ พิมพ์ระบุงานเอง...</option>
                                </select>
                              </div>

                              <div>
                                <label className="text-xs text-slate-500 font-normal block mb-1">
                                  แจ้งความประสงค์
                                </label>
                                <div className="relative flex items-center">
                                  <input
                                    type="text"
                                    list={`mobile-purpose-list-${member.id}`}
                                    placeholder="เช่น ไม่มา, ขอเข้า 09:00 น."
                                    value={st.purpose || ''}
                                    onChange={e => updateRow(member.id, { purpose: e.target.value })}
                                    className="w-full text-xs font-normal pl-2 pr-7 py-2 rounded border border-slate-300 bg-white"
                                  />
                                  <datalist id={`mobile-purpose-list-${member.id}`}>
                                    {PURPOSE_PRESETS.map(p => (
                                      <option key={p} value={p} />
                                    ))}
                                  </datalist>
                                  <select
                                    aria-label="เลือกความประสงค์"
                                    value=""
                                    onChange={e => {
                                      if (e.target.value) {
                                        updateRow(member.id, { purpose: e.target.value })
                                      }
                                    }}
                                    className="absolute right-0 top-0 bottom-0 w-7 opacity-0 cursor-pointer"
                                    title="คลิกเพื่อเลือกจากรายการแนะนำ"
                                  >
                                    <option value="">-- เลือกรายการ --</option>
                                    {PURPOSE_PRESETS.map(p => (
                                      <option key={p} value={p}>
                                        {p}
                                      </option>
                                    ))}
                                  </select>
                                  <ChevronDown className="w-4 h-4 text-slate-500 absolute right-2 pointer-events-none" />
                                </div>
                              </div>

                              <button
                                onClick={() => handleSaveRow(member)}
                                disabled={isRowSaving}
                                className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-2xs"
                              >
                                <Save className="w-4 h-4" />
                                <span>{isRowSaving ? 'กำลังบันทึก...' : 'บันทึกการแก้ไขของคนนี้'}</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Mobile Sticky Bottom Action Bar */}
          <div className="sticky bottom-0 left-0 right-0 p-3 bg-white/95 backdrop-blur-sm border-t border-slate-300 shadow-lg flex items-center justify-between gap-2.5 z-20 shrink-0">
            <div className="flex flex-col min-w-0">
              <span className="text-xs text-slate-500 font-normal truncate">
                {selectedCompany === 'all' ? 'ทุกลูกทีม' : selectedCompany}
              </span>
              <span className="text-xs text-slate-900 font-normal">
                ตรวจแล้ว <strong className="text-emerald-700 font-bold">{checkedCount}</strong>/{totalCount} คน
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {uncheckedCount > 0 ? (
                <button
                  onClick={handleQuickPassRemaining}
                  disabled={savingAll}
                  className="h-10 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {savingAll ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4 fill-white" />
                  )}
                  <span>ผ่านทั้งทีม ({uncheckedCount} คน)</span>
                </button>
              ) : (
                <div className="h-10 px-3.5 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-normal flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  <span>ครบทั้งทีมแล้ว</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ══════════════════════════════════════════════════════════════════════════
            2. DESKTOP VIEW (SPREADSHEET GRID TABLE)
        ══════════════════════════════════════════════════════════════════════════ */
        <div className="flex flex-col lg:flex-row items-stretch border border-slate-300 rounded-lg overflow-hidden bg-white shadow-2xs flex-1 min-h-0 h-full">
          {/* LEFT COLUMN: แถบสีเทาเลือกสังกัด / บริษัท */}
          <aside className="w-full lg:w-64 xl:w-72 shrink-0 bg-slate-100 border-b lg:border-b-0 lg:border-r border-slate-300 flex flex-col h-full min-h-0">
            {/* Header of Left Column */}
            <div className="p-2.5 bg-slate-200/80 border-b border-slate-300 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                <Building2 className="w-4 h-4 text-slate-800" />
                <span>สังกัด / บริษัท</span>
              </div>
              <span className="text-xs font-normal px-2 py-0.5 rounded bg-white text-slate-900 border border-slate-300">
                {affiliationList.length}
              </span>
            </div>

            {/* Compact Search Box */}
            <div className="p-2 border-b border-slate-200 shrink-0">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  placeholder="ค้นหาสังกัด..."
                  value={searchAffiliation}
                  onChange={e => setSearchAffiliation(e.target.value)}
                  className="w-full text-xs pl-8 pr-2.5 py-1.5 rounded border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 font-normal focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {searchAffiliation && (
                  <button
                    onClick={() => setSearchAffiliation('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Vertical Affiliation List */}
            <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-slate-200 scrollbar-thin">
              {/* 'All' Button */}
              <button
                onClick={() => setSelectedCompany('all')}
                className={`w-full text-left px-3 py-2.5 text-xs flex items-center justify-between transition-colors ${selectedCompany === 'all'
                  ? 'bg-white font-semibold text-blue-950 border-l-4 border-l-blue-600 shadow-2xs'
                  : 'hover:bg-slate-200/80 text-slate-800 font-normal'
                  }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <Users className="w-4 h-4 text-slate-700 shrink-0" />
                  <span className="truncate">ทุกลูกทีม (ทั้งหมด)</span>
                </div>
                <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-slate-200 text-slate-900 font-normal shrink-0 ml-1">
                  {totalEntriesCount}/{totalContractorsCount}
                </span>
              </button>

              {/* Individual Companies */}
              {affiliationList.map(item => {
                const isSelected = selectedCompany === item.name
                const isCompleted = item.total > 0 && item.checked === item.total

                return (
                  <button
                    key={item.name}
                    onClick={() => setSelectedCompany(item.name)}
                    className={`w-full text-left px-3 py-2.5 text-xs flex items-center justify-between transition-colors ${isSelected
                      ? 'bg-white font-semibold text-blue-950 border-l-4 border-l-blue-600 shadow-2xs'
                      : 'hover:bg-slate-200/80 text-slate-800 font-normal'
                      }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${isCompleted
                          ? 'bg-emerald-600'
                          : item.checked > 0
                            ? 'bg-amber-600'
                            : 'bg-slate-400'
                          }`}
                      />
                      <span className="truncate">{item.name}</span>
                    </div>
                    <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-slate-200 text-slate-900 font-normal shrink-0 ml-1">
                      {item.checked}/{item.total}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Footer of Left Column */}
            <div className="p-2.5 bg-slate-200/70 border-t border-slate-300 flex items-center justify-between text-xs font-normal">
              <span className="text-slate-700 font-normal">
                ตรวจแล้ว <strong className="text-emerald-900 font-bold">{totalEntriesCount}</strong> คน
              </span>
              <button
                onClick={() => setNewMemberOpen(true)}
                className="text-blue-700 hover:text-blue-950 font-semibold inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> เพิ่มคน
              </button>
            </div>
          </aside>

          {/* RIGHT COLUMN: ตาราง CHECKLIST กระชับ สบายตา */}
          <main className="flex-1 min-w-0 flex flex-col bg-white overflow-hidden h-full min-h-0">
            {/* Toolbar Above Grid */}
            <div className="px-3 py-2 bg-slate-50 border-b border-slate-300 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
              {/* Left: Current Selection & Counts */}
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-950 text-xs">
                  {selectedCompany === 'all' ? 'ทุกสังกัด' : selectedCompany}
                </span>
                <span className="text-slate-300 font-normal">|</span>
                <span className="text-slate-700 text-xs font-normal">
                  ตรวจแล้ว <strong className="text-emerald-900 font-bold">{checkedCount}</strong>/{totalCount} คน
                </span>
              </div>

              {/* Center: Shift Hours Preset & Activity Preset */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs text-slate-700 bg-white px-2.5 py-1 rounded border border-slate-300 shadow-2xs">
                  <Clock className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                  <span className="font-normal text-slate-700">เวลา:</span>
                  <input
                    type="time"
                    value={defaultCheckIn}
                    onChange={e => setDefaultCheckIn(e.target.value)}
                    className="font-normal text-slate-950 text-xs w-[84px] border-none outline-none px-1 bg-transparent cursor-pointer"
                  />
                  <span className="text-slate-400 font-normal mx-0.5">-</span>
                  <input
                    type="time"
                    value={defaultCheckOut}
                    onChange={e => setDefaultCheckOut(e.target.value)}
                    className="font-normal text-slate-950 text-xs w-[84px] border-none outline-none px-1 bg-transparent cursor-pointer"
                  />
                </div>

                {/* Supervisor Preset Input */}
                <div className="flex items-center gap-1.5 text-xs text-slate-700 bg-white px-2.5 py-1 rounded border border-slate-300">
                  <span className="font-normal text-slate-700">ผู้ควบคุม:</span>
                  <input
                    type="text"
                    placeholder="ระบุผู้ควบคุม..."
                    value={defaultSupervisor}
                    onChange={e => {
                      const val = e.target.value
                      setDefaultSupervisor(val)
                      setRowStates(prev => {
                        const next = { ...prev }
                        currentTeamMembers.forEach(m => {
                          const cur = next[m.id] || {}
                          next[m.id] = { ...cur, supervisor: val }
                        })
                        return next
                      })
                    }}
                    className="font-normal text-slate-950 text-xs w-[110px] border-none outline-none px-1 bg-transparent placeholder:text-slate-400"
                  />
                </div>

                {/* Team Activity Preset Selector */}
                <div className="flex items-center gap-1.5 text-xs text-slate-700 bg-white px-2.5 py-1 rounded border border-slate-300">
                  <span className="font-normal text-slate-700">กิจกรรมทีม:</span>
                  <select
                    value={defaultActivityId}
                    onChange={e => {
                      const actId = e.target.value
                      const act = activities.find(a => a.id === actId)
                      const rawTasks = act?.tasks
                        ? act.tasks.split(/[,;\n]/).map(s => s.trim()).filter(Boolean)
                        : []
                      const firstTask = rawTasks[0] || act?.name || ''
                      setDefaultActivityId(actId)
                      setDefaultActivityName(firstTask)
                      if (act?.location) setDefaultLocation(act.location)

                      setRowStates(prev => {
                        const next = { ...prev }
                        currentTeamMembers.forEach(m => {
                          const cur = next[m.id] || {}
                          next[m.id] = {
                            ...cur,
                            activity_id: actId || undefined,
                            activity_name: firstTask,
                            location: act?.location || cur.location,
                          }
                        })
                        return next
                      })
                    }}
                    className="text-xs font-normal text-slate-950 bg-transparent border-none outline-none cursor-pointer max-w-[180px] truncate"
                  >
                    <option value="">-- เลือกกิจกรรมทีม --</option>
                    {activities.map(act => (
                      <option key={act.id} value={act.id}>
                        {act.code ? `[${act.code}] ` : ''}
                        {act.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Right: Quick Batch Actions */}
              <div className="flex items-center gap-2">

                <button
                  onClick={handlePassAllTeam}
                  title="ตั้งค่าให้ทุกคนในตารางผ่านทุกข้อ"
                  className="px-2.5 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-400 text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                  <span>ตรวจผ่านทุกคน (100%)</span>
                </button>

                <button
                  onClick={handleSaveAll}
                  disabled={savingAll || currentTeamMembers.length === 0}
                  className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs transition-colors disabled:opacity-50"
                >
                  {savingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>บันทึกทั้งหมด ({currentTeamMembers.length})</span>
                </button>
              </div>
            </div>

            {/* Table Grid */}
            <div className="flex-1 overflow-auto min-h-0 scrollbar-thin">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-100 z-10 select-none">
                  <tr className="border-b border-slate-300 text-slate-900 text-xs">
                    <th className="py-2.5 px-2 w-10 text-center font-semibold border-r border-slate-300">#</th>
                    <th className="py-2.5 px-3 min-w-[130px] font-semibold border-r border-slate-300">ชื่อ - สกุล</th>
                    <th className="py-2.5 px-2 min-w-[140px] font-semibold border-r border-slate-300">โครงการ</th>
                    <th className="py-2.5 px-2 min-w-[130px] font-semibold border-r border-slate-300">งานที่ปฏิบัติ</th>
                    <th className="py-2.5 px-2 min-w-[110px] font-semibold border-r border-slate-300">สถานที่</th>
                    <th className="py-2.5 px-2 min-w-[100px] max-w-[115px] font-semibold border-r border-slate-300">แจ้งความประสงค์</th>

                    {/* ALC */}
                    <th className="py-1.5 px-1.5 text-center min-w-[80px] font-semibold border-r border-slate-300 bg-slate-100/90">
                      <div className="flex flex-col items-center">
                        <span>ALC</span>
                        <button
                          onClick={bulkToggleALC}
                          className="text-xs font-normal text-blue-700 hover:text-blue-900 leading-none mt-0.5"
                        >
                          สลับทุกคน
                        </button>
                      </div>
                    </th>

                    {/* DYNAMIC PPE HEADERS */}
                    {activePpeItems.map(item => (
                      <th
                        key={item.id}
                        className="py-1.5 px-1.5 text-center min-w-[56px] font-semibold border-r border-slate-300"
                      >
                        <div className="flex flex-col items-center">
                          <span className="truncate max-w-[70px] inline-flex items-center gap-0.5 justify-center" title={item.label}>
                            <span>{item.icon}</span>
                            <span>{item.label}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => bulkToggleColumn(item.id)}
                            className="text-xs font-normal text-blue-700 hover:text-blue-900 leading-none mt-0.5 cursor-pointer"
                          >
                            ทั้งหมด
                          </button>
                        </div>
                      </th>
                    ))}

                    {/* ผลตรวจ */}
                    <th className="py-2.5 px-2 text-center min-w-[95px] font-semibold border-r border-slate-300">ผล Checklist</th>

                    {/* บันทึก */}
                    <th className="py-2.5 px-2 text-center min-w-[100px] font-semibold">การบันทึก</th>
                  </tr>
                </thead>

                <tbody>
                  {currentTeamMembers.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="py-10 text-center text-slate-500 text-xs font-normal">
                        ไม่พบข้อมูลลูกทีมในสังกัดนี้
                      </td>
                    </tr>
                  ) : (
                    currentTeamMembers.map((member, idx) => {
                      const entry = getEntryForContractor(member)
                      const isSaved = !!entry
                      const st = getRowState(member.id)
                      const isRowSaving = savingRowId === member.id

                      const ppePassedCount = getRowPpePassedCount(st)
                      const isAllPpePassed = isRowAllPpePassed(st)
                      const isSafe = isAllPpePassed && isAlcoholPassed(st.alc_result)

                      const effectiveActivityId = st.activity_id || defaultActivityId
                      const tasksForMember = getTasksForActivity(effectiveActivityId)
                      const selectedTaskValue = st.activity_name || ''
                      const hasAlcRisk = getContractorAlcRisk(member)

                      return (
                        <tr
                          key={member.id}
                          className={`border-b border-slate-200 transition-colors ${isSaved ? 'bg-emerald-50/30 hover:bg-emerald-50/60' : 'bg-white hover:bg-slate-50'
                            }`}
                        >
                          {/* # */}
                          <td className="py-2 px-2 text-center text-slate-800 font-mono font-normal text-xs border-r border-slate-200">
                            {idx + 1}
                          </td>

                          {/* ชื่อ - สกุล */}
                          <td className={`py-2 px-3 border-r border-slate-200 ${hasAlcRisk ? 'bg-amber-100/70' : ''}`}>
                            <div className="flex items-center gap-1.5">
                              {isSaved && <Check className="w-4 h-4 text-emerald-700 shrink-0 stroke-[2.5]" />}
                              <span className="font-normal text-slate-950 text-xs truncate">{member.name}</span>
                            </div>
                          </td>

                          {/* กิจกรรม */}
                          <td className="py-1.5 px-2 border-r border-slate-200">
                            <div className="relative flex items-center">
                              <select
                                value={st.activity_id || defaultActivityId || ''}
                                onChange={e => {
                                  const actId = e.target.value
                                  const act = activities.find(a => a.id === actId)
                                  const rawTasks = act?.tasks
                                    ? act.tasks.split(/[,;\n]/).map(s => s.trim()).filter(Boolean)
                                    : []
                                  const firstTask = rawTasks[0] || act?.name || ''
                                  updateRow(member.id, {
                                    activity_id: actId || undefined,
                                    activity_name: firstTask,
                                    location: act?.location || st.location,
                                  })
                                }}
                                className="w-full text-xs pl-2 pr-6 py-1 rounded border border-slate-300 bg-white hover:border-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 font-normal text-slate-900 cursor-pointer appearance-none truncate"
                              >
                                <option value="">-- เลือกกิจกรรม --</option>
                                {activities.map(act => (
                                  <option key={act.id} value={act.id}>
                                    {act.code ? `[${act.code}] ` : ''}
                                    {act.name}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2 pointer-events-none" />
                            </div>
                          </td>

                          {/* งานที่ปฏิบัติ */}
                          <td className="py-1.5 px-2 border-r border-slate-200">
                            <div className="relative flex items-center">
                              <select
                                value={
                                  tasksForMember.includes(selectedTaskValue)
                                    ? selectedTaskValue
                                    : selectedTaskValue
                                      ? '__custom_val__'
                                      : ''
                                }
                                onChange={e => {
                                  const val = e.target.value
                                  if (val === '__custom__') {
                                    const customVal = window.prompt(
                                      'ระบุชื่องานที่ต้องการ:',
                                      selectedTaskValue || ''
                                    )
                                    if (customVal !== null && customVal.trim() !== '') {
                                      updateRow(member.id, { activity_name: customVal.trim() })
                                    }
                                  } else if (val === '__custom_val__') {
                                    // keep
                                  } else {
                                    updateRow(member.id, { activity_name: val })
                                  }
                                }}
                                className="w-full text-xs pl-2 pr-6 py-1 rounded border border-slate-300 bg-white hover:border-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 font-normal text-slate-900 cursor-pointer appearance-none truncate"
                              >
                                <option value="">-- เลือกงาน --</option>
                                {tasksForMember.map(t => (
                                  <option key={t} value={t}>
                                    {t}
                                  </option>
                                ))}
                                {selectedTaskValue && !tasksForMember.includes(selectedTaskValue) && (
                                  <option value="__custom_val__">{selectedTaskValue} (ระบุเอง)</option>
                                )}
                                <option value="__custom__">+ พิมพ์ระบุงานเอง...</option>
                              </select>
                              <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2 pointer-events-none" />
                            </div>
                          </td>

                          {/* สถานที่ */}
                          <td className="py-1.5 px-1.5 border-r border-slate-200">
                            <input
                              type="text"
                              placeholder="เช่น ทุกโซน, ลาน A..."
                              value={st.location ?? defaultLocation ?? ''}
                              onChange={e => updateRow(member.id, { location: e.target.value })}
                              className="w-full text-xs px-2 py-1 rounded border border-slate-300 bg-white hover:border-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 font-normal text-slate-900 placeholder:text-slate-400 truncate"
                            />
                          </td>

                          {/* แจ้งความประสงค์ */}
                          <td className="py-1.5 px-1.5 border-r border-slate-200 min-w-[100px] max-w-[115px]">
                            <div className="relative flex items-center">
                              <input
                                type="text"
                                list={`purpose-list-${member.id}`}
                                placeholder="เช่น ไม่มา..."
                                value={st.purpose || ''}
                                onChange={e => updateRow(member.id, { purpose: e.target.value })}
                                className="w-full text-xs pl-2 pr-5 py-1 rounded border border-slate-300 bg-white hover:border-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 font-normal text-slate-900 placeholder:text-slate-400 truncate"
                              />
                              <datalist id={`purpose-list-${member.id}`}>
                                {PURPOSE_PRESETS.map(p => (
                                  <option key={p} value={p} />
                                ))}
                              </datalist>
                              <select
                                aria-label="เลือกความประสงค์"
                                value=""
                                onChange={e => {
                                  if (e.target.value) {
                                    updateRow(member.id, { purpose: e.target.value })
                                  }
                                }}
                                className="absolute right-0 top-0 bottom-0 w-5 opacity-0 cursor-pointer"
                                title="คลิกเพื่อเลือกจากรายการแนะนำ"
                              >
                                <option value="">-- เลือกรายการ --</option>
                                {PURPOSE_PRESETS.map(p => (
                                  <option key={p} value={p}>
                                    {p}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="w-3 h-3 text-slate-500 absolute right-1.5 pointer-events-none" />
                            </div>
                          </td>

                          {/* ALC (ระบุค่าได้ หรือคลิกเลือกด่วน) */}
                          <td className="py-1.5 px-1 text-center border-r border-slate-200 min-w-[78px] max-w-[90px]">
                            <div className="relative flex items-center">
                              <input
                                type="text"
                                list={`alc-list-${member.id}`}
                                value={isAlcoholUnchecked(st.alc_result) ? '' : (st.alc_result ?? '')}
                                onChange={e => updateRow(member.id, { alc_result: e.target.value })}
                                placeholder="ยังไม่ตรวจ"
                                className={`w-full text-xs text-center py-1 pl-1 pr-4 rounded border font-mono transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500 ${isAlcoholUnchecked(st.alc_result)
                                  ? 'bg-white text-slate-700 border-slate-300 placeholder:text-slate-400'
                                  : isAlcoholPassed(st.alc_result)
                                    ? 'bg-emerald-50 text-emerald-900 border-emerald-400 font-semibold'
                                    : 'bg-red-100 text-red-900 border-red-500 font-semibold animate-pulse'
                                  }`}
                              />
                              <datalist id={`alc-list-${member.id}`}>
                                <option value="0" />
                                <option value="15" />
                                <option value="25" />
                                <option value="50" />
                              </datalist>
                              <select
                                aria-label="เลือกค่า ALC"
                                value=""
                                onChange={e => {
                                  updateRow(member.id, { alc_result: e.target.value })
                                }}
                                className="absolute right-0 top-0 bottom-0 w-4 opacity-0 cursor-pointer"
                                title="คลิกเพื่อเลือกค่า ALC ด่วน"
                              >
                                <option value="">-- เลือก --</option>
                                <option value="0">0 (ปกติ)</option>
                                <option value="25">25 (เกินเกณฑ์)</option>
                                <option value="50">50 (เกินเกณฑ์)</option>
                                <option value="">ยังไม่ได้ตรวจ (ว่าง)</option>
                              </select>
                              <ChevronDown className="w-2.5 h-2.5 text-slate-500 absolute right-1 pointer-events-none" />
                            </div>
                          </td>

                          {/* DYNAMIC PPE CELLS */}
                          {activePpeItems.map(item => {
                            const val = getRowPpeValue(st, item.id)
                            return (
                              <td key={item.id} className="py-1.5 px-1 text-center border-r border-slate-200">
                                <button
                                  type="button"
                                  onClick={() => updateRowPpeValue(member.id, item.id, !val)}
                                  className={`w-6 h-6 rounded mx-auto border flex items-center justify-center transition-all cursor-pointer ${val
                                    ? 'bg-emerald-600 text-white border-emerald-700'
                                    : 'bg-white text-slate-300 border-slate-400 hover:border-slate-600'
                                    }`}
                                  title={`${item.label}: ${val ? 'ผ่าน' : 'ไม่ผ่าน'}`}
                                >
                                  {val && <Check className="w-4 h-4 stroke-[3]" />}
                                </button>
                              </td>
                            )
                          })}

                          {/* ผลตรวจ (PPE ผ่านกี่ชิ้น) */}
                          <td className="py-1.5 px-2 text-center border-r border-slate-200">
                            <button
                              type="button"
                              onClick={() => togglePassAllRow(member.id)}
                              title="คลิกเพื่อสลับผ่านครบทั้งแถว"
                              className={`px-2 py-1 rounded text-xs font-normal border transition-colors ${isSafe
                                ? 'bg-emerald-100 text-emerald-900 border-emerald-400'
                                : 'bg-amber-100 text-amber-900 border-amber-400'
                                }`}
                            >
                              {isSafe ? '✓ ผ่านครบ' : `${ppePassedCount}/${activePpeItems.length} ไม่ครบ`}
                            </button>
                          </td>

                          {/* บันทึก */}
                          <td className="py-1.5 px-2 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {isSaved ? (
                                <>
                                  <button
                                    onClick={() => handleSaveRow(member)}
                                    disabled={isRowSaving}
                                    title="อัปเดตผล"
                                    className="px-2.5 py-1 rounded bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-normal transition-colors disabled:opacity-50"
                                  >
                                    {isRowSaving ? '...' : '✓ แล้ว'}
                                  </button>
                                  <button
                                    onClick={() => handleDeleteRowEntry(entry.id, member.name)}
                                    title="ยกเลิกการบันทึก"
                                    className="text-slate-500 hover:text-red-700 p-1 transition-colors"
                                  >
                                    <RotateCcw className="w-4 h-4" />
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => handleSaveRow(member)}
                                  disabled={isRowSaving}
                                  className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-normal transition-colors disabled:opacity-50"
                                >
                                  {isRowSaving ? '...' : 'บันทึก'}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Bottom Info Strip */}
            <div className="px-3 py-2 bg-slate-50 border-t border-slate-300 flex items-center justify-between text-xs text-slate-800 font-normal">
              <span>
                แสดงลูกทีม <strong className="text-slate-950 font-semibold">{currentTeamMembers.length}</strong> คน • ตรวจบันทึกแล้ว{' '}
                <strong className="text-emerald-900 font-semibold">{checkedCount}</strong> คน
              </span>
              <span>
                เวลาบันทึกมาตรฐาน:{' '}
                <span className="text-slate-900 font-normal">
                  {defaultCheckIn} - {defaultCheckOut} น.
                </span>
              </span>
            </div>
          </main>
        </div>
      )}

      {/* ── Dialog เพิ่มลูกทีมใหม่เข้าสังกัด (ใช้ร่วมกันทั้ง Mobile และ Desktop) ── */}
      <Dialog open={newMemberOpen} onOpenChange={setNewMemberOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSaveNewMember}>
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-600" />
                เพิ่มลูกทีมใหม่เข้าสังกัด
              </DialogTitle>
            </DialogHeader>

            <div className="py-4 space-y-3">
              <div>
                <label className="text-xs font-normal text-slate-700 mb-1 block">สังกัด / บริษัท</label>
                <input
                  type="text"
                  disabled
                  value={selectedCompany !== 'all' ? selectedCompany : 'ไม่ระบุสังกัด'}
                  className="w-full text-xs font-normal px-3 py-2 rounded border border-slate-200 bg-slate-100 text-slate-600"
                />
              </div>

              <div>
                <label className="text-xs font-normal text-slate-700 mb-1 block">
                  ชื่อ-นามสกุลลูกทีม <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น นายประสิทธิ์ มั่นคง"
                  value={newMemberName}
                  onChange={e => setNewMemberName(e.target.value)}
                  className="w-full text-xs font-normal px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-normal text-slate-700 mb-1 block">ตำแหน่ง</label>
                  <input
                    type="text"
                    placeholder="เช่น ช่างเชื่อม"
                    value={newMemberPosition}
                    onChange={e => setNewMemberPosition(e.target.value)}
                    className="w-full text-xs font-normal px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-normal text-slate-700 mb-1 block">เบอร์โทร</label>
                  <input
                    type="tel"
                    placeholder="08X-XXX-XXXX"
                    value={newMemberPhone}
                    onChange={e => setNewMemberPhone(e.target.value)}
                    className="w-full text-xs font-normal px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <button
                type="button"
                onClick={() => setNewMemberOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded font-normal"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={savingNewMember}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
              >
                {savingNewMember ? 'กำลังบันทึก...' : 'บันทึกเข้าทีม'}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

