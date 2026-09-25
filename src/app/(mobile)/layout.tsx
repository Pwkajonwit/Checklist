import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'SiteCheck Mobile | ตรวจ Checklist ด่วน',
  description: 'ระบบตรวจความปลอดภัยและการเข้างานไซต์ก่อสร้างผ่านมือถือ (3 สเตป)',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function MobileLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="h-[100dvh] max-h-[100dvh] bg-slate-900 flex justify-center items-center overflow-hidden sm:p-3">
      {/* Mobile Shell Wrapper with Safe Area Support */}
      <div className="w-full max-w-md h-full max-h-full sm:h-[92vh] sm:max-h-[880px] bg-slate-100 flex flex-col shadow-2xl sm:rounded-2xl overflow-hidden relative border-x sm:border border-slate-300">
        {children}
      </div>
    </div>
  )
}
