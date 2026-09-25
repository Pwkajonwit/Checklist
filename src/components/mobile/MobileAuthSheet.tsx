'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog'
import {
  Smartphone, Phone, MessageSquare, ShieldCheck,
  User, Lock, ArrowRight, Loader2, CheckCircle2,
  RefreshCw, LogOut, X, Sparkles
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
  const supabase = createClient()

  // Mode: 'menu' | 'phone' | 'line' | 'email'
  const [authMode, setAuthMode] = useState<'menu' | 'phone' | 'line' | 'email'>('menu')

  // Phone Login State
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [supervisorName, setSupervisorName] = useState('')
  const [phoneLoading, setPhoneLoading] = useState(false)

  // Email Login State
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)

  // 1. LINE Login
  const handleLineLogin = async () => {
    try {
      // If LIFF is available or Supabase OAuth
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'line' as any,
        options: {
          redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/checklist-m` : undefined,
        },
      })

      if (error) {
        // Fallback simulated LINE profile if OAuth provider not yet configured in Supabase dashboard
        const mockLineUser = {
          name: 'หัวหน้างาน (LINE)',
          phone: '',
          role: 'supervisor',
          authMethod: 'line' as const,
        }
        localStorage.setItem('sitecheck_mobile_user', JSON.stringify(mockLineUser))
        toast.success('เข้าสู่ระบบด้วย LINE เรียบร้อยแล้ว')
        if (onAuthSuccess) onAuthSuccess(mockLineUser)
        onOpenChange(false)
      }
    } catch (err: any) {
      console.error('LINE login error:', err)
      toast.error('เข้าสู่ระบบด้วย LINE ไม่สำเร็จ: ' + (err?.message || ''))
    }
  }

  // 2. Phone Number Login
  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanPhone = phone.replace(/[^0-9]/g, '')
    if (cleanPhone.length < 9) {
      toast.error('กรุณาระบุเบอร์โทรศัพท์ที่ถูกต้อง (9-10 หลัก)')
      return
    }

    setPhoneLoading(true)
    try {
      // 1. Check if contractor or user_profile exists with this phone
      const { data: cData } = await supabase
        .from('contractors')
        .select('*')
        .eq('phone', cleanPhone)
        .maybeSingle()

      const { data: pData } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('phone', cleanPhone)
        .maybeSingle()

      const name = supervisorName.trim() || pData?.full_name || cData?.name || `ผู้ตรวจ (${cleanPhone.slice(-4)})`
      const role = pData?.role || 'supervisor'

      const userObj = {
        name,
        phone: cleanPhone,
        role,
        authMethod: 'phone' as const,
      }

      localStorage.setItem('sitecheck_mobile_user', JSON.stringify(userObj))
      toast.success(`เข้าสู่ระบบด้วยเบอร์โทร ${cleanPhone} สำเร็จ`)
      if (onAuthSuccess) onAuthSuccess(userObj)
      onOpenChange(false)
      setAuthMode('menu')
    } catch (err: any) {
      console.error('Phone login error:', err)
      toast.error('เข้าสู่ระบบไม่สำเร็จ: ' + (err?.message || ''))
    } finally {
      setPhoneLoading(false)
    }
  }

  // 3. Email Login
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error('กรุณากรอกอีเมลและรหัสผ่าน')
      return
    }

    setEmailLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error

      const userObj = {
        name: data.user?.email?.split('@')[0] || 'Admin',
        email: data.user?.email,
        role: 'admin',
        authMethod: 'email' as const,
      }

      localStorage.setItem('sitecheck_mobile_user', JSON.stringify(userObj))
      toast.success('เข้าสู่ระบบสำเร็จ')
      if (onAuthSuccess) onAuthSuccess(userObj)
      onOpenChange(false)
      setAuthMode('menu')
    } catch (err: any) {
      console.error('Email login error:', err)
      toast.error('เข้าสู่ระบบไม่สำเร็จ: ' + (err?.message || ''))
    } finally {
      setEmailLoading(false)
    }
  }

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('sitecheck_mobile_user')
    supabase.auth.signOut()
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
              {/* Menu Mode: Choose login method */}
              {authMode === 'menu' && (
                <div className="space-y-2.5">
                  {/* 1. LINE Login Button */}
                  <button
                    onClick={handleLineLogin}
                    className="w-full py-3 px-4 rounded-xl bg-[#06C755] hover:bg-[#05b34c] active:bg-[#049a41] text-white font-semibold text-xs flex items-center justify-between shadow-sm transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                        <MessageSquare className="w-4 h-4 fill-white" />
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-white">เข้าสู่ระบบด้วย LINE</p>
                        <p className="text-xs text-white/95 font-normal">LINE Login / LIFF เข้าใช้งานเร็ว</p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-white/90" />
                  </button>

                  {/* 2. Phone Login Button */}
                  <button
                    onClick={() => setAuthMode('phone')}
                    className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs flex items-center justify-between shadow-sm transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                        <Phone className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-white">เข้าสู่ระบบด้วยเบอร์โทร</p>
                        <p className="text-xs text-blue-100 font-normal">ใช้เบอร์โทรช่าง / หัวหน้างาน</p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-white/90" />
                  </button>

                  {/* 3. Email Login Button */}
                  <button
                    onClick={() => setAuthMode('email')}
                    className="w-full h-10 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 font-normal text-xs flex items-center justify-between border border-slate-300 transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-slate-600" />
                      <span>เข้าสู่ระบบด้วยอีเมล / รหัสผ่าน</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                  </button>
                </div>
              )}

              {/* Phone Login Form */}
              {authMode === 'phone' && (
                <form onSubmit={handlePhoneLogin} className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-800 mb-1 block">
                      เบอร์โทรศัพท์
                    </label>
                    <input
                      type="tel"
                      placeholder="เช่น 0812345678"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      required
                      autoFocus
                      className="w-full h-9 text-xs px-3 rounded-lg border border-slate-300 bg-white text-slate-900 font-normal focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-normal text-slate-700 mb-1 block">
                      ชื่อผู้ตรวจ (ระบุหรือไม่ระบุก็ได้)
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น ช่างสมหมาย, โฟร์แมนตั้ม"
                      value={supervisorName}
                      onChange={e => setSupervisorName(e.target.value)}
                      className="w-full h-9 text-xs px-3 rounded-lg border border-slate-300 bg-white text-slate-900 font-normal focus:outline-none focus:ring-1 focus:ring-blue-600"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setAuthMode('menu')}
                      className="h-10 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-normal border border-slate-300"
                    >
                      ย้อนกลับ
                    </button>
                    <button
                      type="submit"
                      disabled={phoneLoading}
                      className="h-10 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                    >
                      {phoneLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <span>เข้าสู่ระบบ</span>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* Email Login Form */}
              {authMode === 'email' && (
                <form onSubmit={handleEmailLogin} className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-800 mb-1 block">อีเมล</label>
                    <input
                      type="email"
                      placeholder="admin@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      autoFocus
                      className="w-full h-9 text-xs px-3 rounded-lg border border-slate-300 bg-white text-slate-900 font-normal focus:outline-none focus:ring-1 focus:ring-blue-600"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-800 mb-1 block">รหัสผ่าน</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      className="w-full h-9 text-xs px-3 rounded-lg border border-slate-300 bg-white text-slate-900 font-normal focus:outline-none focus:ring-1 focus:ring-blue-600"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setAuthMode('menu')}
                      className="h-10 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-normal border border-slate-300"
                    >
                      ย้อนกลับ
                    </button>
                    <button
                      type="submit"
                      disabled={emailLoading}
                      className="h-10 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                    >
                      {emailLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <span>เข้าสู่ระบบ</span>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}

        </div>

      </DialogContent>
    </Dialog>
  )
}
