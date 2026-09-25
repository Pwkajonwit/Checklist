'use client'

import { useState, useEffect } from 'react'
import { MobileChecklistM } from '@/components/checklist/MobileChecklistM'
import { MobileAuthSheet } from '@/components/mobile/MobileAuthSheet'
import { MobileBottomNav, type MobileTab } from '@/components/mobile/MobileBottomNav'
import { MobileHistoryView } from '@/components/mobile/MobileHistoryView'
import { MobileContractorsView } from '@/components/mobile/MobileContractorsView'
import { MobileCompaniesView } from '@/components/mobile/MobileCompaniesView'
import { MobileActivitiesView } from '@/components/mobile/MobileActivitiesView'

export default function MobileChecklistStandalonePage() {
  const [activeTab, setActiveTab] = useState<MobileTab>('checklist')
  const [checklistResetCount, setChecklistResetCount] = useState(0)
  const [authSheetOpen, setAuthSheetOpen] = useState(false)
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

  // Load mobile auth state from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sitecheck_mobile_user')
      if (saved) {
        setMobileUser(JSON.parse(saved))
      }
    } catch {}
  }, [])

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
