import { NextRequest, NextResponse } from 'next/server'
import { getNotificationConfig } from '@/lib/settings-store'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      message,
      flex,
    } = body

    if (!message && !flex) {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 })
    }

    // Load saved config from Supabase / Store as baseline
    const savedConfig = await getNotificationConfig().catch(() => null)

    // Determine LINE OA parameters
    const lineEnabled = body.line_enabled ?? body.lineEnabled ?? savedConfig?.line_enabled ?? true
    const channelToken =
      body.line_channel_access_token ||
      body.channelAccessToken ||
      savedConfig?.line_channel_access_token ||
      process.env.LINE_CHANNEL_ACCESS_TOKEN ||
      ''
    const targetId =
      body.line_target_id !== undefined
        ? body.line_target_id
        : body.targetId !== undefined
        ? body.targetId
        : savedConfig?.line_target_id || process.env.LINE_TARGET_ID || ''
    const broadcast =
      body.line_broadcast ?? body.broadcast ?? savedConfig?.line_broadcast ?? false

    // Determine Telegram parameters
    const telegramEnabled =
      body.telegram_enabled ?? body.telegramEnabled ?? savedConfig?.telegram_enabled ?? false
    const telegramBotToken =
      body.telegram_bot_token ||
      body.telegramBotToken ||
      savedConfig?.telegram_bot_token ||
      process.env.TELEGRAM_BOT_TOKEN ||
      ''
    const telegramChatId =
      body.telegram_chat_id ||
      body.telegramChatId ||
      savedConfig?.telegram_chat_id ||
      process.env.TELEGRAM_CHAT_ID ||
      ''

    const results: Record<string, any> = {}
    let dispatchedAny = false

    // 1. Send to Telegram if enabled and configured
    if (telegramEnabled && telegramBotToken && telegramChatId) {
      dispatchedAny = true
      try {
        const tgRes = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: telegramChatId,
            text: message,
          }),
        })
        const tgData = await tgRes.json().catch(() => ({}))
        results.telegram = {
          ok: tgRes.ok && tgData.ok === true,
          status: tgRes.status,
          data: tgData,
        }
      } catch (err: any) {
        results.telegram = {
          ok: false,
          error: err.message || 'Failed to connect to Telegram API',
        }
      }
    }

    // 2. Send to LINE OA Messaging API if enabled and configured
    if (lineEnabled && channelToken) {
      dispatchedAny = true
      try {
        const messages = flex
          ? [flex]
          : [{ type: 'text', text: message }]

        if (broadcast || !targetId) {
          // Broadcast to all followers
          const broadcastRes = await fetch('https://api.line.me/v2/bot/message/broadcast', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${channelToken}`,
            },
            body: JSON.stringify({ messages }),
          })
          const broadcastData = await broadcastRes.json().catch(() => ({}))
          results.lineOA = {
            type: 'broadcast',
            status: broadcastRes.status,
            ok: broadcastRes.ok,
            data: broadcastData,
          }
        } else {
          // Push message to specific user / group
          const pushRes = await fetch('https://api.line.me/v2/bot/message/push', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${channelToken}`,
            },
            body: JSON.stringify({
              to: targetId,
              messages,
            }),
          })
          const pushData = await pushRes.json().catch(() => ({}))
          results.lineOA = {
            type: 'push',
            status: pushRes.status,
            ok: pushRes.ok,
            data: pushData,
          }
        }
      } catch (err: any) {
        results.lineOA = {
          ok: false,
          error: err.message || 'Failed to connect to LINE API',
        }
      }
    }

    if (!dispatchedAny) {
      return NextResponse.json(
        {
          error: 'ไม่มีช่องทางการแจ้งเตือนที่เปิดใช้งานหรือไม่ได้ระบุ Token (กรุณาเปิดใช้งาน LINE OA หรือ Telegram ในหน้าตั้งค่า)',
          results,
        },
        { status: 400 }
      )
    }

    // Check overall outcome
    const lineSuccess = !lineEnabled || (results.lineOA && results.lineOA.ok)
    const tgSuccess = !telegramEnabled || (results.telegram && results.telegram.ok)

    const isAnySuccess =
      (results.lineOA && results.lineOA.ok) ||
      (results.telegram && results.telegram.ok)

    if (!isAnySuccess) {
      let errMsg = 'ส่งข้อความไม่สำเร็จ'
      if (results.lineOA && !results.lineOA.ok) {
        errMsg = `LINE OA: ${results.lineOA.data?.message || results.lineOA.error || 'ส่งไม่สำเร็จ'}`
      } else if (results.telegram && !results.telegram.ok) {
        errMsg = `Telegram: ${results.telegram.data?.description || results.telegram.error || 'ส่งไม่สำเร็จ'}`
      }
      return NextResponse.json({ error: errMsg, results }, { status: 400 })
    }

    const channelNames: string[] = []
    if (results.lineOA?.ok) channelNames.push('LINE OA')
    if (results.telegram?.ok) channelNames.push('Telegram')

    return NextResponse.json({
      success: true,
      message: `ส่งการแจ้งเตือนไปยัง ${channelNames.join(' และ ')} เรียบร้อยแล้ว`,
      results,
    })
  } catch (error: any) {
    console.error('Notification send error:', error)
    return NextResponse.json(
      { error: error.message || 'เกิดข้อผิดพลาดในการส่งข้อความ' },
      { status: 500 }
    )
  }
}

