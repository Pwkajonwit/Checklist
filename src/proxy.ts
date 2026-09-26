import { NextResponse, type NextRequest } from 'next/server'

/** Routes ที่ต้องการ session */
const PROTECTED_PREFIXES = [
  '/dashboard',
  '/checklist',
  '/employees',
  '/contractors',
  '/activities',
  '/companies',
  '/history',
  '/line-oa',
]

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ข้าม Next.js internals, static files, favicon
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Public paths และ API routes ไม่ต้องดัก
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/checklist-m')
  ) {
    return NextResponse.next()
  }

  const token = request.cookies.get('site_session')?.value

  // ถ้าเข้าหน้าแรก '/'
  if (pathname === '/') {
    const target = token ? '/dashboard' : '/login'
    return NextResponse.redirect(new URL(target, request.url))
  }

  // ตรวจ Protected routes
  const isProtected = PROTECTED_PREFIXES.some(
    prefix => pathname === prefix || pathname.startsWith(prefix + '/')
  )

  if (isProtected && !token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
