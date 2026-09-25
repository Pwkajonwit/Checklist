'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { UserProfile, UserRole } from '@/lib/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Shield, ShieldCheck, Eye, Search, Plus, Pencil, Trash2,
  RefreshCw, Loader2, Phone, ChevronDown, CheckCircle2, XCircle, UserCog
} from 'lucide-react'

interface UserFormData {
  full_name: string
  email: string
  role: UserRole
  department: string
  phone: string
  is_active: boolean
}

const defaultForm: UserFormData = {
  full_name: '',
  email: '',
  role: 'supervisor',
  department: '',
  phone: '',
  is_active: true,
}

const ROLE_CONFIG: Record<UserRole, { label: string; desc: string; icon: React.ElementType; color: string; bg: string; border: string }> = {
  admin: {
    label: 'ผู้ดูแลระบบ (Admin)',
    desc: 'จัดการข้อมูลทั้งหมด สิทธิ์ผู้ใช้ และตั้งค่าระบบ',
    icon: Shield,
    color: 'text-purple-700',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
  },
  supervisor: {
    label: 'หัวหน้างาน / ผู้ตรวจ (Supervisor)',
    desc: 'ตรวจเช็คชื่อ บันทึกแอลกอฮอล์ และอนุมัติ Checklist',
    icon: ShieldCheck,
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
  },
  viewer: {
    label: 'ผู้ตรวจสอบ / ทั่วไป (Viewer)',
    desc: 'ดูรายงาน สถิติ และส่งออกข้อมูลได้เท่านั้น',
    icon: Eye,
    color: 'text-slate-700',
    bg: 'bg-slate-100',
    border: 'border-slate-200',
  },
}

export default function EmployeesPage() {
  const supabase = useMemo(() => createClient(), [])

  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all')

  // Modal State
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [formData, setFormData] = useState<UserFormData>(defaultForm)

  // Fetch Users
  const fetchData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true)
    else setLoading(true)

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setUsers((data as UserProfile[]) ?? [])
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลผู้ใช้งานได้'
      toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล', { description: message })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Filtered List
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        const nameMatch = (u.full_name ?? '').toLowerCase().includes(q)
        const emailMatch = (u.email ?? '').toLowerCase().includes(q)
        const deptMatch = (u.department ?? '').toLowerCase().includes(q)
        const phoneMatch = (u.phone ?? '').toLowerCase().includes(q)
        if (!nameMatch && !emailMatch && !deptMatch && !phoneMatch) return false
      }
      return true
    })
  }, [users, roleFilter, search])

  // Stats
  const stats = useMemo(() => {
    const total = users.length
    const admins = users.filter(u => u.role === 'admin').length
    const supervisors = users.filter(u => u.role === 'supervisor').length
    const viewers = users.filter(u => u.role === 'viewer').length
    const active = users.filter(u => u.is_active !== false).length
    return { total, admins, supervisors, viewers, active }
  }, [users])

  // Open Create Dialog
  const openCreate = () => {
    setEditId(null)
    setFormData(defaultForm)
    setDialogOpen(true)
  }

  // Open Edit Dialog
  const openEdit = (u: UserProfile) => {
    setEditId(u.id)
    setFormData({
      full_name: u.full_name ?? '',
      email: u.email ?? '',
      role: u.role,
      department: u.department ?? '',
      phone: u.phone ?? '',
      is_active: u.is_active !== false,
    })
    setDialogOpen(true)
  }

  // Save (Create or Update)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.full_name.trim()) {
      toast.error('กรุณาระบุชื่อ-นามสกุล')
      return
    }
    if (!formData.email.trim()) {
      toast.error('กรุณาระบุอีเมลผู้ใช้งาน')
      return
    }

    setSaving(true)
    const payload = {
      full_name: formData.full_name.trim(),
      email: formData.email.trim().toLowerCase(),
      role: formData.role,
      department: formData.department.trim() || null,
      phone: formData.phone.trim() || null,
      is_active: formData.is_active,
      updated_at: new Date().toISOString(),
    }

    try {
      if (editId) {
        const { error } = await supabase.from('user_profiles').update(payload).eq('id', editId)
        if (error) throw error
        toast.success('แก้ไขข้อมูลผู้ใช้งานสำเร็จ')
      } else {
        const { error } = await supabase.from('user_profiles').insert(payload)
        if (error) throw error
        toast.success('เพิ่มผู้ใช้งานระบบใหม่สำเร็จ')
      }
      setDialogOpen(false)
      fetchData(true)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึก'
      toast.error('บันทึกไม่สำเร็จ', { description: message })
    } finally {
      setSaving(false)
    }
  }

  // Delete User Profile
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`ต้องการลบผู้ใช้งาน "${name}" ออกจากระบบหรือไม่?\nการดำเนินการนี้ไม่สามารถยกเลิกได้`)) return

    try {
      const { error } = await supabase.from('user_profiles').delete().eq('id', id)
      if (error) throw error
      toast.success(`ลบ "${name}" เรียบร้อยแล้ว`)
      fetchData(true)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการลบ'
      toast.error('ลบไม่สำเร็จ', { description: message })
    }
  }

  // Toggle Active
  const handleToggleActive = async (u: UserProfile) => {
    const nextStatus = u.is_active === false ? true : false
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ is_active: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', u.id)

      if (error) throw error
      toast.success(nextStatus ? `เปิดใช้งาน "${u.full_name}" แล้ว` : `ปิดใช้งาน "${u.full_name}" แล้ว`)
      setUsers(prev => prev.map(item => (item.id === u.id ? { ...item, is_active: nextStatus } : item)))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'
      toast.error('เปลี่ยนสถานะไม่สำเร็จ', { description: message })
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full gap-2 overflow-hidden">
      {/* ── Compact Top Controls Bar ── */}
      <div className="p-2 bg-white rounded-lg border border-slate-300 shadow-2xs flex flex-wrap items-center justify-between gap-2 shrink-0">
        
        {/* Left: Title & Role Filter Tabs */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-blue-50 text-blue-800 text-xs font-bold border border-blue-200">
            <UserCog className="w-3.5 h-3.5 text-blue-600" />
            <span>จัดการพนักงาน (ผู้ใช้งาน)</span>
          </div>

          {/* Quick role tabs */}
          <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded border border-slate-200 text-xs">
            <button
              onClick={() => setRoleFilter('all')}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                roleFilter === 'all'
                  ? 'bg-white text-slate-800 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ทั้งหมด ({stats.total})
            </button>
            <button
              onClick={() => setRoleFilter('admin')}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all flex items-center gap-1 ${
                roleFilter === 'admin'
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : 'text-purple-700 hover:text-purple-900'
              }`}
            >
              <Shield className="w-3 h-3" />
              Admin ({stats.admins})
            </button>
            <button
              onClick={() => setRoleFilter('supervisor')}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all flex items-center gap-1 ${
                roleFilter === 'supervisor'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-blue-700 hover:text-blue-900'
              }`}
            >
              <ShieldCheck className="w-3 h-3" />
              Supervisor ({stats.supervisors})
            </button>
            <button
              onClick={() => setRoleFilter('viewer')}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all flex items-center gap-1 ${
                roleFilter === 'viewer'
                  ? 'bg-slate-700 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="w-3 h-3" />
              Viewer ({stats.viewers})
            </button>
          </div>
        </div>

        {/* Right: Search + Refresh + Add */}
        <div className="flex items-center gap-1.5 ml-auto flex-wrap">
          {/* Search box */}
          <div className="relative w-44 sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="search"
              placeholder="ค้นหาชื่อ, อีเมล, แผนก..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full text-xs pl-8 pr-2.5 py-1 rounded border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
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
            className="h-7 px-2.5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-2xs gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>เพิ่มผู้ใช้</span>
          </Button>
        </div>
      </div>

      {/* ── Table Container (Spreadsheet Grid) ── */}
      <div className="border border-slate-300 rounded-lg overflow-hidden bg-white shadow-2xs flex-1 min-h-0 flex flex-col h-full">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-xs">กำลังโหลดข้อมูลผู้ใช้งาน...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-400 p-4">
            <UserCog className="w-8 h-8 stroke-1 text-slate-300" />
            <span className="text-xs font-medium text-slate-500">
              {search || roleFilter !== 'all'
                ? 'ไม่พบข้อมูลที่ตรงกับเงื่อนไขการค้นหา'
                : 'ยังไม่มีข้อมูลผู้ใช้งานในระบบ'}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={openCreate}
              className="h-7 text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> เพิ่มผู้ใช้งานคนแรก
            </Button>
          </div>
        ) : (
          <div className="flex-1 overflow-auto min-h-0 scrollbar-thin">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-slate-100 z-10 select-none">
                <tr className="text-[11px] font-bold text-slate-700 border-b border-slate-300">
                  <th className="py-2 px-2.5 text-center w-12 border-r border-slate-300">#</th>
                  <th className="py-2 px-3 border-r border-slate-300">ชื่อ - นามสกุล</th>
                  <th className="py-2 px-3 border-r border-slate-300">อีเมล (Login)</th>
                  <th className="py-2 px-3 border-r border-slate-300">บทบาท / สิทธิ์</th>
                  <th className="py-2 px-3 border-r border-slate-300">แผนก / สังกัด</th>
                  <th className="py-2 px-3 border-r border-slate-300">เบอร์ติดต่อ</th>
                  <th className="py-2 px-2.5 text-center w-24 border-r border-slate-300">สถานะ</th>
                  <th className="py-2 px-2.5 text-center w-20">จัดการ</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-slate-200">
                {filteredUsers.map((u, idx) => {
                  const roleCfg = ROLE_CONFIG[u.role] || ROLE_CONFIG.viewer
                  const RoleIcon = roleCfg.icon
                  const isActive = u.is_active !== false

                  return (
                    <tr
                      key={u.id}
                      className={`hover:bg-blue-50/30 transition-colors ${
                        !isActive ? 'bg-slate-50/70 text-slate-400' : 'text-slate-800'
                      }`}
                    >
                      {/* Index */}
                      <td className="py-1.5 px-2.5 text-center text-[11px] text-slate-400 font-medium border-r border-slate-200">
                        {idx + 1}
                      </td>

                      {/* Full Name */}
                      <td className="py-1.5 px-3 font-semibold border-r border-slate-200">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-[11px] shrink-0 ${
                              !isActive
                                ? 'bg-slate-200 text-slate-500'
                                : u.role === 'admin'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {(u.full_name ?? '?').trim().charAt(0) || '?'}
                          </div>
                          <span className={isActive ? 'text-slate-900' : 'text-slate-500'}>
                            {u.full_name || 'ไม่ระบุชื่อ'}
                          </span>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-1.5 px-3 border-r border-slate-200 font-mono text-[11px] text-slate-600">
                        {u.email}
                      </td>

                      {/* Role Badge */}
                      <td className="py-1.5 px-3 border-r border-slate-200">
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold border ${roleCfg.bg} ${roleCfg.color} ${roleCfg.border}`}
                        >
                          <RoleIcon className="w-3 h-3" />
                          <span>{roleCfg.label.split(' ')[0]}</span>
                        </span>
                      </td>

                      {/* Department */}
                      <td className="py-1.5 px-3 border-r border-slate-200">
                        <span className="font-medium text-slate-700">
                          {u.department || '-'}
                        </span>
                      </td>

                      {/* Phone */}
                      <td className="py-1.5 px-3 border-r border-slate-200 font-mono text-[11px]">
                        {u.phone ? (
                          <a
                            href={`tel:${u.phone}`}
                            className="text-blue-600 hover:underline flex items-center gap-1"
                          >
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{u.phone}</span>
                          </a>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Status Toggle */}
                      <td className="py-1.5 px-2.5 text-center border-r border-slate-200">
                        <button
                          onClick={() => handleToggleActive(u)}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full cursor-pointer transition-colors ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-500 border border-slate-300 hover:bg-slate-200'
                          }`}
                          title="คลิกเพื่อสลับสถานะ"
                        >
                          {isActive ? 'ใช้งาน' : 'ระงับ'}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-1.5 px-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEdit(u)}
                            className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 text-slate-500 hover:text-blue-600 transition-colors"
                            title="แก้ไขข้อมูล"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(u.id, u.full_name || u.email || 'ผู้ใช้งาน')}
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
            แสดง <span className="font-semibold text-slate-700">{filteredUsers.length}</span> จากทั้งหมด{' '}
            <span className="font-semibold text-slate-700">{stats.total}</span> คน
            {roleFilter !== 'all' && ` (กรองสิทธิ์: ${roleFilter})`}
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              พร้อมใช้งาน {stats.active} คน
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
              ระงับ {stats.total - stats.active} คน
            </span>
          </div>
        </div>
      </div>

      {/* ── Dialog: Add & Edit User ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md p-5 bg-white rounded-xl shadow-xl border border-slate-200">
          <form onSubmit={handleSave}>
            <DialogHeader className="pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold shrink-0 bg-blue-100 text-blue-700">
                  <UserCog className="w-4 h-4" />
                </div>
                <div>
                  <DialogTitle className="text-sm font-bold text-slate-900">
                    {editId ? 'แก้ไขข้อมูลผู้ใช้งาน' : 'เพิ่มผู้ใช้งานระบบใหม่'}
                  </DialogTitle>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    กำหนดบัญชีล็อกอินและระดับสิทธิ์การเข้าถึงข้อมูล
                  </p>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-2.5 py-2 text-xs">
              {/* Full Name */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">ชื่อ - นามสกุล *</Label>
                <Input
                  value={formData.full_name}
                  onChange={e => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                  placeholder="เช่น นายสมศักดิ์ ปลอดภัย"
                  required
                  className="h-8 text-xs bg-white border-slate-300 font-medium text-slate-900"
                  autoFocus
                />
              </div>

              {/* Email */}
              <div className="space-y-1">
                <Label htmlFor="user_email" className="text-xs font-semibold text-slate-700">
                  อีเมล (Login Account) *
                </Label>
                <Input
                  id="user_email"
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="เช่น somsak@company.com"
                  required
                  className="h-8 text-xs bg-white border-slate-300 text-slate-900"
                />
              </div>

              {/* Role Selection */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">
                  สิทธิ์การใช้งาน (Role) *
                </Label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['admin', 'supervisor', 'viewer'] as const).map(r => {
                    const cfg = ROLE_CONFIG[r]
                    const Icon = cfg.icon
                    const isSelected = formData.role === r

                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, role: r }))}
                        className={`p-1.5 rounded-lg border text-left cursor-pointer transition-all flex flex-col items-center gap-1 ${
                          isSelected
                            ? 'border-2 border-blue-600 bg-blue-50 text-blue-900 font-bold shadow-2xs'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded flex items-center justify-center ${cfg.bg} ${cfg.color}`}>
                          <Icon className="w-3 h-3" />
                        </div>
                        <span className="text-[11px] leading-tight text-center">{cfg.label.split(' ')[0]}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Department */}
              <div className="space-y-1">
                <Label htmlFor="user_dept" className="text-xs font-semibold text-slate-700">
                  แผนก / สังกัด
                </Label>
                <Input
                  id="user_dept"
                  value={formData.department}
                  onChange={e => setFormData(prev => ({ ...prev, department: e.target.value }))}
                  placeholder="เช่น ฝ่ายความปลอดภัย (จป.), วิศวกรรม..."
                  className="h-8 text-xs bg-white border-slate-300 text-slate-900"
                />
              </div>

              {/* Phone */}
              <div className="space-y-1">
                <Label htmlFor="user_phone" className="text-xs font-semibold text-slate-700">
                  เบอร์โทรศัพท์ติดต่อ
                </Label>
                <Input
                  id="user_phone"
                  value={formData.phone}
                  onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="เช่น 089-123-4567"
                  className="h-8 text-xs bg-white border-slate-300 text-slate-900"
                  type="tel"
                />
              </div>

              {/* Active Toggle */}
              <label
                htmlFor="user_active"
                className="flex items-center justify-between p-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer transition-all"
              >
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="user_active"
                    checked={formData.is_active}
                    onCheckedChange={v => setFormData(prev => ({ ...prev, is_active: !!v }))}
                  />
                  <div>
                    <p className="text-xs font-semibold text-slate-800">เปิดสถานะพร้อมปฏิบัติงาน (Active)</p>
                    <p className="text-[10px] text-slate-400">สามารถเข้าสู่ระบบและบันทึกงานได้</p>
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
                type="submit"
                size="sm"
                disabled={saving}
                className="h-8 px-4 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-2xs"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> กำลังบันทึก...
                  </>
                ) : (
                  editId ? 'บันทึกการแก้ไข' : 'เพิ่มผู้ใช้งาน'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
