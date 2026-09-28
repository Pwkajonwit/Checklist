import { getNotificationConfig } from '@/lib/settings-store'

export interface DispatchNotificationParams {
  message?: string
  flex?: any
  line_enabled?: boolean
  line_channel_access_token?: string
  line_target_id?: string
  line_broadcast?: boolean
  telegram_enabled?: boolean
  telegram_bot_token?: string
  telegram_chat_id?: string
}

export interface DispatchResult {
  success: boolean
  message: string
  results: Record<string, any>
  error?: string
}

export async function sendNotification(params: DispatchNotificationParams): Promise<DispatchResult> {
  const { message, flex } = params

  if (!message && !flex) {
    return {
      success: false,
      message: 'Message content is required',
      results: {},
      error: 'Message content is required',
    }
  }

  // Load saved config from Supabase / Store as baseline
  const savedConfig = await getNotificationConfig().catch(() => null)

  // Determine LINE OA parameters
  const lineEnabled = params.line_enabled ?? savedConfig?.line_enabled ?? true
  const channelToken =
    params.line_channel_access_token ||
    savedConfig?.line_channel_access_token ||
    process.env.LINE_CHANNEL_ACCESS_TOKEN ||
    ''
  const targetId =
    params.line_target_id !== undefined
      ? params.line_target_id
      : savedConfig?.line_target_id || process.env.LINE_TARGET_ID || ''
  const broadcast =
    params.line_broadcast ?? savedConfig?.line_broadcast ?? false

  // Determine Telegram parameters
  const telegramEnabled =
    params.telegram_enabled ?? savedConfig?.telegram_enabled ?? false
  const telegramBotToken =
    params.telegram_bot_token ||
    savedConfig?.telegram_bot_token ||
    process.env.TELEGRAM_BOT_TOKEN ||
    ''
  const telegramChatId =
    params.telegram_chat_id ||
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
          text: message || 'SiteCheck Daily Report',
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

      const cleanTargetId = (targetId || '').trim()
      const isLikelyValidId = /^[UCR][0-9a-zA-Z]{32}$/.test(cleanTargetId)

      if (broadcast || !cleanTargetId) {
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
      } else if (!isLikelyValidId) {
        results.lineOA = {
          ok: false,
          error: `Target ID "${cleanTargetId}" ไม่ถูกต้อง (LINE กำหนดให้ User ID ต้องขึ้นต้นด้วย U... หรือ Group ID ขึ้นต้นด้วย C... รวม 33 ตัวอักษร ไม่ใช่ชื่อกลุ่ม) — แนะนำให้ติ๊กเปิด Broadcast หรือเว้นช่อง Target ID ให้ว่าง`,
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
            to: cleanTargetId,
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
    return {
      success: false,
      message: 'ไม่มีช่องทางการแจ้งเตือนที่เปิดใช้งานหรือไม่ได้ระบุ Token',
      results,
      error: 'ไม่มีช่องทางการแจ้งเตือนที่เปิดใช้งานหรือไม่ได้ระบุ Token (กรุณาเปิดใช้งาน LINE OA หรือ Telegram ในหน้าตั้งค่า)',
    }
  }

  // Check overall outcome
  const isAnySuccess =
    (results.lineOA && results.lineOA.ok) ||
    (results.telegram && results.telegram.ok)

  if (!isAnySuccess) {
    let errMsg = 'ส่งข้อความไม่สำเร็จ'
    if (results.lineOA && !results.lineOA.ok) {
      let msg = results.lineOA.data?.message || results.lineOA.error || 'ส่งไม่สำเร็จ'
      if (msg === 'Failed to send messages') {
        msg = 'ไม่สามารถส่งข้อความได้ (Target ID ไม่ถูกต้อง หรือ LINE OA บอทยังไม่ได้ถูกดึงเข้ากลุ่ม LINE หรือผู้รับยังไม่ได้เป็นเพื่อนกับบอท หรือติ๊กเปิด Broadcast เพื่อส่งหาทุกคน)'
      }
      const detailsStr = Array.isArray(results.lineOA.data?.details)
        ? results.lineOA.data.details.map((d: any) => `${d.property ? `${d.property}: ` : ''}${d.message}`).join(', ')
        : ''
      errMsg = `LINE OA: ${msg}${detailsStr ? ` (${detailsStr})` : ''}`
    } else if (results.telegram && !results.telegram.ok) {
      errMsg = `Telegram: ${results.telegram.data?.description || results.telegram.error || 'ส่งไม่สำเร็จ'}`
    }
    return {
      success: false,
      message: errMsg,
      error: errMsg,
      results,
    }
  }

  const channelNames: string[] = []
  if (results.lineOA?.ok) channelNames.push('LINE OA')
  if (results.telegram?.ok) channelNames.push('Telegram')

  return {
    success: true,
    message: `ส่งการแจ้งเตือนไปยัง ${channelNames.join(' และ ')} เรียบร้อยแล้ว`,
    results,
  }
}
