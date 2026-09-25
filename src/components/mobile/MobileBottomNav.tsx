'use client'

import React from 'react'
import { ClipboardCheck, History, HardHat, Building2, Layers } from 'lucide-react'

export type MobileTab = 'checklist' | 'history' | 'contractors' | 'companies' | 'activities'

interface MobileBottomNavProps {
  activeTab: MobileTab
  onTabChange: (tab: MobileTab) => void
  disabled?: boolean
}

export function MobileBottomNav({
  activeTab,
  onTabChange,
  disabled = false,
}: MobileBottomNavProps) {
  const tabs = [
    {
      id: 'checklist' as MobileTab,
      label: 'เช็คลิสต์',
      icon: ClipboardCheck,
      activeClass: 'text-emerald-700 bg-emerald-50 font-bold',
      barColor: 'bg-emerald-600',
    },
    {
      id: 'history' as MobileTab,
      label: 'ประวัติ',
      icon: History,
      activeClass: 'text-blue-700 bg-blue-50 font-bold',
      barColor: 'bg-blue-600',
    },
    {
      id: 'contractors' as MobileTab,
      label: 'รับเหมา',
      icon: HardHat,
      activeClass: 'text-amber-700 bg-amber-50 font-bold',
      barColor: 'bg-amber-600',
    },
    {
      id: 'companies' as MobileTab,
      label: 'แผนก/สังกัด',
      icon: Building2,
      activeClass: 'text-cyan-700 bg-cyan-50 font-bold',
      barColor: 'bg-cyan-600',
    },
    {
      id: 'activities' as MobileTab,
      label: 'กิจกรรม',
      icon: Layers,
      activeClass: 'text-purple-700 bg-purple-50 font-bold',
      barColor: 'bg-purple-600',
    },
  ]

  return (
    <nav
      aria-label="แถบเมนูด้านล่างสำหรับมือถือ"
      className="shrink-0 bg-white border-t border-slate-300 shadow-[0_-2px_8px_rgba(0,0,0,0.08)] z-30 select-none pb-[env(safe-area-inset-bottom)]"
    >
      <div className="grid grid-cols-5 h-14 items-center px-1">
        {tabs.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id

          return (
            <button
              key={tab.id}
              type="button"
              disabled={disabled}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center justify-center py-1 px-0.5 rounded-lg transition-all h-[48px] relative ${
                isActive
                  ? `${tab.activeClass}`
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:scale-95 font-normal'
              } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
            >
              {/* Active top pill indicator */}
              {isActive && (
                <span
                  className={`absolute top-0 w-8 h-1 rounded-full ${tab.barColor}`}
                />
              )}

              <Icon
                className={`w-5 h-5 transition-transform ${
                  isActive ? 'scale-105' : 'text-slate-600'
                }`}
              />
              <span className="text-xs tracking-tight mt-0.5 truncate max-w-full leading-tight">
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
