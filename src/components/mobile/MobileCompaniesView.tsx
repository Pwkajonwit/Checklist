'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import {
  Building2, Plus, Search, Pencil, Trash2,
  RefreshCw, Loader2, Calendar, Hash
} from 'lucide-react'

interface CompanyData {
  id: string
  name: string
  code: string | null
  created_at: string
}

export function MobileCompaniesView() {
  const supabase = useMemo(() => createClient(), [])
  const [companies, setCompanies] = useState<CompanyData[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')

  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formCode, setFormCode] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true)
    else setRefreshing(true)

    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('name')

      if (error) throw error
      setCompanies(data ?? [])
    } catch (err: unknown) {
      console.error('Fetch companies mobile error:', err)
      toast.error('โหลดข้อมูลสังกัดไม่สำเร็จ')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const filtered = useMemo(() => {
    if (!search.trim()) return companies
    const q = search.toLowerCase()
    return companies.filter(
      c => c.name.toLowerCase().includes(q) || (c.code ?? '').toLowerCase().includes(q)
    )
  }, [companies, search])

  const openCreate = () => {
    setEditId(null)
    setFormName('')
    setFormCode('')
    setDialogOpen(true)
  }

  const openEdit = (c: CompanyData) => {
    setEditId(c.id)
    setFormName(c.name)
    setFormCode(c.code ?? '')
    setDialogOpen(true)
  }

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!formName.trim()) {
      toast.error('กรุณาระบุชื่อสังกัด / บริษัท')
      return
    }

    setSaving(true)
    const payload = {
      name: formName.trim(),
      code: formCode.trim() ? formCode.trim().toUpperCase() : null,
    }

    try {
      let err
      if (editId) {
        ;({ error: err } = await supabase.from('companies').update(payload).eq('id', editId))
      } else {
        ;({ error: err } = await supabase.from('companies').insert(payload))
      }

      if (err) throw err

      toast.success(editId ? 'แก้ไขข้อมูลสังกัดเรียบร้อยแล้ว' : 'เพิ่มสังกัดใหม่เรียบร้อยแล้ว')
      setDialogOpen(false)
      fetchData(true)
    } catch (err: unknown) {
      console.error('Save company error:', err)
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'
      toast.error('บันทึกไม่สำเร็จ', { description: msg })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`ต้องการลบสังกัด "${name}" หรือไม่?`)) return
    try {
      const { error } = await supabase.from('companies').delete().eq('id', id)
      if (error) throw error
      toast.success(`ลบ ${name} แล้ว`)
      setCompanies(prev => prev.filter(c => c.id !== id))
    } catch {
      toast.error('ลบไม่สำเร็จ (อาจมีช่างผูกอยู่กับสังกัดนี้)')
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full bg-slate-100 overflow-hidden">
      {/* ── Mobile Header (Premium Dark Gradient) ── */}
      <header className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-white px-3.5 py-2.5 shrink-0 flex items-center justify-between border-b border-slate-800 shadow-md">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 border border-cyan-400/30 flex items-center justify-center text-white shadow-sm shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold tracking-tight text-white truncate leading-tight">
              จัดการแผนก / สังกัด
            </h1>
            <p className="text-xs text-slate-300 font-normal leading-tight mt-0.5">
              ทั้งหมด <span className="font-semibold text-white">{companies.length}</span> สังกัด
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
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing || loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
          <Button
            size="sm"
            onClick={openCreate}
            className="h-8 px-3 rounded-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold shadow-sm border border-cyan-400/30 gap-1 active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>เพิ่มสังกัด</span>
          </Button>
        </div>
      </header>

      {/* ── Search Bar (h-9) ── */}
      <div className="bg-white p-2.5 border-b border-slate-300 shadow-2xs shrink-0">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            type="search"
            placeholder="ค้นหาชื่อสังกัด, รหัสย่อ (เช่น CHL)..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-9 text-xs pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 font-normal focus:outline-none focus:ring-1 focus:ring-cyan-600 placeholder:text-slate-500"
          />
        </div>
      </div>

      {/* ── Companies Card List (mini-Compact Layout) ── */}
      <div className="flex-1 overflow-y-auto min-h-0 p-2 space-y-2">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-cyan-600" />
            <span className="text-xs font-normal">กำลังโหลดข้อมูลสังกัด...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-300 p-8 text-center flex flex-col items-center justify-center gap-2">
            <Building2 className="w-10 h-10 stroke-1 text-slate-400" />
            <p className="text-xs font-semibold text-slate-900">ไม่พบข้อมูลสังกัด</p>
            <Button
              size="sm"
              onClick={openCreate}
              className="h-8 text-xs bg-cyan-600 hover:bg-cyan-700 text-white font-bold"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> เพิ่มสังกัดแรก
            </Button>
          </div>
        ) : (
          filtered.map(c => (
            <div
              key={c.id}
              className="bg-white rounded-xl border border-slate-300 p-2.5 shadow-2xs space-y-2 hover:border-slate-400 transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-cyan-100 text-cyan-950 border border-cyan-300 flex items-center justify-center font-bold text-xs shrink-0">
                    {c.code || c.name.charAt(0) || <Building2 className="w-4 h-4" />}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h2 className="text-xs font-semibold text-slate-900 leading-tight">
                        {c.name}
                      </h2>
                      {c.code && (
                        <span className="px-2 py-0.5 rounded font-bold text-xs bg-cyan-50 text-cyan-800 border border-cyan-300">
                          [{c.code}]
                        </span>
                      )}
                    </div>

                    {c.created_at && (
                      <span className="text-xs text-slate-600 font-normal flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        สร้างเมื่อ {format(new Date(c.created_at), 'dd/MM/yyyy')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => openEdit(c)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:text-cyan-800 hover:bg-cyan-50 transition-colors"
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
            </div>
          ))
        )}
      </div>

      {/* ── Dialog Form for Add & Edit Company ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm p-4 bg-white rounded-2xl shadow-xl border border-slate-300">
          <form onSubmit={handleSave}>
            <DialogHeader className="pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-100 text-cyan-800 flex items-center justify-center font-bold">
                  <Building2 className="w-4 h-4" />
                </div>
                <DialogTitle className="text-sm font-bold text-slate-900">
                  {editId ? 'แก้ไขข้อมูลสังกัด' : 'เพิ่มสังกัด / บริษัทใหม่'}
                </DialogTitle>
              </div>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div>
                <Label className="text-xs font-semibold text-slate-800">
                  ชื่อสังกัด / บริษัท <span className="text-red-600">*</span>
                </Label>
                <Input
                  required
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="เช่น ช.หลุยส์, บริษัท พัฒนาช่าง"
                  className="h-9 text-xs mt-1 bg-white border-slate-300 text-slate-900 font-normal"
                  autoFocus
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-800 flex items-center gap-1">
                  <Hash className="w-3.5 h-3.5 text-cyan-700" />
                  รหัสย่อ (Code)
                </Label>
                <Input
                  value={formCode}
                  onChange={e => setFormCode(e.target.value)}
                  placeholder="เช่น CHL, CDR"
                  className="h-9 text-xs uppercase mt-1 bg-white border-slate-300 text-slate-900 font-normal"
                />
              </div>
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
                className="h-8 px-4 text-xs font-bold bg-cyan-600 hover:bg-cyan-700 text-white"
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
