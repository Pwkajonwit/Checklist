import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Disabled endpoint: Automated scheduling is now handled exclusively by Vercel Cron.
 */
export async function GET() {
  return NextResponse.json({ message: 'Disabled: Using Vercel Cron exclusively' })
}

export async function POST() {
  return NextResponse.json({ message: 'Disabled: Using Vercel Cron exclusively' })
}
