'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog'
import {
  Smartphone, Phone,
  User, ArrowRight, Loader2, CheckCircle2,
  RefreshCw, LogOut, X
} from 'lucide-react'

interface MobileAuthSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userProfile?: {
    id?: string
    name?: string
    phone?: string
    role?: string
    email?: string
    authMethod?: 'line' | 'phone' | 'email' | 'guest'
  } | null
  onAuthSuccess?: (profile: any) => void
  onLogout?: () => void
}

export function MobileAuthSheet({
  open,
  onOpenChange,
  userProfile,
  onAuthSuccess,
  onLogout,
}: MobileAuthSheetProps) {
  // Mode: 'menu' | 'phone'
  const [authMode, setAuthMode] = useState<'menu' | 'phone'>('menu')

  // Phone Login State
  const [phone, setPhone] = useState('')
  const [supervisorName, setSupervisorName] = useState('')
  const [phoneLoading, setPhoneLoading] = useState(false)

  // Phone Number Login — via API
  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanPhone = phone.replace(/[^0-9]/g, '')
    if (cleanPhone.length < 9) {
      toast.error('กรุณาระบุเบอร์โทรศัพท์ที่ถูกต้อง (9-10 หลัก)')
      return
    }

    setPhoneLoading(true)
    try {
      const res = await fetch('/api/auth/phone-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone }),
      })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? 'เข้าสู่ระบบไม่สำเร็จ')
        return
      }

      const userObj = {
        id: data.user?.userId,
        name: supervisorName.trim() || data.user?.full_name || `ผู้ตรวจ (${cleanPhone.slice(-4)})`,
        phone: cleanPhone,
        role: data.user?.role || 'supervisor',
        authMethod: 'phone' as const,
      }

      localStorage.setItem('sitecheck_mobile_user', JSON.stringify(userObj))
      toast.success(`ยินดีต้อนรับ ${userObj.name} 👋`)
      if (onAuthSuccess) onAuthSuccess(userObj)
      onOpenChange(false)
      setAuthMode('menu')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      toast.error('เข้าสู่ระบบไม่สำเร็จ: ' + msg)
    } finally {
      setPhoneLoading(false)
    }
  }

  // Logout
  const handleLogout = async () => {
    localStorage.removeItem('sitecheck_mobile_user')
    await fetch('/api/auth/logout', { method: 'POST' })
    toast.info('ออกจากระบบแล้ว')
    if (onLogout) onLogout()
    onOpenChange(false)
    setAuthMode('menu')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[360px] p-0 overflow-hidden rounded-2xl bg-white border border-slate-300">
        
        {/* Header */}
        <div className="bg-[#0B2742] text-white p-4 text-center relative">
          <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-2 border border-white/20">
            <Smartphone className="w-6 h-6 text-emerald-400" />
          </div>
          <DialogTitle className="text-base font-bold text-white">
            {userProfile?.name ? 'ข้อมูลผู้ใช้งาน' : 'เข้าสู่ระบบ SiteCheck'}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-300 mt-0.5">
            {userProfile?.name
              ? `เข้าใช้งานด้วย: ${userProfile.authMethod === 'line' ? 'LINE' : userProfile.phone ? `เบอร์ ${userProfile.phone}` : 'อีเมล'}`
              : 'เลือกวิธีเข้าสู่ระบบเพื่อบันทึก Checklist'}
          </DialogDescription>
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-3">
          
          {/* If already logged in */}
          {userProfile?.name ? (
            <div className="space-y-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">ชื่อผู้ตรวจ:</span>
                  <span className="text-xs font-bold text-slate-900">{userProfile.name}</span>
                </div>
                {userProfile.phone && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-700 font-normal">เบอร์โทรศัพท์:</span>
                    <span className="text-xs font-semibold text-slate-900">{userProfile.phone}</span>
                  </div>
                )}
                {userProfile.role && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-700 font-normal">สิทธิ์การใช้งาน:</span>
                    <span className="text-xs font-semibold px-2 py-0.5 bg-emerald-100 text-emerald-950 rounded border border-emerald-300">
                      {userProfile.role}
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onOpenChange(false)}
                  className="h-10 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-all text-center border border-slate-300"
                >
                  ปิดหน้าต่าง
                </button>
                <button
                  onClick={handleLogout}
                  className="h-10 px-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>ออกจากระบบ</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Phone Login Form (direct — no menu) */}
              <form onSubmit={handlePhoneLogin} className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-800 mb-1 block">
                    เบอร์โทรศัพท์ (ใช้ Login ได้เลย)
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    placeholder="เช่น 081-234-5678"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    required
                    autoFocus
                    className="w-full h-9 text-sm px-3 rounded-lg border border-slate-300 bg-white text-slate-900 font-mono tracking-widest focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-normal text-slate-700 mb-1 block">
                    ชื่อผู้ตรวจ <span className="text-slate-400">(ระบุหรือไม่ระบุก็ได้)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น ช่างสมหมาย, โฟร์แมนตั้ม"
                    value={supervisorName}
                    onChange={e => setSupervisorName(e.target.value)}
                    className="w-full h-9 text-xs px-3 rounded-lg border border-slate-300 bg-white text-slate-900 font-normal focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                <button
                  type="submit"
                  disabled={phoneLoading}
                  className="w-full h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {phoneLoading ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> กำลังตรวจสอบ...</>
                  ) : (
                    <><ArrowRight className="w-3.5 h-3.5" /> เข้าสู่ระบบ</>
                  )}
                </button>
              </form>
            </>
          )}

        </div>

      </DialogContent>
    </Dialog>
  )
}
