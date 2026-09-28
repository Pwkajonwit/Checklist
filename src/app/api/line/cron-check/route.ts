import { NextResponse } from 'next/server'
import { checkAndTriggerSchedule } from '@/lib/server-scheduler'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const outcome = await checkAndTriggerSchedule()
    return NextResponse.json(outcome)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST() {
  try {
    const outcome = await checkAndTriggerSchedule()
    return NextResponse.json(outcome)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
