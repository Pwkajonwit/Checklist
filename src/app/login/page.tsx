'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import Script from 'next/script'
import {
  ShieldCheck, Phone, Loader2, LogIn,
  Smartphone, ArrowRight, CheckCircle2,
  Link2, ChevronRight, AlertCircle,
} from 'lucide-react'

declare global {
  interface Window {
    liff: {
      init: (config: { liffId: string }) => Promise<void>
      isInClient: () => boolean
      isLoggedIn: () => boolean
      login: () => void
      getProfile: () => Promise<{ userId: string; displayName: string; pictureUrl?: string }>
      ready: Promise<void>
    }
  }
}

const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID ?? ''

type LoginStep = 'init' | 'phone' | 'line-link' | 'loading'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep] = useState<LoginStep>('init')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [liffReady, setLiffReady] = useState(false)
  const [liffLoading, setLiffLoading] = useState(false)

  // สำหรับขั้นตอนผูก LINE
  const [pendingLine, setPendingLine] = useState<{
    lineUserId: string
    displayName: string
    pictureUrl?: string
  } | null>(null)

  const phoneRef = useRef<HTMLInputElement>(null)
  const inactiveReason = searchParams.get('reason') === 'inactive'

  // ── Auto LIFF Login ──
  useEffect(() => {
    if (!LIFF_ID) return
    // โหลด LIFF SDK แล้ว init
    const tryLiff = async () => {
      if (!window.liff) return
      setLiffLoading(true)
      try {
        await window.liff.init({ liffId: LIFF_ID })
        setLiffReady(true)

        if (window.liff.isInClient()) {
          // เปิดใน LINE App → auto login
          const profile = await window.liff.getProfile()
          await handleLineLogin(profile.userId, profile.displayName, profile.pictureUrl)
        }
      } catch (err) {
        console.warn('[LIFF init]', err)
      } finally {
        setLiffLoading(false)
      }
    }
    tryLiff()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liffReady])

  const handleLiffScriptLoad = () => {
    setLiffReady(true)
  }

  // ── LINE Login (จาก browser ปกติ คลิกปุ่ม) ──
  const handleLineButtonClick = async () => {
    if (!LIFF_ID) {
      toast.error('ยังไม่ได้ตั้งค่า LIFF ID')
      return
    }
    setLiffLoading(true)
    try {
      await window.liff.init({ liffId: LIFF_ID })
      if (!window.liff.isLoggedIn()) {
        window.liff.login()
        return
      }
      const profile = await window.liff.getProfile()
      await handleLineLogin(profile.userId, profile.displayName, profile.pictureUrl)
    } catch (err) {
      console.error('[LINE login]', err)
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ LINE')
    } finally {
      setLiffLoading(false)
    }
  }

  // ── เรียก API /api/auth/line-login ──
  const handleLineLogin = async (lineUserId: string, displayName: string, pictureUrl?: string) => {
    setStep('loading')
    const res = await fetch('/api/auth/line-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lineUserId, displayName, pictureUrl }),
    })
    const data = await res.json()

    if (res.ok && data.linked) {
      // ผูกแล้ว → เข้าระบบ
      toast.success(`ยินดีต้อนรับ ${data.user?.full_name ?? displayName} 👋`)
      router.push('/checklist')
      router.refresh()
    } else if (res.ok && !data.linked) {
      // ยังไม่ผูก → ขอเบอร์โทร
      setPendingLine({ lineUserId, displayName, pictureUrl })
      setStep('line-link')
      setTimeout(() => phoneRef.current?.focus(), 100)
    } else {
      toast.error(data.error ?? 'เกิดข้อผิดพลาด')
      setStep('phone')
    }
  }

  // ── Login ด้วยเบอร์โทร ──
  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phone.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/phone-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'เกิดข้อผิดพลาด')
        return
      }
      toast.success(`ยินดีต้อนรับ ${data.user?.full_name ?? ''} 👋`)
      router.push('/checklist')
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  // ── ผูก LINE กับเบอร์โทร ──
  const handleLineLink = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phone.trim() || !pendingLine) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/line-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone.trim(),
          lineUserId: pendingLine.lineUserId,
          displayName: pendingLine.displayName,
          pictureUrl: pendingLine.pictureUrl,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'เกิดข้อผิดพลาด')
        return
      }
      toast.success(`ผูก LINE สำเร็จ! ยินดีต้อนรับ ${data.user?.full_name ?? ''} 👋`)
      router.push('/checklist')
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {/* โหลด LIFF SDK */}
      {LIFF_ID && (
        <Script
          src="https://static.line-scdn.net/liff/edge/2/sdk.js"
          onLoad={handleLiffScriptLoad}
          strategy="afterInteractive"
        />
      )}

      <div className="min-h-screen w-full bg-slate-950 flex flex-col justify-between items-center p-4 relative overflow-hidden font-sans select-none">
        {/* Background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(37,99,235,0.25),rgba(0,0,0,0))] pointer-events-none" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

        {/* Top badge */}
        <div className="w-full pt-4 flex justify-center z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-slate-300 text-xs backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>SiteCheck Enterprise System v2.0</span>
          </div>
        </div>

        {/* ── Login Card ── */}
        <div className="relative w-full max-w-[400px] my-auto z-10">
          <div className="bg-white rounded-2xl border border-slate-300 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden">

            {/* Header */}
            <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 px-6 py-5 text-white border-b border-slate-800 text-center relative">
              <div className="w-12 h-12 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center mx-auto mb-2.5">
                <ShieldCheck className="w-7 h-7 text-blue-400" />
              </div>
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <h1 className="text-xl font-bold tracking-tight text-white">SiteCheck</h1>
                <span className="px-1.5 py-0.5 rounded bg-blue-600 text-white text-[10px] font-extrabold uppercase tracking-wider">PRO</span>
              </div>
              <p className="text-xs text-slate-300">ระบบตรวจความปลอดภัยและการเข้างานไซต์ก่อสร้าง</p>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">

              {/* Inactive Warning */}
              {inactiveReason && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>บัญชีถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ</span>
                </div>
              )}

              {/* ── Loading State ── */}
              {step === 'loading' && (
                <div className="flex flex-col items-center gap-3 py-6 text-slate-600">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                  <p className="text-sm font-medium">กำลังตรวจสอบ LINE Account...</p>
                </div>
              )}

              {/* ── LINE Link Step ── */}
              {step === 'line-link' && pendingLine && (
                <div className="space-y-4">
                  {/* LINE Profile */}
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 border border-green-200">
                    {pendingLine.pictureUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={pendingLine.pictureUrl}
                        alt="LINE"
                        className="w-10 h-10 rounded-full border border-green-300"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-green-200 flex items-center justify-center text-green-800 font-bold">
                        {pendingLine.displayName.charAt(0)}
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-bold text-green-900">{pendingLine.displayName}</p>
                      <p className="text-[11px] text-green-700">LINE Account • ยังไม่ได้ผูกเบอร์โทร</p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 text-center">
                    ครั้งแรกที่เข้าระบบผ่าน LINE — กรุณายืนยันด้วย<br />
                    <span className="font-bold text-slate-900">เบอร์โทรที่ลงทะเบียนไว้กับผู้ดูแล</span>
                  </p>

                  <form onSubmit={handleLineLink} className="space-y-3">
                    <div className="relative">
                      <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                      <input
                        ref={phoneRef}
                        type="tel"
                        inputMode="numeric"
                        placeholder="เช่น 081-234-5678"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        required
                        className="w-full h-11 text-sm pl-9 pr-3 rounded-lg border border-slate-300 bg-white text-slate-950 font-medium focus:ring-2 focus:ring-green-500 focus:outline-none focus:border-green-500 tracking-widest"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={submitting || !phone.trim()}
                      className="w-full h-11 rounded-lg bg-green-600 hover:bg-green-700 active:bg-green-800 text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
                    >
                      {submitting ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> กำลังผูกบัญชี...</>
                      ) : (
                        <><Link2 className="w-4 h-4" /> ผูก LINE กับเบอร์โทรนี้</>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setStep('phone'); setPendingLine(null) }}
                      className="w-full text-xs text-slate-500 hover:text-slate-700 transition-colors"
                    >
                      ← ย้อนกลับ
                    </button>
                  </form>
                </div>
              )}

              {/* ── Normal Login (Phone + LINE button) ── */}
              {(step === 'init' || step === 'phone') && (
                <div className="space-y-4">

                  {/* ── Phone Login ── */}
                  <div>
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-2">
                      <Phone className="w-3.5 h-3.5 text-slate-500" />
                      เข้าสู่ระบบด้วยเบอร์โทรศัพท์
                    </label>
                    <form onSubmit={handlePhoneLogin} className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          ref={step === 'phone' ? phoneRef : undefined}
                          type="tel"
                          inputMode="numeric"
                          placeholder="เช่น 081-234-5678"
                          value={phone}
                          onChange={e => setPhone(e.target.value)}
                          onFocus={() => setStep('phone')}
                          required
                          className="w-full h-10 text-sm pl-4 pr-3 rounded-lg border border-slate-300 bg-white text-slate-950 font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none focus:border-blue-600 tracking-widest"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={submitting || !phone.trim()}
                        className="h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50 shrink-0"
                      >
                        {submitting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <><LogIn className="w-4 h-4" /><span className="hidden sm:inline">เข้าระบบ</span></>
                        )}
                      </button>
                    </form>
                    <p className="text-[11px] text-slate-500 mt-1.5">
                      ใช้เบอร์โทรที่ผู้ดูแลระบบลงทะเบียนให้ ไม่ต้องใช้รหัสผ่าน
                    </p>
                  </div>

                  {/* Divider */}
                  {LIFF_ID && (
                    <>
                      <div className="relative flex items-center justify-center my-1">
                        <div className="border-t border-slate-200 w-full" />
                        <span className="bg-white px-2.5 text-[11px] font-semibold text-slate-400 uppercase absolute">หรือ</span>
                      </div>

                      {/* LINE Login Button */}
                      <button
                        onClick={handleLineButtonClick}
                        disabled={liffLoading || submitting}
                        className="w-full h-11 rounded-lg bg-[#06C755] hover:bg-[#05b44c] active:bg-[#04a344] text-white text-sm font-bold flex items-center justify-center gap-2.5 shadow-sm transition-all disabled:opacity-60"
                      >
                        {liffLoading ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> กำลังเชื่อมต่อ LINE...</>
                        ) : (
                          <>
                            {/* LINE icon */}
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="white">
                              <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                            </svg>
                            เข้าสู่ระบบด้วย LINE
                          </>
                        )}
                      </button>
                    </>
                  )}

                  {/* Mobile Mode Link */}
                  <div className="pt-1">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-emerald-400 transition-all">
                      <div className="flex items-center gap-2 mb-2">
                        <Smartphone className="w-4 h-4 text-emerald-600" />
                        <span className="text-xs font-bold text-slate-800">โหมดผู้ตรวจหน้างาน (Mobile)</span>
                      </div>
                      <a
                        href="/checklist-m"
                        className="w-full h-9 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-all"
                      >
                        เปิดโหมดมือถือ (Mobile Checklist)
                        <ArrowRight className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>

                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                ไม่ต้องใช้รหัสผ่าน
              </span>
              <span>MAN Checklist</span>
            </div>
          </div>
        </div>

        {/* Bottom copyright */}
        <div className="w-full pb-3 text-center z-10 text-[11px] text-slate-500">
          © 2026 SiteCheck Management System • All rights reserved
        </div>
      </div>
    </>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen w-full bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}

