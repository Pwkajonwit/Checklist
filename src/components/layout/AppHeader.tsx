'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import {
  LayoutDashboard, ClipboardCheck, History, HardHat,
  UserCheck, Layers, Building2, LogOut, ShieldCheck,
  ChevronDown, CalendarDays, Database, Menu, X, Sparkles, Check, MessageSquare
} from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { UserRole } from '@/lib/types'

interface NavItem {
  label: string
  sublabel: string
  href: string
  icon: React.ElementType
  roles?: UserRole[]
  iconBg: string
  badge?: string
}

// เมนูหลัก
const mainNavItems: NavItem[] = [
  {
    label: 'Dashboard ภาพรวม',
    sublabel: 'สถิติและข้อมูลสรุปประจำวัน',
    href: '/dashboard',
    icon: LayoutDashboard,
    iconBg: 'bg-sky-50 text-sky-700 border border-sky-200',
  },
  {
    label: 'Checklist วันนี้',
    sublabel: 'บันทึกเข้า-ออก และตรวจ PPE',
    href: '/checklist',
    icon: ClipboardCheck,
    iconBg: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    badge: 'LIVE',
  },
  {
    label: 'ประวัติการตรวจ',
    sublabel: 'ค้นหาและดูรายงานย้อนหลัง',
    href: '/history',
    icon: History,
    iconBg: 'bg-amber-50 text-amber-700 border border-amber-200',
  },
]


// ข้อมูลระบบ (Master Data)
const masterNavItems: NavItem[] = [
  {
    label: 'ผู้รับเหมา / ช่างหน้างาน',
    sublabel: 'ข้อมูลช่างและคนงานในโครงการ',
    href: '/contractors',
    icon: HardHat,
    iconBg: 'bg-amber-50 text-amber-800 border border-amber-300',
  },
  {
    label: 'พนักงาน (ผู้ใช้งานระบบ)',
    sublabel: 'เจ้าหน้าที่, Supervisor, Admin',
    href: '/employees',
    icon: UserCheck,
    iconBg: 'bg-blue-50 text-blue-700 border border-blue-200',
  },
  {
    label: 'กิจกรรมและสถานที่',
    sublabel: 'รหัสกิจกรรมและพื้นที่โรงงาน',
    href: '/activities',
    icon: Layers,
    iconBg: 'bg-purple-50 text-purple-700 border border-purple-200',
  },
  {
    label: 'บริษัท / แผนก',
    sublabel: 'ผู้รับเหมาหลักและคู่ค้า',
    href: '/companies',
    icon: Building2,
    roles: ['admin'],
    iconBg: 'bg-teal-50 text-teal-700 border border-teal-200',
  },
]

const roleLabel: Record<UserRole, { label: string; badgeCls: string }> = {
  admin: { label: 'ผู้ดูแลระบบ', badgeCls: 'bg-purple-100 text-purple-900 border-purple-300' },
  supervisor: { label: 'หัวหน้างาน', badgeCls: 'bg-blue-100 text-blue-900 border-blue-300' },
  viewer: { label: 'ผู้ตรวจสอบ', badgeCls: 'bg-slate-200 text-slate-900 border-slate-400' },
}

export interface AppHeaderProps {
  role: UserRole
  initials?: string
  email?: string
  name?: string
}

export function AppHeader({ role, initials = '?', email = '', name = '' }: AppHeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    toast.success('ออกจากระบบแล้ว')
    router.push('/login')
    router.refresh()
  }

  const visibleMainItems = mainNavItems.filter(i => !i.roles || i.roles.includes(role))
  const visibleMasterItems = masterNavItems.filter(i => !i.roles || i.roles.includes(role))
  const isMasterActive = visibleMasterItems.some(i => pathname === i.href || pathname.startsWith(i.href + '/'))
  const activeMasterItem = visibleMasterItems.find(i => pathname === i.href || pathname.startsWith(i.href + '/'))

  const roleInfo = roleLabel[role] || roleLabel.viewer
  const todayText = format(new Date(), 'EEE, d MMM yyyy', { locale: th })

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-300 shadow-2xs select-none">
      <div className="flex items-center justify-between h-14 px-3 sm:px-4 gap-2">

        {/* ── Left: App Logo & Brand ── */}
        <div className="flex items-center gap-2.5 shrink-0">
          <Link href="/dashboard" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-blue-600 group-hover:bg-blue-700 text-white flex items-center justify-center shadow-xs transition-colors shrink-0">
              <ShieldCheck className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-slate-900 tracking-tight">SiteCheck</span>
                <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-blue-100 text-blue-900 border border-blue-300">
                  PRO
                </span>
              </div>
              <p className="text-[10px] font-normal text-slate-500 hidden xl:block leading-none mt-0.5">
                ระบบตรวจสอบเข้า-ออกโครงการ
              </p>
            </div>
          </Link>
        </div>

        {/* Vertical Divider */}
        <div className="hidden lg:block h-6 w-px bg-slate-300 mx-1 shrink-0" />

        {/* ── Center: Desktop Navigation Bar (Header Menu) ── */}
        <nav className="hidden md:flex items-center gap-1 flex-1 min-w-0 overflow-x-auto scrollbar-none py-1">
          {/* Main Items */}
          {visibleMainItems.map(item => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-all shrink-0 border cursor-pointer',
                  isActive
                    ? 'bg-blue-600 text-white border-blue-600 shadow-2xs font-medium'
                    : 'text-slate-700 hover:text-slate-950 hover:bg-slate-100 border-transparent hover:border-slate-200 font-normal'
                )}
              >
                <Icon className={cn('w-4 h-4 shrink-0', isActive ? 'text-white' : 'text-slate-500')} />
                <span>{item.label}</span>
                {item.badge && (
                  <span
                    className={cn(
                      'text-[9px] font-semibold px-1.5 py-0.2 rounded-full uppercase tracking-wider',
                      isActive
                        ? 'bg-white text-blue-700'
                        : 'bg-emerald-500 text-white'
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            )
          })}

          {/* Master Data Dropdown Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-all shrink-0 border cursor-pointer outline-none',
                isMasterActive
                  ? 'bg-blue-50 text-blue-900 border-blue-300 font-medium'
                  : 'text-slate-700 hover:text-slate-950 hover:bg-slate-100 border-transparent hover:border-slate-200 font-normal'
              )}
            >
              <Database className={cn('w-4 h-4 shrink-0', isMasterActive ? 'text-blue-700' : 'text-slate-500')} />
              <span>ข้อมูลระบบ (Master Data)</span>
              {isMasterActive && activeMasterItem && (
                <span className="hidden lg:inline text-[10px] font-medium px-1.5 py-0.2 rounded bg-blue-600 text-white">
                  {activeMasterItem.label.split(' ')[0]}
                </span>
              )}
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64 p-1.5 bg-white border border-slate-300 shadow-lg rounded-lg">
              <div className="px-2 py-1 text-[10px] font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5 text-blue-600" />
                <span>ข้อมูลระบบพื้นฐาน</span>
              </div>
              <DropdownMenuSeparator className="bg-slate-200" />
              {visibleMasterItems.map(item => {
                const Icon = item.icon
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')

                return (
                  <DropdownMenuItem
                    key={item.href}
                    onClick={() => router.push(item.href)}
                    className={cn(
                      'flex items-center gap-2.5 px-2 py-2 rounded-md transition-colors cursor-pointer',
                      isActive
                        ? 'bg-blue-50 text-blue-950 font-medium border border-blue-200'
                        : 'text-slate-800 hover:bg-slate-100 hover:text-slate-950 font-normal'
                    )}
                  >
                    <div className={cn('w-7 h-7 rounded flex items-center justify-center shrink-0', item.iconBg)}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-xs truncate leading-tight', isActive ? 'font-medium text-blue-950' : 'font-normal text-slate-900')}>
                        {item.label}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate leading-tight mt-0.5 font-normal">
                        {item.sublabel}
                      </p>
                    </div>
                    {isActive && <Check className="w-4 h-4 text-blue-700 shrink-0" />}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        {/* ── Right: Date & Profile Dropdown ── */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto">
          {/* Current Date Pill */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 border border-slate-300 text-xs text-slate-800 font-normal">
            <CalendarDays className="w-3.5 h-3.5 text-blue-700 shrink-0" />
            <span>{todayText}</span>
          </div>

          {/* User Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex items-center gap-2 p-1 sm:px-2 sm:py-1 rounded-lg border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 transition-all cursor-pointer outline-none shadow-2xs"
              title="บัญชีผู้ใช้งาน"
            >
              <div className="w-7 h-7 rounded-md bg-blue-700 text-white font-medium text-xs flex items-center justify-center shrink-0 shadow-2xs">
                {initials}
              </div>
              <div className="hidden sm:block text-left min-w-0 max-w-[130px]">
                <p className="text-xs font-normal text-slate-900 truncate leading-tight">
                  {name || email.split('@')[0]}
                </p>
                <p className="text-[10px] text-slate-500 truncate leading-tight font-normal">
                  {roleInfo.label}
                </p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block shrink-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-1.5 bg-white border border-slate-300 shadow-lg rounded-lg">
              <div className="px-2 py-2">
                <p className="text-xs font-medium text-slate-900 truncate">{name || 'ผู้ใช้งาน'}</p>
                <p className="text-[11px] text-slate-500 truncate font-normal">{email}</p>
                <div className="mt-1.5">
                  <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-normal border inline-block', roleInfo.badgeCls)}>
                    {roleInfo.label}
                  </span>
                </div>
              </div>
              <DropdownMenuSeparator className="bg-slate-200" />
              <DropdownMenuItem
                onClick={() => router.push('/checklist')}
                className="flex items-center gap-2 px-2 py-1.5 text-xs text-slate-800 hover:text-slate-950 cursor-pointer font-normal"
              >
                <ClipboardCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>ตรวจ Checklist ด่วน</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push('/dashboard')}
                className="flex items-center gap-2 px-2 py-1.5 text-xs text-slate-800 hover:text-slate-950 cursor-pointer font-normal"
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-slate-600" />
                <span>Dashboard ภาพรวม</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-slate-200" />
              <DropdownMenuItem
                onClick={handleLogout}
                className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-red-700 hover:text-red-900 hover:bg-red-50 rounded-md cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 text-red-600" />
                <span>ออกจากระบบ</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile Hamburger Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(prev => !prev)}
            className="md:hidden w-8 h-8 flex items-center justify-center rounded-md border border-slate-300 hover:bg-slate-100 text-slate-700"
            title="เปิด/ปิด เมนู"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ── Mobile Slide-down Menu ── */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-300 bg-white px-3 py-3 space-y-3 shadow-lg max-h-[calc(100vh-56px)] overflow-y-auto">
          {/* Main Items */}
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5 text-blue-600" />
              <span>เมนูหลัก</span>
            </div>
            <div className="space-y-1">
              {visibleMainItems.map(item => {
                const Icon = item.icon
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center justify-between px-3 py-2 rounded-md text-xs font-semibold border transition-colors',
                      isActive
                        ? 'bg-blue-600 text-white border-blue-600 font-bold'
                        : 'text-slate-800 hover:bg-slate-100 border-slate-200'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-emerald-500 text-white">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                )
              })}

              {/* LINE OA in Mobile Menu */}
              <Link
                href="/line-oa"
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'flex items-center justify-between px-3 py-2 rounded-md text-xs font-semibold border transition-colors',
                  pathname === '/line-oa'
                    ? 'bg-blue-600 text-white border-blue-600 font-bold'
                    : 'text-slate-800 hover:bg-slate-100 border-slate-200'
                )}
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-600" />
                  <span>แจ้งเตือน LINE OA</span>
                </div>
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                  สรุปรายวัน
                </span>
              </Link>
            </div>
          </div>


          {/* Master Data Items */}
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Database className="w-2.5 h-2.5 text-blue-600" />
              <span>ข้อมูลระบบ (Master Data)</span>
            </div>
            <div className="space-y-1">
              {visibleMasterItems.map(item => {
                const Icon = item.icon
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-semibold border transition-colors',
                      isActive
                        ? 'bg-blue-50 text-blue-950 border-blue-300 font-bold'
                        : 'text-slate-800 hover:bg-slate-100 border-slate-200'
                    )}
                  >
                    <div className={cn('w-6 h-6 rounded flex items-center justify-center shrink-0', item.iconBg)}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate leading-tight">{item.label}</p>
                      <p className="text-[10px] text-slate-500 truncate leading-tight">{item.sublabel}</p>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Logout in Mobile Menu */}
          <div className="pt-2 border-t border-slate-200">
            <button
              onClick={handleLogout}
              className="w-full py-2 px-3 rounded-md bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              <span>ออกจากระบบ</span>
            </button>
          </div>
        </div>
      )}
    </header>
  )
}
