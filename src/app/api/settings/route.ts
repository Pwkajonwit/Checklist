import { NextResponse } from 'next/server'
import {
  getPpeChecklistItems,
  savePpeChecklistItems,
  getNotificationConfig,
  saveNotificationConfig,
} from '@/lib/settings-store'
import { DEFAULT_CHECKLIST_PPE_ITEMS, ChecklistPpeItem, DEFAULT_NOTIFICATION_CONFIG } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET /api/settings?id=checklist_ppe_items | notification_config
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id') || 'checklist_ppe_items'

    if (id === 'checklist_ppe_items') {
      const items = await getPpeChecklistItems()
      return NextResponse.json({
        success: true,
        data: items,
      })
    }

    if (id === 'notification_config') {
      const config = await getNotificationConfig()
      return NextResponse.json({
        success: true,
        data: config,
      })
    }

    return NextResponse.json({
      success: true,
      data: null,
    })
  } catch (err: any) {
    console.error('GET /api/settings error:', err)
    return NextResponse.json({
      success: false,
      error: err.message,
    }, { status: 500 })
  }
}

// POST /api/settings
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { id = 'checklist_ppe_items', items, config, reset } = body

    if (id === 'notification_config') {
      if (reset) {
        const saved = await saveNotificationConfig(DEFAULT_NOTIFICATION_CONFIG)
        return NextResponse.json({
          success: true,
          message: 'รีเซ็ตการตั้งค่าการแจ้งเตือนเป็นค่าเริ่มต้นเรียบร้อยแล้ว',
          data: saved,
        })
      }

      const saved = await saveNotificationConfig(config || body)
      return NextResponse.json({
        success: true,
        message: 'บันทึกการตั้งค่าการแจ้งเตือนเรียบร้อยแล้ว',
        data: saved,
      })
    }

    if (reset) {
      const saved = await savePpeChecklistItems(DEFAULT_CHECKLIST_PPE_ITEMS)
      return NextResponse.json({
        success: true,
        message: 'รีเซ็ตเป็นค่าเริ่มต้นเรียบร้อยแล้ว',
        data: saved,
      })
    }

    if (!Array.isArray(items)) {
      return NextResponse.json({
        success: false,
        error: 'รูปแบบข้อมูลไม่ถูกต้อง (items ต้องเป็น Array)',
      }, { status: 400 })
    }

    // Validate and clean items
    const cleaned: ChecklistPpeItem[] = items.map((item: any, index: number) => ({
      id: String(item.id || `ppe_${Date.now()}_${index}`).trim(),
      label: String(item.label || '').trim() || `รายการที่ ${index + 1}`,
      icon: String(item.icon || '🛡️').trim(),
      required: Boolean(item.required ?? true),
      is_active: Boolean(item.is_active ?? true),
      sort_order: Number(item.sort_order ?? index + 1),
    }))

    const saved = await savePpeChecklistItems(cleaned)

    return NextResponse.json({
      success: true,
      message: 'บันทึกการตั้งค่าเรียบร้อยแล้ว',
      data: saved,
    })
  } catch (err: any) {
    console.error('POST /api/settings error:', err)
    return NextResponse.json({
      success: false,
      error: err.message,
    }, { status: 500 })
  }
}

