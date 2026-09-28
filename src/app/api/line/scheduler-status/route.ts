import { NextResponse } from 'next/server'
import { getSchedulerDiagnostics, startServerScheduler } from '@/lib/server-scheduler'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Ensure scheduler is active
    startServerScheduler()

    const diagnostics = await getSchedulerDiagnostics()
    return NextResponse.json(diagnostics)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
