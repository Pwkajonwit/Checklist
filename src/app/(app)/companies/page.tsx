'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { format } from 'date-fns'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, Search, Building2, Loader2, RefreshCw } from 'lucide-react'

interface CompanyData {
  id: string
  name: string
  code: string | null
  created_at: string
}

export default function CompaniesPage() {
  const supabase = useMemo(() => createClient(), [])
  const [companies, setCompanies] = useState<CompanyData[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formCode, setFormCode] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('companies').select('*').order('name')
    if (error) {
      toast.error('โหลดข้อมูลบริษัทไม่สำเร็จ')
    } else {
      setCompanies(data ?? [])
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const filtered = useMemo(() => {
    if (!search.trim()) return companies
    const q = search.toLowerCase()
    return companies.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.code ?? '').toLowerCase().includes(q)
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
      toast.error('กรุณากรอกชื่อบริษัท')
      return
    }
    setSaving(true)
    const payload = {
      name: formName.trim(),
      code: formCode.trim() ? formCode.trim().toUpperCase() : null
    }

    let error
    if (editId) {
      ;({ error } = await supabase.from('companies').update(payload).eq('id', editId))
    } else {
      ;({ error } = await supabase.from('companies').insert(payload))
    }

    if (error) {
      toast.error('บันทึกไม่สำเร็จ', { description: error.message })
    } else {
      toast.success(editId ? 'แก้ไขข้อมูลบริษัทแล้ว' : 'เพิ่มบริษัทเรียบร้อยแล้ว')
      setDialogOpen(false)
      fetchData()
    }
    setSaving(false)
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`ต้องการลบบริษัท "${name}" ใช่หรือไม่?`)) return
    const { error } = await supabase.from('companies').delete().eq('id', id)
    if (error) {
      toast.error('ลบไม่สำเร็จ (อาจมีผู้รับเหมาผูกอยู่)')
    } else {
      toast.success(`ลบ ${name} แล้ว`)
      fetchData()
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full gap-2 overflow-hidden">

      {/* ── Compact Top Controls Bar ── */}
      <div className="p-2 bg-white rounded-lg border border-slate-300 shadow-2xs flex flex-wrap items-center justify-between gap-2 shrink-0">
        
        {/* Left: Title & Count */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 text-slate-800 text-xs font-bold">
            <Building2 className="w-3.5 h-3.5 text-blue-600" />
            <span>จัดการสังกัด / บริษัท</span>
          </div>
          <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
            {companies.length} บริษัท
          </span>
        </div>

        {/* Right: Search + Refresh + Add */}
        <div className="flex items-center gap-1.5 ml-auto">
          <div className="relative w-48 sm:w-60">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="search"
              placeholder="ค้นหาชื่อบริษัท, รหัสย่อ..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full text-xs pl-8 pr-2.5 py-1 rounded border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={fetchData}
            className="w-7 h-7 flex items-center justify-center rounded border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <Button
            onClick={openCreate}
            className="h-7 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1 shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ เพิ่มบริษัท</span>
          </Button>
        </div>
      </div>

      {/* ── Spreadsheet Grid Table ── */}
      <div className="border border-slate-300 rounded-lg overflow-hidden bg-white shadow-2xs flex-1 min-h-0 flex flex-col h-full">
        <div className="flex-1 overflow-auto min-h-0 scrollbar-thin">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-slate-100 z-10 select-none">
              <tr className="border-b border-slate-300 text-slate-700 text-[11px]">
                <th className="py-2 px-2 w-12 text-center font-bold border-r border-slate-300">#</th>
                <th className="py-2 px-2.5 w-28 font-bold border-r border-slate-300">รหัสย่อ (Code)</th>
                <th className="py-2 px-3 font-bold border-r border-slate-300 min-w-[200px]">ชื่อสังกัด / บริษัท</th>
                <th className="py-2 px-3 w-36 font-bold border-r border-slate-300">วันที่สร้าง</th>
                <th className="py-2 px-2 text-center w-20 font-bold">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2 text-xs font-medium">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                      <span>กำลังโหลดข้อมูลบริษัท...</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 text-xs">
                    ไม่พบข้อมูลบริษัท{search ? ` ที่ตรงกับ "${search}"` : ''}
                  </td>
                </tr>
              ) : (
                filtered.map((c, idx) => (
                  <tr
                    key={c.id}
                    className="border-b border-slate-200 hover:bg-slate-50 transition-colors"
                  >
                    {/* # */}
                    <td className="py-1.5 px-2 text-center text-slate-400 font-mono text-[11px] border-r border-slate-200">
                      {idx + 1}
                    </td>

                    {/* Code */}
                    <td className="py-1.5 px-2.5 font-mono text-[11px] font-bold text-blue-700 border-r border-slate-200">
                      {c.code || <span className="text-slate-300 font-normal">—</span>}
                    </td>

                    {/* Name */}
                    <td className="py-1.5 px-3 font-semibold text-slate-900 border-r border-slate-200">
                      {c.name}
                    </td>

                    {/* Created date */}
                    <td className="py-1.5 px-3 text-slate-500 font-mono text-[11px] border-r border-slate-200">
                      {c.created_at ? format(new Date(c.created_at), 'dd/MM/yyyy HH:mm') : '—'}
                    </td>

                    {/* Actions */}
                    <td className="py-1.5 px-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEdit(c)}
                          className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-slate-100 transition-colors"
                          title="แก้ไข"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(c.id, c.name)}
                          className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="ลบ"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info strip */}
        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
          <span>
            แสดง <strong className="text-slate-800">{filtered.length}</strong> จากทั้งหมด {companies.length} บริษัท
          </span>
          <span>ระบบจัดการ Master Data สังกัด</span>
        </div>
      </div>

      {/* ── Add / Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600" />
                {editId ? 'แก้ไขข้อมูลสังกัด / บริษัท' : 'เพิ่มสังกัด / บริษัทใหม่'}
              </DialogTitle>
            </DialogHeader>

            <div className="py-3 space-y-3">
              <div>
                <Label className="text-xs font-semibold text-slate-700 mb-1 block">
                  ชื่อบริษัท / แผนก <span className="text-red-500">*</span>
                </Label>
                <Input
                  required
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="เช่น ช.หลุยส์, บจก. รวมช่างไทย"
                  className="h-8 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700 mb-1 block">
                  รหัสย่อ (Code)
                </Label>
                <Input
                  value={formCode}
                  onChange={e => setFormCode(e.target.value)}
                  placeholder="เช่น CHL, RCT"
                  className="h-8 text-xs font-mono uppercase"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="h-7 text-xs"
              >
                ยกเลิก
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="h-7 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
                <span>บันทึก</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
