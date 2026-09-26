'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ChecklistEntry, Contractor, Company, Activity, ALCResult } from '@/lib/types'
import {
  isAlcoholPassed,
  isAlcoholFailed,
  isAlcoholUnchecked,
  getContractorAlcRisk,
  getContractorDailyWage,
  cleanContractorPosition,
  COMMON_TASK_PRESETS,
  PURPOSE_PRESETS,
  normalizeAlcForDb,
  ChecklistPpeItem,
  DEFAULT_CHECKLIST_PPE_ITEMS,
} from '@/lib/types'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { toast } from 'sonner'
import Link from 'next/link'
import {
  ChevronLeft, ChevronRight, Calendar, Search, CheckCircle2,
  XCircle, AlertTriangle, ShieldCheck, ShieldAlert, Clock,
  MapPin, Briefcase, User, Save, RefreshCw, Zap, ArrowLeft,
  Check, X, FileText, ChevronDown, Plus, Sparkles, Building2,
  Users, CheckCircle, MessageSquare, Phone, Monitor, RotateCcw,
  Sliders
} from 'lucide-react'
import { PpeSettingsModal } from '@/components/checklist/PpeSettingsModal'
import { extractUserNote } from '@/lib/utils'

interface MobileChecklistMProps {
  initialDate?: string
  mobileUser?: {
    name?: string
    phone?: string
    role?: string
    email?: string
    authMethod?: 'line' | 'phone' | 'email' | 'guest'
  } | null
  onOpenAuth?: () => void
  onNavigateToHistory?: () => void
  resetTrigger?: number
}

export function MobileChecklistM({ initialDate, mobileUser, onOpenAuth, onNavigateToHistory, resetTrigger }: MobileChecklistMProps) {
  const supabase = useMemo(() => createClient(), [])

  // ── Step State: 1 = Team List (Frame 4), 2 = Team Members (Frame 5), 3 = Individual Checklist Form (Frame 6) ──
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1)

  // Reset to Step 1 when bottom menu "เช็คลิสต์" is clicked
  useEffect(() => {
    if (resetTrigger && resetTrigger > 0) {
      setCurrentStep(1)
      setSelectedCompany(null)
      setSelectedContractor(null)
      setSelectedMemberIds([])
      setCompanySearch('')
      setMemberSearch('')
    }
  }, [resetTrigger])

  // Date
  const [date, setDate] = useState(initialDate || format(new Date(), 'yyyy-MM-dd'))

  // Master Data & Entries
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [entries, setEntries] = useState<ChecklistEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Step 1: Selected Company
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null)
  const [companySearch, setCompanySearch] = useState('')

  // Step 2: Member Filter & Selected Contractor
  const [memberSearch, setMemberSearch] = useState('')
  const [memberStatusFilter, setMemberStatusFilter] = useState<'pending' | 'checked' | 'all'>('pending')
  const [selectedContractor, setSelectedContractor] = useState<Contractor | null>(null)

  // Step 3: Form State for Single Contractor
  const [formCheckIn, setFormCheckIn] = useState('08:00')
  const [formCheckOut, setFormCheckOut] = useState('17:00')
  const [formSupervisor, setFormSupervisor] = useState(mobileUser?.name || '')
  const [currentUserSupervisor, setCurrentUserSupervisor] = useState(mobileUser?.name || '')
  const [formActivityId, setFormActivityId] = useState('')
  const [formActivityName, setFormActivityName] = useState('')
  const [formLocation, setFormLocation] = useState('')

  // Auto-detect logged-in supervisor name
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
              setFormSupervisor(prev => prev || sName)
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
            setFormSupervisor(prev => prev || sName)
          }
        }
      } catch (e) {}
    }
    if (!mobileUser?.name) {
      fetchSupervisor()
    }
  }, [supabase, mobileUser])
  const [formAlc, setFormAlc] = useState<string>('')
  const [formHelmet, setFormHelmet] = useState(false)
  const [formVest, setFormVest] = useState(false)
  const [formShirt, setFormShirt] = useState(false)
  const [formGloves, setFormGloves] = useState(false)
  const [formShoes, setFormShoes] = useState(false)
  const [formPurpose, setFormPurpose] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [savingForm, setSavingForm] = useState(false)
  const [savingQuickId, setSavingQuickId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // ── Multi-select & Batch Pass Modal State ──
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([])
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false)
  const [isSavingBatch, setIsSavingBatch] = useState(false)
  const [batchActivityId, setBatchActivityId] = useState('')
  const [batchActivityName, setBatchActivityName] = useState('')
  const [batchLocation, setBatchLocation] = useState('')
  const [batchSupervisor, setBatchSupervisor] = useState('')
  const [batchCheckIn, setBatchCheckIn] = useState('08:00')
  const [batchCheckOut, setBatchCheckOut] = useState('17:00')
  const [batchHelmet, setBatchHelmet] = useState(true)
  const [batchVest, setBatchVest] = useState(true)
  const [batchShirt, setBatchShirt] = useState(true)
  const [batchGloves, setBatchGloves] = useState(true)
  const [batchShoes, setBatchShoes] = useState(true)
  const [isCustomFormTask, setIsCustomFormTask] = useState(false)
  const [isCustomBatchTask, setIsCustomBatchTask] = useState(false)
  const [isCustomPurpose, setIsCustomPurpose] = useState(false)

  // ── Dynamic Checklist PPE Items & Settings Modal State ──
  const [ppeConfigItems, setPpeConfigItems] = useState<ChecklistPpeItem[]>(DEFAULT_CHECKLIST_PPE_ITEMS)
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)
  const [formPpeValues, setFormPpeValues] = useState<Record<string, boolean>>({})
  const [batchPpeValues, setBatchPpeValues] = useState<Record<string, boolean>>({})
  const [sessionIsAdmin, setSessionIsAdmin] = useState(false)

  // Check admin session
  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(r => r.json())
      .then(json => {
        if (json.isAdmin) setSessionIsAdmin(true)
      })
      .catch(() => {})
  }, [])

  const isAdmin = mobileUser?.role === 'admin' || sessionIsAdmin

  // Load PPE settings
  const loadPpeSettings = useCallback(async () => {
    try {
      const res = await fetch(`/api/settings?id=checklist_ppe_items&t=${Date.now()}`, { cache: 'no-store' })
      const json = await res.json()
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        setPpeConfigItems(json.data)
      }
    } catch {}
  }, [])

  useEffect(() => {
    loadPpeSettings()

    // Auto-reload when window/tab regains focus (e.g. returning from settings)
    const handleFocus = () => {
      loadPpeSettings()
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [loadPpeSettings])

  // Active items (enabled in settings)
  const activePpeItems = useMemo(() => {
    const active = ppeConfigItems.filter(i => i.is_active)
    return active.length > 0 ? active : DEFAULT_CHECKLIST_PPE_ITEMS
  }, [ppeConfigItems])

  // Helper to check if a checklist entry satisfies all active PPE requirements
  const checkEntryPpePass = useCallback((entry: ChecklistEntry): boolean => {
    let details: Record<string, boolean> | null = null
    try {
      if (entry.notes) {
        const parsed = JSON.parse(entry.notes)
        if (parsed?.ppe_details && typeof parsed.ppe_details === 'object') {
          details = parsed.ppe_details
        }
      }
    } catch {}

    return activePpeItems.every(item => {
      if (!item.required) return true
      if (details && typeof details[item.id] === 'boolean') {
        return details[item.id]
      }
      if (item.id === 'helmet') return !!entry.ppe_helmet
      if (item.id === 'vest') return !!entry.ppe_vest
      if (item.id === 'glasses' || item.id === 'shirt') return !!entry.ppe_shirt
      if (item.id === 'gloves') return !!entry.ppe_gloves
      if (item.id === 'shoes') return !!entry.ppe_shoes
      return true
    })
  }, [activePpeItems])

  // Contractor memory helpers (จำค่า โครงการ/กิจกรรม/สถานที่ ไว้จนกว่าจะเปลี่ยน)
  const getContractorSavedPref = (contractorId: string) => {
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem(`contractor_pref_${contractorId}`)
        if (raw) return JSON.parse(raw)
      }
    } catch (e) {}
    return null
  }

  const saveContractorSavedPref = (contractorId: string, pref: {
    activity_id?: string
    activity_name?: string
    location?: string
    supervisor?: string
  }) => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(`contractor_pref_${contractorId}`, JSON.stringify(pref))
      }
    } catch (e) {}
  }

  // Helper เพื่อดึงรายชื่องานของโครงการนั้น ๆ โดยตรงจาก tasks ของโครงการ
  const getTasksForActivity = useCallback((activityId?: string) => {
    if (!activityId) return []
    const act = activities.find(a => a.id === activityId)
    if (!act) return []

    const actTasks = act.tasks
      ? (act.tasks as string).split(/[,;\n]/).map((s: string) => s.trim()).filter(Boolean)
      : []

    if (actTasks.length > 0) {
      return Array.from(new Set(actTasks))
    }

    return [act.name]
  }, [activities])

  // Selected Activity & Tasks List for Form
  const selectedActivityObj = useMemo(() => {
    return activities.find(a => a.id === formActivityId)
  }, [activities, formActivityId])

  const tasksForSelectedActivity = useMemo(() => {
    return getTasksForActivity(formActivityId)
  }, [getTasksForActivity, formActivityId])

  const tasksForBatchActivity = useMemo(() => {
    return getTasksForActivity(batchActivityId)
  }, [getTasksForActivity, batchActivityId])

  // Load Data
  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true)
    else setRefreshing(true)

    try {
      const [
        entriesRes,
        { data: cData, error: cErr },
        { data: coData, error: coErr },
        { data: aData, error: aErr }
      ] = await Promise.all([
        fetch(`/api/checklist?date=${date}`).then(r => r.json()),
        supabase.from('contractors').select('*').eq('is_active', true).order('name'),
        supabase.from('companies').select('*').order('name'),
        supabase.from('activities').select('*').eq('is_active', true).order('name'),
      ])

      if (entriesRes.error) throw new Error(entriesRes.error)
      if (cErr) throw cErr
      if (coErr) throw coErr
      if (aErr) throw aErr

      setEntries(entriesRes.data ?? [])
      setContractors(cData ?? [])
      setCompanies(coData ?? [])
      setActivities(aData ?? [])
    } catch (err: any) {
      console.error('Load mobile checklist data error:', err)
      toast.error('ไม่สามารถโหลดข้อมูลได้: ' + (err?.message || ''))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [supabase, date])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Realtime subscription
  useEffect(() => {
    const ch = supabase
      .channel('mobile_cl_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_entries' }, () => {
        loadData(true)
      })
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [supabase, loadData])

  // Helper: Find entry for contractor
  const getEntryForContractor = useCallback((c: Contractor) => {
    return entries.find(e => (e.contractor_id && e.contractor_id === c.id) || e.contractor_name === c.name)
  }, [entries])

  // ══════════════════════════════════════════════════════════════════════════
  // 1. COMPANY SUMMARIES (Step 1: Frame 4)
  // ══════════════════════════════════════════════════════════════════════════
  const companySummaries = useMemo(() => {
    const map = new Map<string, {
      name: string
      code: string
      location: string
      activityName: string
      members: Contractor[]
      totalCount: number
      passedCount: number
      alcCount: number
      ppeFailedCount: number
      missingCount: number
      requestCount: number
    }>()

    // Group contractors by company
    contractors
      .filter(c => c.employee_type !== 'employee')
      .forEach(c => {
        const compName = (c.company_name || 'รับจ้างอิสระ').trim()
        if (!map.has(compName)) {
          const compObj = companies.find(co => co.name === compName || co.code === compName)
          map.set(compName, {
            name: compName,
            code: compObj?.code || '',
            location: '',
            activityName: '',
            members: [],
            totalCount: 0,
            passedCount: 0,
            alcCount: 0,
            ppeFailedCount: 0,
            missingCount: 0,
            requestCount: 0,
          })
        }
        map.get(compName)!.members.push(c)
      })

    // Compute stats from entries
    map.forEach((item, compName) => {
      item.totalCount = item.members.length
      const compEntries = entries.filter(
        e => e.company_name === compName || item.members.some(m => m.id === e.contractor_id || m.name === e.contractor_name)
      )

      // Get latest location and activity
      const loc = compEntries.find(e => e.location?.trim())?.location?.trim() || ''
      const act = compEntries.find(e => e.activity_name?.trim())?.activity_name?.trim() || ''
      item.location = loc
      item.activityName = act

      let passed = 0
      let alcFail = 0
      let ppeFail = 0
      let reqCount = 0
      let checkedInTotal = 0

      item.members.forEach(m => {
        const entry = compEntries.find(e => (e.contractor_id && e.contractor_id === m.id) || e.contractor_name === m.name)
        if (entry) {
          checkedInTotal++
          if (entry.purpose?.trim()) reqCount++
          const isAlcPass = isAlcoholPassed(entry.alc_result)
          const isPpePass = checkEntryPpePass(entry)

          if (isAlcPass && isPpePass) {
            passed++
          } else {
            if (!isAlcPass) alcFail++
            if (!isPpePass) ppeFail++
          }
        }
      })

      item.passedCount = passed
      item.alcCount = alcFail
      item.ppeFailedCount = ppeFail
      item.missingCount = item.totalCount - checkedInTotal
      item.requestCount = reqCount
    })

    return Array.from(map.values())
  }, [contractors, companies, entries])

  // Filtered companies for Step 1
  const filteredCompanies = useMemo(() => {
    if (!companySearch.trim()) return companySummaries
    const q = companySearch.toLowerCase()
    return companySummaries.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      c.location.toLowerCase().includes(q)
    )
  }, [companySummaries, companySearch])

  // ══════════════════════════════════════════════════════════════════════════
  // 2. CURRENT TEAM MEMBERS (Step 2: Frame 5)
  // ══════════════════════════════════════════════════════════════════════════
  const currentCompanySummary = useMemo(() => {
    if (!selectedCompany) return null
    return companySummaries.find(c => c.name === selectedCompany) || null
  }, [companySummaries, selectedCompany])

  const currentTeamMembers = useMemo(() => {
    if (!selectedCompany) return []
    let list = contractors.filter(c => (c.company_name || 'รับจ้างอิสระ').trim() === selectedCompany)
    if (memberSearch.trim()) {
      const q = memberSearch.toLowerCase()
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.position && c.position.toLowerCase().includes(q))
      )
    }
    if (memberStatusFilter === 'pending') {
      list = list.filter(c => !getEntryForContractor(c))
    } else if (memberStatusFilter === 'checked') {
      list = list.filter(c => !!getEntryForContractor(c))
    }
    return list
  }, [contractors, selectedCompany, memberSearch, memberStatusFilter, getEntryForContractor])

  // Helper error message
  const getErrorMessage = (err: any): string => {
    if (!err) return 'ข้อผิดพลาดที่ไม่ทราบสาเหตุ'
    if (typeof err === 'string') return err
    return err.message || err.details || err.hint || JSON.stringify(err)
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 3. STEP NAVIGATION HANDLERS
  // ══════════════════════════════════════════════════════════════════════════

  // Pending members in the current company
  const pendingMembersInTeam = useMemo(() => {
    if (!selectedCompany) return []
    return contractors.filter(c =>
      (c.company_name || 'รับจ้างอิสระ').trim() === selectedCompany &&
      !getEntryForContractor(c)
    )
  }, [contractors, selectedCompany, getEntryForContractor])

  const handleToggleSelectMember = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setSelectedMemberIds(prev =>
      prev.includes(id) ? prev.filter(mId => mId !== id) : [...prev, id]
    )
  }

  const handleToggleSelectAll = () => {
    const pendingIds = pendingMembersInTeam.map(c => c.id)
    if (selectedMemberIds.length === pendingIds.length && pendingIds.length > 0) {
      setSelectedMemberIds([])
    } else {
      setSelectedMemberIds(pendingIds)
    }
  }

  // Navigate to Step 2 (Frame 5)
  const handleSelectCompany = (compName: string) => {
    setSelectedCompany(compName)
    setMemberSearch('')
    setMemberStatusFilter('pending')
    setSelectedMemberIds([])
    setCurrentStep(2)
  }

  // Navigate to Step 3 (Frame 6) - Open checklist form for contractor
  const handleOpenFormForContractor = (contractor: Contractor) => {
    setSelectedContractor(contractor)
    const existingEntry = getEntryForContractor(contractor)
    const compSummary = companySummaries.find(c => c.name === (contractor.company_name || selectedCompany))
    const savedPref = contractor.id ? getContractorSavedPref(contractor.id) : null

    if (existingEntry) {
      const actId = existingEntry.activity_id || savedPref?.activity_id || activities[0]?.id || ''
      const tasks = getTasksForActivity(actId)
      const taskName = existingEntry.activity_name || (savedPref?.activity_id === actId ? savedPref?.activity_name : null) || tasks[0] || ''

      setFormCheckIn(existingEntry.check_in_time ? existingEntry.check_in_time.substring(0, 5) : '08:00')
      setFormCheckOut(existingEntry.check_out_time ? existingEntry.check_out_time.substring(0, 5) : '17:00')
      setFormSupervisor(existingEntry.supervisor || savedPref?.supervisor || mobileUser?.name || currentUserSupervisor || '')
      setFormActivityId(actId)
      setFormActivityName(taskName)
      setIsCustomFormTask(!tasks.includes(taskName) && !!taskName)
      setFormLocation(existingEntry.location || savedPref?.location || compSummary?.location || '')
      setFormAlc(existingEntry.alc_result ? String(existingEntry.alc_result).replace('%', '') : '')
      
      // Initialize dynamic PPE items
      const initialFormPpe: Record<string, boolean> = {}
      let existingPpeDetails: Record<string, boolean> | null = null
      try {
        if (existingEntry.notes) {
          const parsed = JSON.parse(existingEntry.notes)
          if (parsed?.ppe_details && typeof parsed.ppe_details === 'object') {
            existingPpeDetails = parsed.ppe_details
          }
        }
      } catch {}

      activePpeItems.forEach(item => {
        if (existingPpeDetails && typeof existingPpeDetails[item.id] === 'boolean') {
          initialFormPpe[item.id] = existingPpeDetails[item.id]
        } else if (item.id === 'helmet') initialFormPpe[item.id] = existingEntry.ppe_helmet ?? false
        else if (item.id === 'vest') initialFormPpe[item.id] = existingEntry.ppe_vest ?? false
        else if (item.id === 'glasses' || item.id === 'shirt') initialFormPpe[item.id] = existingEntry.ppe_shirt ?? false
        else if (item.id === 'gloves') initialFormPpe[item.id] = existingEntry.ppe_gloves ?? false
        else if (item.id === 'shoes') initialFormPpe[item.id] = existingEntry.ppe_shoes ?? false
        else initialFormPpe[item.id] = false
      })
      setFormPpeValues(initialFormPpe)

      setFormHelmet(existingEntry.ppe_helmet ?? false)
      setFormVest(existingEntry.ppe_vest ?? false)
      setFormShirt(existingEntry.ppe_shirt ?? false)
      setFormGloves(existingEntry.ppe_gloves ?? false)
      setFormShoes(existingEntry.ppe_shoes ?? false)
      setFormPurpose(existingEntry.purpose || '')
      setIsCustomPurpose(!PURPOSE_PRESETS.includes(existingEntry.purpose || '') && !!existingEntry.purpose)
      setFormNotes(extractUserNote(existingEntry.notes))
    } else {
      setFormCheckIn('08:00')
      setFormCheckOut('17:00')
      setFormSupervisor(savedPref?.supervisor || mobileUser?.name || currentUserSupervisor || '')
      
      const targetActId = savedPref?.activity_id || activities[0]?.id || ''
      const targetActObj = activities.find(a => a.id === targetActId) || activities[0]
      const tasks = getTasksForActivity(targetActId)
      const taskName = (savedPref?.activity_id === targetActId ? savedPref?.activity_name : null) || compSummary?.activityName || tasks[0] || targetActObj?.name || ''

      setFormActivityId(targetActId)
      setFormActivityName(taskName)
      setIsCustomFormTask(false)
      setFormLocation(savedPref?.location || compSummary?.location || targetActObj?.location || '')
      setFormAlc('')
      
      // Default unchecked for fresh entry
      const initialFormPpe: Record<string, boolean> = {}
      activePpeItems.forEach(item => { initialFormPpe[item.id] = false })
      setFormPpeValues(initialFormPpe)

      setFormHelmet(false)
      setFormVest(false)
      setFormShirt(false)
      setFormGloves(false)
      setFormShoes(false)
      setFormPurpose('')
      setIsCustomPurpose(false)
      setFormNotes('')
    }

    setCurrentStep(3)
  }

  // 1-Tap Quick Pass in Step 2
  const handleQuickPassMember = async (contractor: Contractor, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setSavingQuickId(contractor.id)
    const existingEntry = getEntryForContractor(contractor)
    const memberWage = getContractorDailyWage(contractor)
    const compSummary = companySummaries.find(c => c.name === (contractor.company_name || selectedCompany))
    const firstAct = activities[0]
    const savedPref = contractor.id ? getContractorSavedPref(contractor.id) : null
    const targetActId = savedPref?.activity_id || firstAct?.id || null
    const targetActObj = activities.find(a => a.id === targetActId) || firstAct
    const defaultTask = targetActObj?.tasks ? targetActObj.tasks.split(/[,;\n]+/)[0]?.trim() : targetActObj?.name || null

    const quickPpeDetails: Record<string, boolean> = {}
    activePpeItems.forEach(it => { quickPpeDetails[it.id] = true })

    const payload = {
      entry_date: date,
      contractor_id: contractor.id || null,
      contractor_name: contractor.name,
      company_name: contractor.company_name || selectedCompany || null,
      supervisor: savedPref?.supervisor || formSupervisor.trim() || mobileUser?.name || currentUserSupervisor || null,
      purpose: null,
      activity_id: targetActId,
      activity_name: savedPref?.activity_name || compSummary?.activityName || defaultTask,
      location: savedPref?.location || compSummary?.location || targetActObj?.location || null,
      check_in_time: '08:00',
      check_out_time: '17:00',
      alc_result: normalizeAlcForDb('0%') as ALCResult,
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
      await loadData(true)
    } catch (err: any) {
      console.error('Quick pass error:', err)
      toast.error(`บันทึกไม่สำเร็จ: ${err?.message || 'เกิดข้อผิดพลาด'}`)
    } finally {
      setSavingQuickId(null)
    }
  }

  // Cancel / Revoke Checklist Entry (กรณีกดผิด / ต้องการยกเลิกการตรวจ)
  const handleCancelEntry = async (contractor: Contractor, entry: ChecklistEntry, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    const isConfirmed = window.confirm(`ต้องการยกเลิกการตรวจของ "${contractor.name}" ใช่หรือไม่?\n(สถานะจะกลับเป็นยังไม่ตรวจ)`)
    if (!isConfirmed) return

    setDeletingId(entry.id)
    try {
      const res = await fetch(`/api/checklist/${entry.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'ยกเลิกไม่สำเร็จ')
      }
      toast.success(`ยกเลิกการตรวจของ ${contractor.name} เรียบร้อย`)
      await loadData(true)
      if (currentStep === 3) {
        setCurrentStep(2)
        setSelectedContractor(null)
      }
    } catch (err: any) {
      console.error('Cancel entry error:', err)
      toast.error(`ยกเลิกไม่สำเร็จ: ${err?.message || 'เกิดข้อผิดพลาด'}`)
    } finally {
      setDeletingId(null)
    }
  }

  // Save Step 3 (Frame 6) -> Automatically Return to Step 2
  const handleSaveChecklistForm = async () => {
    if (!selectedContractor) return
    setSavingForm(true)

    const existingEntry = getEntryForContractor(selectedContractor)
    const memberWage = getContractorDailyWage(selectedContractor)
    const savedPref = selectedContractor.id ? getContractorSavedPref(selectedContractor.id) : null

    const cleanUserNote = extractUserNote(formNotes)
    const formPpeJson = JSON.stringify({
      ppe_details: formPpeValues,
      ...(cleanUserNote ? { user_note: cleanUserNote } : {}),
    })

    const payload = {
      entry_date: date,
      contractor_id: selectedContractor.id || null,
      contractor_name: selectedContractor.name,
      company_name: selectedContractor.company_name || selectedCompany || null,
      supervisor: formSupervisor.trim() || savedPref?.supervisor || mobileUser?.name || currentUserSupervisor || null,
      purpose: formPurpose.trim() || null,
      activity_id: formActivityId.trim() || null,
      activity_name: formActivityName.trim() || null,
      location: formLocation.trim() || null,
      check_in_time: formCheckIn.trim() || null,
      check_out_time: formCheckOut.trim() || null,
      alc_result: normalizeAlcForDb(formAlc) as ALCResult,
      ppe_helmet: formPpeValues['helmet'] ?? !!formHelmet,
      ppe_vest: formPpeValues['vest'] ?? !!formVest,
      ppe_shirt: formPpeValues['glasses'] ?? formPpeValues['shirt'] ?? !!formShirt,
      ppe_gloves: formPpeValues['gloves'] ?? !!formGloves,
      ppe_shoes: formPpeValues['shoes'] ?? !!formShoes,
      daily_wage: (memberWage !== null && memberWage !== undefined && !isNaN(memberWage)) ? memberWage : (existingEntry?.daily_wage ?? null),
      status: 'active' as const,
      is_blacklisted: false,
      meal_allowance: false,
      notes: formPpeJson,
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
        toast.success(`อัปเดต ${selectedContractor.name} เรียบร้อย`)
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
        toast.success(`บันทึก ${selectedContractor.name} สำเร็จ`)
      }

      // จำค่าโครงการ/กิจกรรม/สถานที่ ไว้สำหรับคนนี้
      if (selectedContractor?.id) {
        saveContractorSavedPref(selectedContractor.id, {
          activity_id: formActivityId,
          activity_name: formActivityName,
          location: formLocation,
          supervisor: formSupervisor,
        })
      }

      await loadData(true)

      // ✅ ตามข้อกำหนด: "เมื่อบันทึกเสร็จก็กลับมาที่สเตป 2"
      setCurrentStep(2)
      setSelectedContractor(null)
    } catch (err: any) {
      console.error('Save form error:', err)
      toast.error(`บันทึกไม่สำเร็จ: ${err?.message || 'เกิดข้อผิดพลาด'}`)
    } finally {
      setSavingForm(false)
    }
  }

  // Open Batch Checklist Modal (เลือกโครงการ, งาน, สถานที่, หัวหน้างาน, PPE ก่อนกดยืนยันผ่าน)
  const handleOpenBatchModal = (idsToUse?: string[]) => {
    let ids = idsToUse && idsToUse.length > 0 ? idsToUse : selectedMemberIds
    if (!ids || ids.length === 0) {
      ids = pendingMembersInTeam.map(c => c.id)
    }

    if (ids.length === 0) {
      toast.info('ไม่มีรายชื่อช่างที่ยังไม่ได้ตรวจในสังกัดนี้')
      return
    }

    setSelectedMemberIds(ids)

    // Prefill Project & Task from company summary or first activity
    const compSummary = companySummaries.find(c => c.name === selectedCompany)
    const firstAct = activities[0]
    const actId = firstAct?.id || ''
    const tasks = getTasksForActivity(actId)

    setBatchActivityId(actId)
    setBatchActivityName(tasks[0] || firstAct?.name || compSummary?.activityName || '')
    setIsCustomBatchTask(false)
    setBatchLocation(compSummary?.location || firstAct?.location || '')
    setBatchSupervisor(formSupervisor.trim() || mobileUser?.name || currentUserSupervisor || '')
    setBatchCheckIn('08:00')
    setBatchCheckOut('17:00')
    setBatchHelmet(true)
    setBatchVest(true)
    setBatchShirt(true)
    setBatchGloves(true)
    setBatchShoes(true)

    // Dynamic PPE for batch pass: default all active items checked
    const initialBatchPpe: Record<string, boolean> = {}
    activePpeItems.forEach(it => { initialBatchPpe[it.id] = true })
    setBatchPpeValues(initialBatchPpe)

    setIsBatchModalOpen(true)
  }

  const handleBatchActivityChange = (actId: string) => {
    setBatchActivityId(actId)
    const act = activities.find(a => a.id === actId)
    const tasks = getTasksForActivity(actId)
    setBatchActivityName(tasks[0] || act?.name || '')
    setIsCustomBatchTask(false)
    if (act?.location) {
      setBatchLocation(act.location)
    }
  }

  // Confirm Batch Pass
  const handleConfirmBatchPass = async () => {
    if (selectedMemberIds.length === 0) {
      toast.warning('กรุณาเลือกช่างอย่างน้อย 1 คน')
      return
    }
    setIsSavingBatch(true)

    const batchPpeJson = JSON.stringify({ ppe_details: batchPpeValues })

    const selectedContractors = contractors.filter(c => selectedMemberIds.includes(c.id))
    const inserts = selectedContractors.map(c => {
      const memberWage = getContractorDailyWage(c)
      return {
        entry_date: date,
        contractor_id: c.id || null,
        contractor_name: c.name,
        company_name: c.company_name || selectedCompany,
        supervisor: batchSupervisor.trim() || null,
        purpose: null,
        activity_id: batchActivityId || null,
        activity_name: batchActivityName.trim() || null,
        location: batchLocation.trim() || null,
        check_in_time: batchCheckIn.trim() || '08:00',
        check_out_time: batchCheckOut.trim() || '17:00',
        alc_result: normalizeAlcForDb('0%') as ALCResult,
        ppe_helmet: batchPpeValues['helmet'] ?? !!batchHelmet,
        ppe_vest: batchPpeValues['vest'] ?? !!batchVest,
        ppe_shirt: batchPpeValues['glasses'] ?? batchPpeValues['shirt'] ?? !!batchShirt,
        ppe_gloves: batchPpeValues['gloves'] ?? !!batchGloves,
        ppe_shoes: batchPpeValues['shoes'] ?? !!batchShoes,
        daily_wage: (memberWage !== null && memberWage !== undefined && !isNaN(memberWage)) ? memberWage : null,
        status: 'active' as const,
        is_blacklisted: false,
        meal_allowance: false,
        notes: batchPpeJson,
      }
    })

    try {
      const res = await fetch('/api/checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inserts),
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'บันทึกไม่สำเร็จ')
      }
      toast.success(`⚡ ตรวจผ่านกลุ่ม ${inserts.length} คน เรียบร้อย!`)
      setIsBatchModalOpen(false)
      setSelectedMemberIds([])
      await loadData(true)
    } catch (err: any) {
      console.error('Batch pass error:', err)
      toast.error(`บันทึกไม่สำเร็จ: ${err?.message || 'เกิดข้อผิดพลาด'}`)
    } finally {
      setIsSavingBatch(false)
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER UI
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="w-full h-full flex flex-col flex-1 min-h-0 bg-slate-100 select-none font-sans">
      
      {/* ──────────────────────────────────────────────────────────────────────────
          STEP 1: FRAME 4 - ตรวจ Checklist ตามสังกัด (เลือกทีมช่าง)
      ────────────────────────────────────────────────────────────────────────── */}
      {currentStep === 1 && (
        <div className="flex flex-col flex-1 min-h-0 bg-slate-100">
          
          {/* Top Bar (Premium Dark Gradient Header) */}
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-white px-3.5 py-2.5 shrink-0 flex items-center justify-between border-b border-slate-800 shadow-md">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-sm shrink-0 border border-emerald-400/30">
                <Building2 className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-bold tracking-tight text-white truncate leading-tight">
                  ตรวจ Checklist ตามสังกัด
                </h1>
                <p className="text-xs text-slate-300 font-normal leading-tight mt-0.5">
                  ระบบตรวจความปลอดภัยหน้างาน
                </p>
              </div>
            </div>

            {/* User Profile / Auth Pill & Settings */}
            <div className="flex items-center gap-1.5 shrink-0">
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setIsSettingsModalOpen(true)}
                  className="h-8 px-2.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-1 border border-white/20 transition-all active:scale-95"
                  title="ตั้งค่ารายการเช็คลิสต์ PPE"
                >
                  <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                  <span>ตั้งค่า</span>
                </button>
              )}

              {onOpenAuth && (
                <button
                  onClick={onOpenAuth}
                  className={`h-8 flex items-center gap-1.5 px-3 rounded-full text-xs font-semibold transition-all border shadow-2xs active:scale-95 ${
                    mobileUser?.name
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40 hover:bg-emerald-500/30'
                      : 'bg-white/10 text-slate-200 border-white/20 hover:bg-white/20 hover:text-white'
                  }`}
                  title="จัดการข้อมูลผู้ใช้งาน / เข้าสู่ระบบ"
                >
                  {mobileUser?.authMethod === 'line' ? (
                    <MessageSquare className="w-3.5 h-3.5 text-[#06C755] fill-[#06C755]" />
                  ) : mobileUser?.authMethod === 'phone' ? (
                    <Phone className="w-3.5 h-3.5 text-sky-400" />
                  ) : (
                    <User className="w-3.5 h-3.5 text-amber-300" />
                  )}
                  <span className="truncate max-w-[100px]">
                    {mobileUser?.name || 'เข้าสู่ระบบ'}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Date Picker Bar & Search */}
          <div className="p-2.5 bg-white border-b border-slate-300 flex flex-col gap-2 shrink-0">
            {/* Quick date switch */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    const dt = new Date(date)
                    dt.setDate(dt.getDate() - 1)
                    setDate(format(dt, 'yyyy-MM-dd'))
                  }}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300"
                  title="วันก่อนหน้า"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="h-9 text-xs font-semibold px-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 cursor-pointer"
                />
                <button
                  onClick={() => {
                    const dt = new Date(date)
                    dt.setDate(dt.getDate() + 1)
                    setDate(format(dt, 'yyyy-MM-dd'))
                  }}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300"
                  title="วันถัดไป"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                <span>{companySummaries.length} สังกัด</span>
                <span>•</span>
                <span className="text-emerald-700 font-bold">
                  {companySummaries.reduce((s, c) => s + c.passedCount, 0)} ผ่าน
                </span>
              </div>
            </div>

            {/* Search Box (h-9) */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                type="search"
                placeholder="ค้นหาชื่อทีมช่าง / สังกัด / สถานที่..."
                value={companySearch}
                onChange={e => setCompanySearch(e.target.value)}
                className="w-full h-9 text-xs pl-9 pr-3 rounded-lg border border-slate-300 bg-white focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 text-slate-900 font-normal placeholder:text-slate-500"
              />
            </div>
          </div>

          {/* Company Cards List (Scrollable matching Frame 4) */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2 scrollbar-thin">
            {loading ? (
              <div className="py-16 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                <span className="font-normal">กำลังโหลดข้อมูลทีมช่าง...</span>
              </div>
            ) : filteredCompanies.length === 0 ? (
              <div className="py-16 text-center text-slate-600 text-xs font-normal">
                ไม่พบข้อมูลสังกัดทีมช่าง
              </div>
            ) : (
              filteredCompanies.map((comp, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSelectCompany(comp.name)}
                  className="bg-white rounded-xl p-2.5 border border-slate-300 shadow-2xs hover:border-slate-400 cursor-pointer active:scale-[0.99] transition-all flex flex-col gap-2"
                >
                  {/* Top Line: Company Name & Location */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-sm text-slate-950">
                          {comp.name}
                        </span>
                        {comp.code && (
                          <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-900 border border-blue-300 text-xs font-bold">
                            [{comp.code}]
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 font-normal mt-0.5">
                        {comp.totalCount} คนงาน
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-semibold text-slate-800 block">
                        สถานที่
                      </span>
                      <span className="text-xs text-slate-700 truncate max-w-[130px] block font-normal">
                        {comp.location || 'โรงงาน 1'}
                      </span>
                    </div>
                  </div>

                  {/* Bottom Line: Summary stats (มา X  ALC Y  ไม่ผ่าน Z  ไม่มา W  แจ้งประสงค์ V) */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200 text-xs flex-wrap gap-1">
                    <div className="flex items-center gap-2 flex-wrap font-semibold">
                      <span className="text-emerald-700">
                        มา {comp.passedCount}
                      </span>
                      {comp.alcCount > 0 && (
                        <span className="text-red-700">
                          ALC {comp.alcCount}
                        </span>
                      )}
                      {comp.ppeFailedCount > 0 && (
                        <span className="text-red-700">
                          ไม่ผ่าน {comp.ppeFailedCount}
                        </span>
                      )}
                      <span className="text-slate-700 font-normal">
                        ไม่มา {comp.missingCount}
                      </span>
                      {comp.requestCount > 0 && (
                        <span className="text-blue-800">
                          แจ้งประสงค์ {comp.requestCount}
                        </span>
                      )}
                    </div>

                    <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          STEP 2: FRAME 5 - ทีมช่าง (รายชื่อลูกทีมในสังกัด)
      ────────────────────────────────────────────────────────────────────────── */}
      {currentStep === 2 && (
        <div className="flex flex-col flex-1 min-h-0 bg-slate-100">
          
          {/* Top Bar (Premium Dark Gradient Header with Back Button) */}
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-white px-3.5 py-2.5 shrink-0 flex items-center justify-between border-b border-slate-800 shadow-md">
            <button
              onClick={() => {
                setSelectedMemberIds([])
                setCurrentStep(1)
              }}
              className="h-8 flex items-center gap-1.5 text-xs font-semibold text-slate-200 hover:text-white px-3 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 transition-all active:scale-95"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>ย้อนกลับ</span>
            </button>

            <div className="text-center truncate px-2">
              <h1 className="text-sm font-bold text-white truncate">
                {selectedCompany || 'ทีมช่าง'}
              </h1>
              <p className="text-xs text-slate-300 font-normal truncate">
                รายชื่อช่างในสังกัด
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setIsSettingsModalOpen(true)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white flex items-center justify-center border border-white/20 transition-all active:scale-95"
                  title="ตั้งค่ารายการเช็คลิสต์ PPE"
                >
                  <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                </button>
              )}
              <button
                onClick={() => handleOpenBatchModal()}
                className="h-8 px-3 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm border border-emerald-400/30 transition-all active:scale-95"
                title="ตรวจผ่านแบบกลุ่ม"
              >
                <Zap className="w-3.5 h-3.5 fill-white" />
                <span>{selectedMemberIds.length > 0 ? `ผ่านที่เลือก (${selectedMemberIds.length})` : 'ผ่านทั้งทีม'}</span>
              </button>
            </div>
          </div>

          {/* Subheader: Status filter tabs & Member search */}
          <div className="p-2.5 bg-white border-b border-slate-300 flex flex-col gap-2 shrink-0">
            {/* Filter tabs */}
            <div className="grid grid-cols-3 gap-1 bg-slate-100 p-0.5 rounded-lg text-xs font-semibold text-slate-700 border border-slate-300">
              <button
                onClick={() => setMemberStatusFilter('all')}
                className={`h-8 rounded text-center transition-all flex items-center justify-center ${
                  memberStatusFilter === 'all' ? 'bg-white text-slate-950 font-semibold shadow-2xs' : 'text-slate-700 hover:text-slate-950 font-normal'
                }`}
              >
                ทั้งหมด ({contractors.filter(c => (c.company_name || 'รับจ้างอิสระ').trim() === selectedCompany).length})
              </button>
              <button
                onClick={() => setMemberStatusFilter('pending')}
                className={`h-8 rounded text-center transition-all flex items-center justify-center ${
                  memberStatusFilter === 'pending' ? 'bg-white text-amber-950 font-semibold shadow-2xs' : 'text-slate-700 hover:text-slate-950 font-normal'
                }`}
              >
                ยังไม่ตรวจ ({currentCompanySummary?.missingCount ?? 0})
              </button>
              <button
                onClick={() => setMemberStatusFilter('checked')}
                className={`h-8 rounded text-center transition-all flex items-center justify-center ${
                  memberStatusFilter === 'checked' ? 'bg-white text-emerald-950 font-semibold shadow-2xs' : 'text-slate-700 hover:text-slate-950 font-normal'
                }`}
              >
                ตรวจแล้ว ({(currentCompanySummary?.totalCount ?? 0) - (currentCompanySummary?.missingCount ?? 0)})
              </button>
            </div>

            {/* Member search (h-9) */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                type="search"
                placeholder="ค้นหาชื่อลูกทีม / ตำแหน่ง..."
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
                className="w-full h-9 text-xs pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 bg-white focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 text-slate-900 font-normal placeholder:text-slate-500"
              />
            </div>

            {/* Selection Toolbar (when pending members exist and not in checked tab) */}
            {pendingMembersInTeam.length > 0 && memberStatusFilter !== 'checked' && (
              <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="flex items-center gap-1.5 text-slate-700 hover:text-slate-950 font-medium active:scale-95 transition-all py-0.5"
                >
                  <span className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                    selectedMemberIds.length === pendingMembersInTeam.length && pendingMembersInTeam.length > 0
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : selectedMemberIds.length > 0
                      ? 'bg-emerald-100 border-emerald-500 text-emerald-700'
                      : 'border-slate-300 bg-white'
                  }`}>
                    {selectedMemberIds.length === pendingMembersInTeam.length && pendingMembersInTeam.length > 0 ? (
                      <Check className="w-3 h-3 stroke-[3]" />
                    ) : selectedMemberIds.length > 0 ? (
                      <span className="w-2 h-0.5 bg-emerald-600 rounded-full" />
                    ) : null}
                  </span>
                  <span>
                    {selectedMemberIds.length === pendingMembersInTeam.length
                      ? 'เลือกทั้งหมด'
                      : selectedMemberIds.length === 0
                      ? 'เลือกทั้งหมด'
                      : `เลือกแล้ว ${selectedMemberIds.length}/${pendingMembersInTeam.length} คน`}
                  </span>
                </button>

                {selectedMemberIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleOpenBatchModal(selectedMemberIds)}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-2xs active:scale-95 transition-all"
                  >
                    <Zap className="w-3.5 h-3.5 fill-emerald-600 text-emerald-600" />
                    <span>ผ่านที่เลือก ({selectedMemberIds.length})</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Members List (Scrollable cards in Frame 5) */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2 scrollbar-thin">
            {currentTeamMembers.length === 0 ? (
              <div className="py-10 px-3 text-center">
                {currentCompanySummary && currentCompanySummary.missingCount === 0 ? (
                  <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-2xs space-y-3">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-slate-900">
                        ตรวจบันทึกครบทุกคนแล้ว!
                      </h3>
                      <p className="text-xs text-slate-600 font-normal">
                        บันทึกข้อมูลเรียบร้อยแล้ว รายการทั้งหมดจะแสดงในหน้า <span className="font-semibold text-blue-700">"ประวัติ"</span>
                      </p>
                    </div>

                    <div className="pt-2 flex flex-col gap-2">
                      {onNavigateToHistory && (
                        <button
                          type="button"
                          onClick={onNavigateToHistory}
                          className="w-full h-10 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-all"
                        >
                          <FileText className="w-4 h-4" />
                          <span>ไปที่หน้าประวัติการตรวจ</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setMemberStatusFilter('checked')}
                        className="w-full h-9 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-800 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all"
                      >
                        <span>ดูรายชื่อที่ตรวจแล้ว ({currentCompanySummary.totalCount} คน)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMemberIds([])
                          setCurrentStep(1)
                        }}
                        className="w-full h-9 rounded-xl text-slate-600 hover:text-slate-900 text-xs font-normal"
                      >
                        ← กลับไปเลือกสังกัดอื่น
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-slate-500 text-xs font-normal bg-white rounded-xl border border-slate-200 p-4">
                    ไม่พบรายชื่อลูกทีมที่ยังไม่ได้ตรวจในเงื่อนไขนี้
                  </div>
                )}
              </div>
            ) : (
              currentTeamMembers.map((member, idx) => {
                const entry = getEntryForContractor(member)
                const isChecked = !!entry
                const isAlcPass = isChecked ? !isAlcoholFailed(entry.alc_result) : false
                const isPpePass = isChecked ? checkEntryPpePass(entry) : false
                const isSafe = isChecked && isAlcPass && isPpePass
                const isAlcRisk = getContractorAlcRisk(member)

                return (
                  <div
                    key={member.id}
                    className={`bg-white rounded-xl p-2.5 border shadow-2xs transition-all flex items-center justify-between gap-2 ${
                      isChecked
                        ? isSafe
                          ? 'border-emerald-300 bg-emerald-50/20'
                          : 'border-red-300 bg-red-50/20'
                        : 'border-slate-300'
                    }`}
                  >
                    {/* Left: Checkbox / Index & Member Info */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {!isChecked ? (
                        <button
                          type="button"
                          onClick={(e) => handleToggleSelectMember(member.id, e)}
                          className="w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 transition-all active:scale-95"
                          style={{ minWidth: '32px' }}
                          title={selectedMemberIds.includes(member.id) ? 'ยกเลิกเลือก' : 'เลือกช่างคนนี้'}
                        >
                          <span className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                            selectedMemberIds.includes(member.id)
                              ? 'bg-emerald-600 border-emerald-600 text-white shadow-2xs'
                              : 'border-slate-300 bg-white hover:border-slate-400 text-slate-500'
                          }`}>
                            {selectedMemberIds.includes(member.id) ? (
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            ) : (
                              <span className="text-[11px] font-bold text-slate-500">{idx + 1}</span>
                            )}
                          </span>
                        </button>
                      ) : (
                        <span className="w-8 h-8 rounded-full bg-slate-200 text-slate-900 text-xs font-semibold flex items-center justify-center shrink-0 border border-slate-300" style={{ minWidth: '32px' }}>
                          {idx + 1}
                        </span>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-sm text-slate-950 truncate">
                            {member.name}
                          </span>
                          {isAlcRisk && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-950 border border-amber-300 text-xs font-bold">
                              เสี่ยง ALC
                            </span>
                          )}
                        </div>

                        {/* Status detail */}
                        <div className="text-xs mt-0.5 flex items-center gap-1.5 flex-wrap font-normal">
                          {isChecked ? (
                            isSafe ? (
                              <span className="text-emerald-800 font-semibold flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 inline text-emerald-700" /> ผ่านเรียบร้อย
                              </span>
                            ) : (
                              <span className="text-red-700 font-semibold flex items-center gap-1">
                                <XCircle className="w-3.5 h-3.5 inline text-red-700" /> 
                                {!isAlcPass ? `ALC ${entry.alc_result}` : 'PPE ไม่ครบ'}
                              </span>
                            )
                          ) : (
                            <span className="text-slate-600 font-normal">
                              ยังไม่ได้ตรวจบันทึก
                            </span>
                          )}

                          {entry?.purpose && (
                            <span className="text-blue-800 font-normal">
                              • {entry.purpose}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions (Only these buttons trigger actions) */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {!isChecked ? (
                        <button
                          type="button"
                          onClick={e => handleQuickPassMember(member, e)}
                          disabled={savingQuickId === member.id}
                          className="h-8 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-semibold flex items-center gap-1 shadow-2xs transition-all"
                          title="ตรวจผ่านด่วน 1-Tap"
                        >
                          <Zap className="w-3.5 h-3.5 fill-white" />
                          <span>ผ่าน</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={e => handleCancelEntry(member, entry, e)}
                          disabled={deletingId === entry.id}
                          className="h-8 px-2.5 rounded-lg bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 text-xs font-semibold flex items-center gap-1 border border-rose-300 transition-all"
                          title="ยกเลิกการตรวจ คืนสถานะเป็นยังไม่ตรวจ"
                        >
                          {deletingId === entry.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-600" />
                          ) : (
                            <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                          )}
                          <span>ยกเลิก</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleOpenFormForContractor(member)}
                        className="h-8 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 text-xs font-medium flex items-center gap-1 border border-slate-300 transition-all"
                        title="เปิดฟอร์มตรวจละเอียด"
                      >
                        <span>ตรวจเช็ค</span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          STEP 3: FRAME 6 - ตรวจเช็ค (ฟอร์มตรวจ Checklist รายคน)
      ────────────────────────────────────────────────────────────────────────── */}
      {currentStep === 3 && selectedContractor && (
        <div className="flex flex-col flex-1 min-h-0 bg-slate-100">
          
          {/* Top Bar (Premium Dark Gradient Header with Back Button) */}
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-white px-3.5 py-2.5 shrink-0 flex items-center justify-between border-b border-slate-800 shadow-md">
            <button
              onClick={() => setCurrentStep(2)}
              className="h-8 flex items-center gap-1.5 text-xs font-semibold text-slate-200 hover:text-white px-3 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 transition-all active:scale-95"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>ย้อนกลับ</span>
            </button>

            <div className="text-center truncate px-2 max-w-[200px]">
              <h1 className="text-sm font-bold text-white truncate">
                {selectedContractor.name}
              </h1>
              <p className="text-xs text-slate-300 font-normal truncate">
                ฟอร์มตรวจความปลอดภัยรายคน
              </p>
            </div>

            {isAdmin && (
              <button
                type="button"
                onClick={() => setIsSettingsModalOpen(true)}
                className="h-8 px-2.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-1 border border-white/20 transition-all active:scale-95"
                title="ตั้งค่ารายการเช็คลิสต์ PPE"
              >
                <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">ตั้งค่า</span>
              </button>
            )}
          </div>

          {/* Scrollable Form Area */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 scrollbar-thin">
            
            {/* Member Card Summary */}
            <div className="bg-white p-2.5 rounded-xl border border-slate-300 shadow-2xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-slate-950">
                  {selectedContractor.name}
                </span>
                <span className="text-xs font-semibold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-300">
                  {selectedContractor.company_name || selectedCompany}
                </span>
              </div>
              {selectedContractor.position && (
                <p className="text-xs text-slate-700 font-normal">
                  ตำแหน่ง: {cleanContractorPosition(selectedContractor.position)}
                </p>
              )}
              {getEntryForContractor(selectedContractor) && (
                <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-200">
                  <span className="text-xs text-emerald-800 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> บันทึกการตรวจแล้ว
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const ent = getEntryForContractor(selectedContractor)
                      if (ent) handleCancelEntry(selectedContractor, ent)
                    }}
                    disabled={deletingId === getEntryForContractor(selectedContractor)?.id}
                    className="text-xs text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-300 px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>ยกเลิกการตรวจคนนี้</span>
                  </button>
                </div>
              )}
            </div>



            {/* 2. Project, Activity/Task & Location */}
            <div className="bg-white p-2.5 rounded-xl border border-slate-300 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                  <Briefcase className="w-3.5 h-3.5 text-blue-600" />
                  <span>โครงการ / งาน & สถานที่</span>
                </div>
                <span className="text-[11px] text-slate-600 font-normal">จำค่าไว้ให้อัตโนมัติ</span>
              </div>

              <div className="space-y-2">
                {/* โครงการ (Activity / Project) */}
                <div>
                  <label className="text-xs text-slate-700 font-semibold mb-1 block">โครงการ (กิจกรรมหลัก)</label>
                  <div className="relative flex items-center">
                    <select
                      value={formActivityId}
                      onChange={e => {
                        const newActId = e.target.value
                        setFormActivityId(newActId)
                        const act = activities.find(a => a.id === newActId)
                        if (act) {
                          // อัปเดตสถานที่ตามโครงการ
                          if (act.location) {
                            setFormLocation(act.location)
                          }
                          // ดึงงานของโครงการใหม่ทันที
                          const newTasks = getTasksForActivity(newActId)
                          if (newTasks.length > 0) {
                            setFormActivityName(newTasks[0])
                          } else {
                            setFormActivityName(act.name)
                          }
                        } else {
                          setFormActivityName('')
                        }
                      }}
                      className="w-full h-9 text-xs pl-2.5 pr-8 rounded-lg border border-slate-300 bg-white text-slate-900 font-normal appearance-none truncate focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="">-- เลือกโครงการ / กิจกรรม --</option>
                      {activities.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.code ? `[${a.code}] ` : ''}{a.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-500 absolute right-2.5 pointer-events-none" />
                  </div>
                </div>

                {/* งานที่ปฏิบัติ (Task) - แถวเดียว สะอาดตา */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-slate-700 font-semibold">งานที่ปฏิบัติ</label>
                    <span className="text-[11px] text-blue-700 font-medium">
                      {tasksForSelectedActivity.length > 0 ? `${tasksForSelectedActivity.length} งานในโครงการนี้` : 'ตามโครงการ'}
                    </span>
                  </div>

                  {isCustomFormTask ? (
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="พิมพ์ระบุชื่องานที่ปฏิบัติ..."
                        value={formActivityName}
                        onChange={e => setFormActivityName(e.target.value)}
                        className="flex-1 h-9 text-xs px-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 font-normal focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomFormTask(false)
                          setFormActivityName(tasksForSelectedActivity[0] || '')
                        }}
                        className="h-9 px-2.5 rounded-lg border border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium shrink-0"
                      >
                        เลือกจากรายการ
                      </button>
                    </div>
                  ) : (
                    <div className="relative flex items-center">
                      <select
                        value={
                          tasksForSelectedActivity.includes(formActivityName)
                            ? formActivityName
                            : formActivityName
                            ? '__custom_val__'
                            : ''
                        }
                        onChange={e => {
                          const val = e.target.value
                          if (val === '__custom__') {
                            setIsCustomFormTask(true)
                            setFormActivityName('')
                          } else if (val === '__custom_val__') {
                            // keep
                          } else {
                            setFormActivityName(val)
                          }
                        }}
                        className="w-full h-9 text-xs pl-2.5 pr-8 rounded-lg border border-slate-300 bg-white text-slate-900 font-normal appearance-none truncate focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      >
                        <option value="">-- เลือกงานที่ปฏิบัติในโครงการนี้ --</option>
                        {tasksForSelectedActivity.map(t => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                        {formActivityName && !tasksForSelectedActivity.includes(formActivityName) && (
                          <option value="__custom_val__">{formActivityName} (ระบุเอง)</option>
                        )}
                        <option value="__custom__">+ พิมพ์ระบุงานเอง...</option>
                      </select>
                      <ChevronDown className="w-4 h-4 text-slate-500 absolute right-2.5 pointer-events-none" />
                    </div>
                  )}
                </div>

                {/* สถานที่ */}
                <div>
                  <label className="text-xs text-slate-700 font-semibold mb-1 block">สถานที่ปฏิบัติงาน</label>
                  <input
                    type="text"
                    placeholder="เช่น โรงงาน 1, อาคาร A, โซน B..."
                    value={formLocation}
                    onChange={e => setFormLocation(e.target.value)}
                    className="w-full h-9 text-xs px-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 font-normal focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* 3. ALC Alcohol Check */}
            <div className="bg-white p-2.5 rounded-xl border border-slate-300 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                  <span>ผลตรวจแอลกอฮอล์ (ALC)</span>
                </div>

                <span className={`text-xs font-bold px-2 py-0.5 rounded border ${
                  isAlcoholUnchecked(formAlc)
                    ? 'bg-slate-100 text-slate-600 border-slate-300'
                    : isAlcoholPassed(formAlc)
                    ? 'bg-emerald-100 text-emerald-950 border-emerald-300'
                    : 'bg-red-100 text-red-950 border-red-300'
                }`}>
                  {isAlcoholUnchecked(formAlc) ? 'ยังไม่ได้ตรวจ' : isAlcoholPassed(formAlc) ? `${formAlc} mg% (ปกติ) ✓` : `${formAlc} mg% (เกินเกณฑ์ ❌)`}
                </span>
              </div>

              {/* Quick Presets */}
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setFormAlc('0')}
                  className={`h-9 rounded-lg text-xs font-semibold transition-all border ${
                    formAlc === '0' || formAlc === '0.0' || formAlc === '0.00'
                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                      : 'bg-slate-100 text-slate-800 hover:bg-slate-200 border-slate-300 font-normal'
                  }`}
                >
                  0 (ปกติ)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const currentNum = parseFloat(formAlc)
                    if (isNaN(currentNum) || currentNum <= 0) {
                      setFormAlc('25')
                    }
                  }}
                  className={`h-9 rounded-lg text-xs font-semibold transition-all border ${
                    isAlcoholFailed(formAlc)
                      ? 'bg-red-600 text-white border-red-700 shadow-2xs'
                      : 'bg-slate-100 text-slate-800 hover:bg-slate-200 border-slate-300 font-normal'
                  }`}
                >
                  ระบุค่าเกิน (&gt;0)
                </button>
                <button
                  type="button"
                  onClick={() => setFormAlc('')}
                  className={`h-9 rounded-lg text-xs font-semibold transition-all border ${
                    isAlcoholUnchecked(formAlc)
                      ? 'bg-slate-700 text-white border-slate-800 shadow-2xs'
                      : 'bg-slate-100 text-slate-800 hover:bg-slate-200 border-slate-300 font-normal'
                  }`}
                >
                  ยังไม่ได้ตรวจ (ว่าง)
                </button>
              </div>

              {/* Numeric Input */}
              <div className="space-y-1">
                <div className="relative flex items-center">
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    placeholder="ยังไม่ได้ตรวจ (ใส่ตัวเลข เช่น 0, 15, 25)"
                    value={isAlcoholUnchecked(formAlc) ? '' : formAlc.replace('%', '').replace('>', '')}
                    onChange={e => {
                      const val = e.target.value
                      setFormAlc(val)
                    }}
                    className={`w-full h-9 text-xs pl-2.5 pr-12 rounded-lg border bg-white text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                      isAlcoholFailed(formAlc)
                        ? 'border-red-400 bg-red-50/50'
                        : isAlcoholPassed(formAlc)
                        ? 'border-emerald-400 bg-emerald-50/30'
                        : 'border-slate-300'
                    }`}
                  />
                  <span className="absolute right-2.5 text-[11px] font-semibold text-slate-600 pointer-events-none">
                    mg%
                  </span>
                </div>
              </div>
            </div>

            {/* 4. PPE Checklist (Dynamic Items) */}
            <div className="bg-white p-2.5 rounded-xl border border-slate-300 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>อุปกรณ์ความปลอดภัย (PPE)</span>
                  <span className="text-[11px] text-slate-500 font-normal">
                    ({Object.values(formPpeValues).filter(Boolean).length}/{activePpeItems.length})
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setIsSettingsModalOpen(true)}
                      className="text-xs text-slate-500 hover:text-emerald-700 font-medium flex items-center gap-0.5"
                      title="ตั้งค่ารายการ PPE"
                    >
                      <Sliders className="w-3 h-3 text-emerald-600" />
                      <span>จัดการ</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const allChecked = activePpeItems.length > 0 && activePpeItems.every(item => !!formPpeValues[item.id])
                      const nextVal = !allChecked
                      const updated: Record<string, boolean> = {}
                      activePpeItems.forEach(item => {
                        updated[item.id] = nextVal
                      })
                      setFormPpeValues(updated)
                      setFormHelmet(nextVal)
                      setFormVest(nextVal)
                      setFormShirt(nextVal)
                      setFormGloves(nextVal)
                      setFormShoes(nextVal)
                    }}
                    className="text-xs text-blue-700 hover:underline font-semibold"
                  >
                    {activePpeItems.length > 0 && activePpeItems.every(item => !!formPpeValues[item.id])
                      ? 'ยกเลิกทั้งหมด'
                      : `เลือกครบ ${activePpeItems.length} ชิ้น`}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-normal">
                {activePpeItems.map((item, idx) => {
                  const isChecked = !!formPpeValues[item.id]
                  const isLastOdd = activePpeItems.length % 2 !== 0 && idx === activePpeItems.length - 1
                  return (
                    <label
                      key={item.id}
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                        isLastOdd ? 'col-span-2' : ''
                      } ${
                        isChecked
                          ? 'bg-emerald-50 text-emerald-950 border-emerald-400 font-semibold shadow-2xs'
                          : 'bg-slate-50 text-slate-700 border-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={e => {
                          const checked = e.target.checked
                          setFormPpeValues(prev => ({ ...prev, [item.id]: checked }))
                          if (item.id === 'helmet') setFormHelmet(checked)
                          if (item.id === 'vest') setFormVest(checked)
                          if (item.id === 'glasses' || item.id === 'shirt') setFormShirt(checked)
                          if (item.id === 'gloves') setFormGloves(checked)
                          if (item.id === 'shoes') setFormShoes(checked)
                        }}
                        className="rounded text-emerald-600 focus:ring-0 w-4 h-4 shrink-0"
                      />
                      <span className="truncate">{item.icon} {item.label}</span>
                      {item.required && !isChecked && (
                        <span className="text-[10px] text-amber-600 ml-auto shrink-0 font-medium">*</span>
                      )}
                    </label>
                  )
                })}
              </div>
            </div>

            {/* 5. Purpose & Notes */}
            <div className="bg-white p-2.5 rounded-xl border border-slate-300 shadow-2xs space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                <span>แจ้งความประสงค์ & หมายเหตุ</span>
              </div>

              <div className="space-y-2">
                {/* แจ้งความประสงค์ - แถวเดียว พร้อมตัวเลือกเฉพาะที่ไม่ได้วงไว้ */}
                <div>
                  <label className="text-xs text-slate-700 font-semibold mb-1 block">แจ้งความประสงค์</label>

                  {isCustomPurpose ? (
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="พิมพ์ระบุแจ้งความประสงค์..."
                        value={formPurpose}
                        onChange={e => setFormPurpose(e.target.value)}
                        className="flex-1 h-9 text-xs px-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 font-normal focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomPurpose(false)
                          setFormPurpose('')
                        }}
                        className="h-9 px-2.5 rounded-lg border border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium shrink-0"
                      >
                        เลือกจากรายการ
                      </button>
                    </div>
                  ) : (
                    <div className="relative flex items-center">
                      <select
                        value={
                          PURPOSE_PRESETS.includes(formPurpose)
                            ? formPurpose
                            : formPurpose
                            ? '__custom_val__'
                            : ''
                        }
                        onChange={e => {
                          const val = e.target.value
                          if (val === '__custom__') {
                            setIsCustomPurpose(true)
                            setFormPurpose('')
                          } else if (val === '__custom_val__') {
                            // keep
                          } else {
                            setFormPurpose(val)
                          }
                        }}
                        className="w-full h-9 text-xs pl-2.5 pr-8 rounded-lg border border-slate-300 bg-white text-slate-900 font-normal appearance-none truncate focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      >
                        <option value="">-- ไม่ระบุ / เลือกแจ้งความประสงค์ --</option>
                        {PURPOSE_PRESETS.map(p => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                        {formPurpose && !PURPOSE_PRESETS.includes(formPurpose) && (
                          <option value="__custom_val__">{formPurpose} (ระบุเอง)</option>
                        )}
                        <option value="__custom__">+ พิมพ์ระบุเอง...</option>
                      </select>
                      <ChevronDown className="w-4 h-4 text-slate-500 absolute right-2.5 pointer-events-none" />
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs text-slate-700 font-semibold mb-1 block">หมายเหตุเพิ่มเติม</label>
                  <textarea
                    rows={2}
                    placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)..."
                    value={formNotes}
                    onChange={e => setFormNotes(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 font-normal focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

          </div>

          {/* Bottom Action Footer (2 Big thumb buttons in Frame 6 - Locked to bottom) */}
          <div className="p-2.5 bg-white border-t border-slate-300 shrink-0 grid grid-cols-2 gap-2.5 shadow-[0_-4px_16px_rgba(0,0,0,0.12)] z-30 sticky bottom-0">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="h-11 px-4 rounded-xl border border-slate-300 text-slate-800 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-xs font-semibold transition-all text-center"
            >
              ยกเลิก
            </button>

            <button
              type="button"
              disabled={savingForm}
              onClick={handleSaveChecklistForm}
              className="h-11 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-all disabled:opacity-50"
            >
              {savingForm ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>กำลังบันทึก...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>บันทึกข้อมูล</span>
                </>
              )}
            </button>
          </div>

        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          BATCH CHECKLIST MODAL (เลือกโครงการ/กิจกรรม/สถานที่ ก่อนกดผ่านทั้งหมด)
      ────────────────────────────────────────────────────────────────────────── */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in slide-in-from-bottom duration-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-white px-4 py-3 shrink-0 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-emerald-400 fill-emerald-400" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white leading-tight">
                    ตรวจผ่านแบบกลุ่ม ({selectedMemberIds.length} คน)
                  </h2>
                  <p className="text-[11px] text-slate-300 font-normal">
                    สังกัด: {selectedCompany}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBatchModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3 scrollbar-thin">
              {/* 1. Selected Members Chips */}
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-blue-600" />
                    <span>รายชื่อช่างที่เลือก ({selectedMemberIds.length} คน)</span>
                  </label>
                  <span className="text-[11px] text-slate-500">กด × เพื่อเอาออก</span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1">
                  {contractors.filter(c => selectedMemberIds.includes(c.id)).map(c => (
                    <span
                      key={c.id}
                      className="inline-flex items-center gap-1 text-xs bg-white text-slate-800 border border-slate-300 px-2 py-0.5 rounded-full shadow-2xs"
                    >
                      <span className="truncate max-w-[120px]">{c.name}</span>
                      <button
                        type="button"
                        onClick={() => handleToggleSelectMember(c.id)}
                        className="text-slate-400 hover:text-rose-600 focus:outline-none"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* 2. Project / Activity */}
              <div>
                <label className="text-xs text-slate-700 font-semibold mb-1 block flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5 text-blue-600" />
                  <span>โครงการ (กิจกรรมหลัก) *</span>
                </label>
                <div className="relative flex items-center">
                  <select
                    value={batchActivityId}
                    onChange={e => handleBatchActivityChange(e.target.value)}
                    className="w-full h-9 text-xs pl-2.5 pr-8 rounded-lg border border-slate-300 bg-white text-slate-900 font-normal appearance-none truncate focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="">-- เลือกโครงการ / กิจกรรม --</option>
                    {activities.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.code ? `[${a.code}] ` : ''}{a.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-500 absolute right-2.5 pointer-events-none" />
                </div>
              </div>

              {/* 3. Task (งานที่ปฏิบัติ - แถวเดียว สะอาดตา) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-slate-700 font-semibold">งานที่ปฏิบัติ</label>
                  <span className="text-[11px] text-blue-700 font-medium">
                    {tasksForBatchActivity.length > 0 ? `${tasksForBatchActivity.length} งานในโครงการนี้` : 'ตามโครงการ'}
                  </span>
                </div>

                {isCustomBatchTask ? (
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="พิมพ์ระบุชื่องานที่ปฏิบัติ..."
                      value={batchActivityName}
                      onChange={e => setBatchActivityName(e.target.value)}
                      className="flex-1 h-9 text-xs px-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 font-normal focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomBatchTask(false)
                        setBatchActivityName(tasksForBatchActivity[0] || '')
                      }}
                      className="h-9 px-2.5 rounded-lg border border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium shrink-0"
                    >
                      เลือกจากรายการ
                    </button>
                  </div>
                ) : (
                  <div className="relative flex items-center">
                    <select
                      value={
                        tasksForBatchActivity.includes(batchActivityName)
                          ? batchActivityName
                          : batchActivityName
                          ? '__custom_val__'
                          : ''
                      }
                      onChange={e => {
                        const val = e.target.value
                        if (val === '__custom__') {
                          setIsCustomBatchTask(true)
                          setBatchActivityName('')
                        } else if (val === '__custom_val__') {
                          // keep
                        } else {
                          setBatchActivityName(val)
                        }
                      }}
                      className="w-full h-9 text-xs pl-2.5 pr-8 rounded-lg border border-slate-300 bg-white text-slate-900 font-normal appearance-none truncate focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="">-- เลือกงานที่ปฏิบัติในโครงการนี้ --</option>
                      {tasksForBatchActivity.map(t => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                      {batchActivityName && !tasksForBatchActivity.includes(batchActivityName) && (
                        <option value="__custom_val__">{batchActivityName} (ระบุเอง)</option>
                      )}
                      <option value="__custom__">+ พิมพ์ระบุงานเอง...</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-500 absolute right-2.5 pointer-events-none" />
                  </div>
                )}
              </div>

              {/* 4. Location */}
              <div>
                <label className="text-xs text-slate-700 font-semibold mb-1 block flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-blue-600" />
                  <span>สถานที่ปฏิบัติงาน</span>
                </label>
                <input
                  type="text"
                  value={batchLocation}
                  onChange={e => setBatchLocation(e.target.value)}
                  placeholder="ระบุสถานที่ทำงาน..."
                  className="w-full h-9 text-xs px-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 font-normal focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* 5. Supervisor & Times */}
              <div>
                <label className="text-xs text-slate-700 font-semibold mb-1 block flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-blue-600" />
                  <span>ผู้ตรวจ / หัวหน้า</span>
                </label>
                <input
                  type="text"
                  value={batchSupervisor}
                  onChange={e => setBatchSupervisor(e.target.value)}
                  placeholder="ชื่อผู้ตรวจ..."
                  className="w-full h-9 text-xs px-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 font-normal focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* 6. PPE & Alcohol */}
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>อุปกรณ์ความปลอดภัย (PPE)</span>
                  </label>
                  <span className="text-[11px] text-emerald-700 font-semibold">แอลกอฮอล์: 0% ผ่าน</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {activePpeItems.map(item => {
                    const isChecked = !!batchPpeValues[item.id]
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          const next = !isChecked
                          setBatchPpeValues(prev => ({ ...prev, [item.id]: next }))
                          if (item.id === 'helmet') setBatchHelmet(next)
                          if (item.id === 'vest') setBatchVest(next)
                          if (item.id === 'glasses' || item.id === 'shirt') setBatchShirt(next)
                          if (item.id === 'gloves') setBatchGloves(next)
                          if (item.id === 'shoes') setBatchShoes(next)
                        }}
                        className={`h-8 px-2.5 rounded-lg text-xs font-medium border flex items-center justify-center gap-1 transition-all active:scale-95 ${
                          isChecked ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs' : 'bg-white text-slate-600 border-slate-300'
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        <span>{item.icon} {item.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-white border-t border-slate-200 shrink-0 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setIsBatchModalOpen(false)}
                className="h-10 rounded-xl border border-slate-300 text-slate-700 bg-slate-50 hover:bg-slate-100 text-xs font-semibold"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isSavingBatch || selectedMemberIds.length === 0}
                onClick={handleConfirmBatchPass}
                className="h-10 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50"
              >
                {isSavingBatch ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>กำลังบันทึก...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-white" />
                    <span>ยืนยันตรวจผ่าน {selectedMemberIds.length} คน</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          PPE SETTINGS MODAL (ตั้งค่ารายการเช็คลิสต์ เพิ่ม/ลด/แก้ไข/จัดลำดับ)
      ────────────────────────────────────────────────────────────────────────── */}
      <PpeSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        onSaved={items => {
          setPpeConfigItems(items)
          toast.success('อัปเดตรายการเช็คลิสต์เรียบร้อย')
        }}
      />

    </div>
  )
}
