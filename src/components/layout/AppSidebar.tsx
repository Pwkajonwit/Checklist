'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  LayoutDashboard, ClipboardCheck, History, HardHat,
  UserCheck, Layers, Building2, LogOut, ShieldCheck,
  ChevronRight, Sparkles, Smartphone, Sliders
} from 'lucide-react'
import type { UserRole } from '@/lib/types'

interface NavItem {
  label: string
  sublabel: string
  href: string
  icon: React.ElementType
  roles?: UserRole[]
  section: string
  iconBg: string
  badge?: string
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard ภาพรวม',
    sublabel: 'สถิติและข้อมูลสรุปประจำวัน',
    href: '/dashboard',
    icon: LayoutDashboard,
    section: 'เมนูหลัก',
    iconBg: 'bg-sky-50 text-sky-600 border border-sky-200/70',
  },
  {
    label: 'Checklist วันนี้',
    sublabel: 'บันทึกเข้า-ออก และตรวจ PPE',
    href: '/checklist',
    icon: ClipboardCheck,
    section: 'เมนูหลัก',
    iconBg: 'bg-emerald-50 text-emerald-600 border border-emerald-200/70',
    badge: 'LIVE',
  },
  {
    label: 'Checklist มือถือ (3 สเตป)',
    sublabel: 'โหมดตรวจเร็วแยกตามสังกัด',
    href: '/checklist-m',
    icon: Smartphone,
    section: 'เมนูหลัก',
    iconBg: 'bg-blue-50 text-blue-600 border border-blue-200/70',
    badge: 'MOBILE',
  },
  {
    label: 'ประวัติการตรวจ',
    sublabel: 'ค้นหาและดูรายงานย้อนหลัง',
    href: '/history',
    icon: History,
    section: 'เมนูหลัก',
    iconBg: 'bg-amber-50 text-amber-600 border border-amber-200/70',
  },
  {
    label: 'ผู้รับเหมา / ช่างหน้างาน',
    sublabel: 'ข้อมูลช่างและคนงานในโครงการ',
    href: '/contractors',
    icon: HardHat,
    section: 'ข้อมูลระบบ (Master Data)',
    iconBg: 'bg-amber-50 text-amber-700 border border-amber-200/70',
  },
  {
    label: 'พนักงาน (ผู้ใช้งานระบบ)',
    sublabel: 'เจ้าหน้าที่, Supervisor, Admin',
    href: '/employees',
    icon: UserCheck,
    section: 'ข้อมูลระบบ (Master Data)',
    iconBg: 'bg-blue-50 text-blue-600 border border-blue-200/70',
  },
  {
    label: 'กิจกรรมและสถานที่',
    sublabel: 'รหัสกิจกรรมและพื้นที่โรงงาน',
    href: '/activities',
    icon: Layers,
    section: 'ข้อมูลระบบ (Master Data)',
    iconBg: 'bg-purple-50 text-purple-600 border border-purple-200/70',
  },
  {
    label: 'บริษัท / แผนก',
    sublabel: 'ผู้รับเหมาหลักและคู่ค้า',
    href: '/companies',
    icon: Building2,
    roles: ['admin'],
    section: 'ข้อมูลระบบ (Master Data)',
    iconBg: 'bg-teal-50 text-teal-600 border border-teal-200/70',
  },
  {
    label: 'ตั้งค่าเช็คลิสต์ PPE',
    sublabel: 'กำหนด เพิ่ม/ลด รายการตรวจเช็ค',
    href: '/settings',
    icon: Sliders,
    section: 'ข้อมูลระบบ (Master Data)',
    iconBg: 'bg-emerald-50 text-emerald-600 border border-emerald-200/70',
  },
]

const roleLabel: Record<UserRole, { label: string; badgeCls: string }> = {
  admin: { label: 'ผู้ดูแลระบบ (Admin)', badgeCls: 'bg-purple-50 text-purple-700 border-purple-200' },
  supervisor: { label: 'หัวหน้างาน (Supervisor)', badgeCls: 'bg-blue-50 text-blue-700 border-blue-200' },
  viewer: { label: 'ผู้ตรวจสอบ (Viewer)', badgeCls: 'bg-slate-100 text-slate-700 border-slate-200' },
}

interface AppSidebarProps {
  role: UserRole
  initials?: string
  email?: string
  name?: string
}

export function AppSidebar({ role, initials = '?', email = '', name = '' }: AppSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    toast.success('ออกจากระบบแล้ว')
    router.push('/login')
    router.refresh()
  }

  const visibleItems = navItems.filter(i => !i.roles || i.roles.includes(role))
  const sections = [...new Set(visibleItems.map(i => i.section))]
  const roleInfo = roleLabel[role] || roleLabel.viewer

  return (
    <>
      {/* ── Desktop Sidebar (Light Theme Matching Content) ── */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 bg-white border-r border-slate-300 h-screen sticky top-0 z-40 select-none shadow-2xs">
        
        {/* Logo Brand Header */}
        <div className="h-14 px-4 flex items-center gap-2.5 border-b border-slate-200 bg-slate-50/70 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <ShieldCheck className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-extrabold text-slate-900 tracking-tight">SiteCheck</span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200">
                PRO
              </span>
            </div>
            <p className="text-[10px] font-medium text-slate-500 truncate">
              ระบบตรวจสอบเข้า-ออกโครงการ
            </p>
          </div>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4 scrollbar-thin">
          {sections.map(section => (
            <div key={section} className="space-y-1">
              <div className="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5 text-blue-500" />
                <span>{section}</span>
              </div>

              <div className="space-y-0.5">
                {visibleItems.filter(i => i.section === section).map(item => {
                  const Icon = item.icon
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'group flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-all relative border',
                        isActive
                          ? 'bg-blue-600 text-white font-semibold shadow-2xs border-blue-600'
                          : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100/80 border-transparent hover:border-slate-200/60'
                      )}
                    >
                      {/* Icon Box */}
                      <div
                        className={cn(
                          'w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-all text-xs',
                          isActive
                            ? 'bg-white/20 text-white'
                            : item.iconBg
                        )}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </div>

                      {/* Text info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className={cn(
                            'text-xs tracking-tight truncate',
                            isActive ? 'font-bold text-white' : 'font-semibold text-slate-800 group-hover:text-slate-900'
                          )}>
                            {item.label}
                          </p>
                          {item.badge && (
                            <span className={cn(
                              'text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider',
                              isActive
                                ? 'bg-white text-blue-700'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            )}>
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <p className={cn(
                          'text-[10px] truncate leading-tight mt-0.5',
                          isActive ? 'text-blue-100 font-normal' : 'text-slate-400 group-hover:text-slate-500'
                        )}>
                          {item.sublabel}
                        </p>
                      </div>

                      {/* Active Indicator Arrow */}
                      {isActive && (
                        <ChevronRight className="w-3.5 h-3.5 text-blue-200 shrink-0" />
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User Footer Profile */}
        <div className="p-2.5 border-t border-slate-200 bg-slate-50/70 shrink-0">
          <div className="p-2 rounded-lg bg-white border border-slate-200 shadow-2xs flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-blue-100 text-blue-700 border border-blue-200 flex items-center justify-center font-bold text-xs shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate">
                {name || email.split('@')[0]}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className={cn('text-[9px] px-1 py-0.2 rounded border font-semibold', roleInfo.badgeCls)}>
                  {roleInfo.label.split(' ')[0]}
                </span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors shrink-0 cursor-pointer"
              title="ออกจากระบบ"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Mobile Bottom Navigation Bar (Light Theme) ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200 md:hidden flex items-center justify-around px-2 py-1 shadow-lg">
        {visibleItems.slice(0, 5).map(item => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 py-1 px-2 rounded-lg transition-all text-[10px] font-medium min-w-12',
                isActive
                  ? 'text-blue-600 font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              )}
            >
              <div
                className={cn(
                  'w-7 h-7 rounded-md flex items-center justify-center transition-all',
                  isActive
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
              </div>
              <span className="text-[9px] truncate max-w-14 leading-tight">
                {item.label.split(' ')[0]}
              </span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
