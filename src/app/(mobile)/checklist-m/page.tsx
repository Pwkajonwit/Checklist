'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MobileChecklistM } from '@/components/checklist/MobileChecklistM'
import { MobileAuthSheet } from '@/components/mobile/MobileAuthSheet'
import { MobileBottomNav, type MobileTab } from '@/components/mobile/MobileBottomNav'
import { MobileHistoryView } from '@/components/mobile/MobileHistoryView'
import { MobileContractorsView } from '@/components/mobile/MobileContractorsView'
import { MobileCompaniesView } from '@/components/mobile/MobileCompaniesView'
import { MobileActivitiesView } from '@/components/mobile/MobileActivitiesView'
import { Loader2, Smartphone } from 'lucide-react'

export default function MobileChecklistStandalonePage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<MobileTab>('checklist')
  const [checklistResetCount, setChecklistResetCount] = useState(0)
  const [authSheetOpen, setAuthSheetOpen] = useState(false)
  const [authChecking, setAuthChecking] = useState(true)
  const [mobileUser, setMobileUser] = useState<{
    name?: string
    phone?: string
    role?: string
    email?: string
    authMethod?: 'line' | 'phone' | 'email' | 'guest'
  } | null>(null)

  // Handle Tab Change (Reset Checklist to Step 1 if 'checklist' tab clicked)
  const handleTabChange = (tab: MobileTab) => {
    if (tab === 'checklist') {
      setChecklistResetCount(c => c + 1)
    }
    setActiveTab(tab)
  }

  // ── Authentication & LIFF Auto-Login Verification ──
  useEffect(() => {
    let isCancelled = false

    const checkAuthAndLiff = async () => {
      // 1. ตรวจสอบว่ามี Session ปกติอยู่แล้วหรือไม่ (/api/auth/me)
      try {
        const meRes = await fetch('/api/auth/me', { cache: 'no-store' }).then(r => r.json()).catch(() => null)
        if (meRes?.success && meRes?.user && !isCancelled) {
          const u = meRes.user
          const userObj = {
            id: u.userId,
            name: u.full_name,
            phone: u.phone,
            role: u.role,
            email: u.email,
            authMethod: (u.lineUserId ? 'line' : 'phone') as 'line' | 'phone',
          }
          setMobileUser(userObj)
          localStorage.setItem('sitecheck_mobile_user', JSON.stringify(userObj))
          setAuthChecking(false)
          return
        }
      } catch (err) {
        console.warn('Auth check error:', err)
      }

      // 2. ถ้ายังไม่มี Session → ตรวจสอบการเปิดผ่าน LINE LIFF
      try {
        const configRes = await fetch('/api/auth/liff-config').then(r => r.json()).catch(() => null)
        const liffId = configRes?.liffId || process.env.NEXT_PUBLIC_LIFF_ID || ''

        if (liffId && typeof window !== 'undefined') {
          // โหลด LIFF SDK แบบไดนามิกถ้ายังไม่มี
          if (!window.liff) {
            await new Promise((resolve, reject) => {
              const s = document.createElement('script')
              s.src = 'https://static.line-scdn.net/liff/edge/2/sdk.js'
              s.onload = resolve
              s.onerror = reject
              document.head.appendChild(s)
            })
          }

          if (window.liff) {
            await window.liff.init({ liffId })

            if (window.liff.isInClient() || window.liff.isLoggedIn()) {
              const profile = await window.liff.getProfile()
              const loginRes = await fetch('/api/auth/line-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  lineUserId: profile.userId,
                  displayName: profile.displayName,
                  pictureUrl: profile.pictureUrl,
                }),
              }).then(r => r.json()).catch(() => null)

              // หากผูกบัญชีไว้แล้ว → Auto-Login ทันที
              if (loginRes?.ok && loginRes?.linked && loginRes?.user && !isCancelled) {
                const u = loginRes.user
                const userObj = {
                  id: u.userId,
                  name: u.full_name,
                  phone: u.phone,
                  role: u.role,
                  email: u.email,
                  authMethod: 'line' as const,
                }
                setMobileUser(userObj)
                localStorage.setItem('sitecheck_mobile_user', JSON.stringify(userObj))
                setAuthChecking(false)
                return
              }
            }
          }
        }
      } catch (liffErr) {
        console.warn('[LIFF Auto-Login Warning]', liffErr)
      }

      // 3. หากยังไม่เคยผูก หรือยังไม่ได้เข้าระบบ → เด้งไปหน้า Login พร้อมส่ง returnUrl กลับมา
      if (!isCancelled) {
        router.push('/login?returnUrl=/checklist-m')
      }
    }

    checkAuthAndLiff()

    return () => {
      isCancelled = true
    }
  }, [router])

  // ขณะกำลังตรวจสอบสิทธิ์หรือเชื่อมต่อ LIFF
  if (authChecking) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#07131F] text-white p-6 select-none">
        <div className="w-14 h-14 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center mb-4 shadow-lg shadow-blue-500/10 animate-pulse">
          <Smartphone className="w-7 h-7 text-blue-400" />
        </div>
        <div className="flex items-center gap-2 mb-2">
          <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
          <p className="text-sm font-semibold text-slate-100">กำลังเชื่อมต่อระบบ SiteCheck...</p>
        </div>
        <p className="text-xs text-slate-400 text-center max-w-[260px]">
          กำลังตรวจสอบบัญชีและสิทธิ์การเข้าใช้งาน
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 h-full max-h-full min-h-0 bg-slate-100 overflow-hidden select-none">
      {/* ── Active Tab View Container ── */}
      <main className="flex-1 flex flex-col min-h-0 h-full overflow-hidden relative">
        {/* 1. Checklist Tab (3-Step Flow: Frame 4 -> 5 -> 6) */}
        <div
          className={`flex-1 flex flex-col min-h-0 h-full overflow-hidden ${
            activeTab === 'checklist' ? 'flex' : 'hidden'
          }`}
        >
          <MobileChecklistM
            mobileUser={mobileUser}
            onOpenAuth={() => setAuthSheetOpen(true)}
            onNavigateToHistory={() => setActiveTab('history')}
            resetTrigger={checklistResetCount}
          />
        </div>

        {/* 2. History Tab (ประวัติการตรวจ) */}
        <div
          className={`flex-1 flex flex-col min-h-0 h-full overflow-hidden ${
            activeTab === 'history' ? 'flex' : 'hidden'
          }`}
        >
          <MobileHistoryView
            mobileUser={mobileUser}
            onOpenAuth={() => setAuthSheetOpen(true)}
          />
        </div>

        {/* 3. Contractors Tab (จัดการช่าง / รับเหมา) */}
        <div
          className={`flex-1 flex flex-col min-h-0 h-full overflow-hidden ${
            activeTab === 'contractors' ? 'flex' : 'hidden'
          }`}
        >
          <MobileContractorsView />
        </div>

        {/* 4. Companies Tab (แผนก / สังกัด) */}
        <div
          className={`flex-1 flex flex-col min-h-0 h-full overflow-hidden ${
            activeTab === 'companies' ? 'flex' : 'hidden'
          }`}
        >
          <MobileCompaniesView />
        </div>

        {/* 5. Activities Tab (กิจกรรมและระบบงาน) */}
        <div
          className={`flex-1 flex flex-col min-h-0 h-full overflow-hidden ${
            activeTab === 'activities' ? 'flex' : 'hidden'
          }`}
        >
          <MobileActivitiesView />
        </div>
      </main>

      {/* ── 5-Tab Mobile Bottom Navigation Bar (Sticky Footer) ── */}
      <MobileBottomNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />

      {/* ── Mobile Authentication Sheet (LINE, Phone, Email) ── */}
      <MobileAuthSheet
        open={authSheetOpen}
        onOpenChange={setAuthSheetOpen}
        userProfile={mobileUser}
        onAuthSuccess={profile => setMobileUser(profile)}
        onLogout={() => setMobileUser(null)}
      />
    </div>
  )
}
