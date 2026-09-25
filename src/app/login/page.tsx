'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import Link from 'next/link'
import {
  ShieldCheck, HardHat, LogIn, Loader2, Eye, EyeOff,
  Smartphone, Mail, Lock, CheckCircle2, ArrowRight,
  Building2, Sparkles
} from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        toast.error('เข้าสู่ระบบไม่สำเร็จ', { description: error.message })
        setLoading(false)
        return
      }

      toast.success('เข้าสู่ระบบสำเร็จ ยินดีต้อนรับ')
      router.push('/checklist')
      router.refresh()
    } catch (err: any) {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full bg-slate-950 flex flex-col justify-between items-center p-4 relative overflow-hidden font-sans select-none">
      {/* ── Background Ambient Light & Subtle Pattern ── */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(37,99,235,0.25),rgba(0,0,0,0))] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      {/* Top Spacer */}
      <div className="w-full pt-4 flex justify-center z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-slate-300 text-xs backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>SiteCheck Enterprise System v2.0</span>
        </div>
      </div>

      {/* ── Center Login Card ── */}
      <div className="relative w-full max-w-[420px] my-auto z-10">
        <div className="bg-white rounded-2xl border border-slate-300 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden">
          
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 px-6 py-5 text-white border-b border-slate-800 text-center relative">
            <div className="w-12 h-12 rounded-xl bg-blue-600/30 border border-blue-400/40 text-blue-400 flex items-center justify-center mx-auto mb-2.5 shadow-inner">
              <ShieldCheck className="w-7 h-7 text-blue-400" />
            </div>

            <div className="flex items-center justify-center gap-1.5 mb-1">
              <h1 className="text-xl font-bold tracking-tight text-white">
                SiteCheck
              </h1>
              <span className="px-1.5 py-0.5 rounded bg-blue-600 text-white text-[10px] font-extrabold uppercase tracking-wider">
                PRO
              </span>
            </div>

            <p className="text-xs text-slate-300 font-normal">
              ระบบตรวจความปลอดภัยและการเข้างานไซต์ก่อสร้าง
            </p>
          </div>

          {/* Body Form */}
          <div className="p-6 space-y-4">
            <form onSubmit={handleLogin} className="space-y-3.5">
              
              {/* Email Input */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-800 flex items-center justify-between">
                  <span>อีเมลผู้ใช้งาน (Email)</span>
                  <span className="text-[11px] text-slate-600 font-normal">เจ้าหน้าที่ / Admin</span>
                </label>
                <div className="relative flex items-center">
                  <Mail className="w-4 h-4 absolute left-3 text-slate-500 pointer-events-none" />
                  <input
                    id="email"
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="w-full h-10 text-xs pl-9 pr-3 rounded-lg border border-slate-300 bg-white text-slate-950 font-normal focus:ring-2 focus:ring-blue-600 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-800">
                    รหัสผ่าน (Password)
                  </label>
                </div>
                <div className="relative flex items-center">
                  <Lock className="w-4 h-4 absolute left-3 text-slate-500 pointer-events-none" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="w-full h-10 text-xs pl-9 pr-10 rounded-lg border border-slate-300 bg-white text-slate-950 font-normal focus:ring-2 focus:ring-blue-600 focus:outline-none focus:border-blue-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 text-slate-500 hover:text-slate-800 transition-colors p-1"
                    title={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 text-slate-600" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-10 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-all disabled:opacity-50 mt-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>กำลังเข้าสู่ระบบ...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>เข้าสู่ระบบจัดการ (PC / Dashboard)</span>
                  </>
                )}
              </button>
            </form>

            {/* Separator / Divider */}
            <div className="relative flex items-center justify-center my-3">
              <div className="border-t border-slate-200 w-full" />
              <span className="bg-white px-2.5 text-[11px] font-semibold text-slate-600 uppercase">
                หรือ
              </span>
            </div>

            {/* Mobile Mode Direct Access Link Card */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-300 space-y-2 hover:border-emerald-500 transition-all">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-300">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-xs font-bold text-slate-900 truncate">
                    โหมดผู้ตรวจหน้างานบนมือถือ
                  </h2>
                  <p className="text-[11px] text-slate-600 font-normal truncate">
                    ตรวจด่วน 3 สเตป เข้าผ่าน LINE / เบอร์โทร
                  </p>
                </div>
              </div>

              <Link
                href="/checklist-m"
                className="w-full h-9 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-[0.99] text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-2xs transition-all"
              >
                <span>เปิดโหมดมือถือ (Mobile Checklist)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

          </div>

          {/* Card Footer */}
          <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-600">
            <span className="flex items-center gap-1 font-normal">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>ความปลอดภัยระดับองค์กร</span>
            </span>
            <span>MAN Checklist</span>
          </div>

        </div>
      </div>

      {/* Bottom Copyright Strip */}
      <div className="w-full pb-3 text-center z-10 text-[11px] text-slate-500 font-normal">
        © 2026 SiteCheck Management System • All rights reserved
      </div>
    </div>
  )
}
