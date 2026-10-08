import { NextResponse } from 'next/server'
import { getNotificationConfig } from '@/lib/settings-store'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET /api/notifications/verify?token=...&target_id=...&tg_token=...
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const tokenParam = searchParams.get('token')
    const targetIdParam = searchParams.get('target_id')
    const broadcastParam = searchParams.get('broadcast')
    const tgTokenParam = searchParams.get('tg_token')

    const config = await getNotificationConfig()
    const lineToken = (tokenParam !== null ? tokenParam : config.line_channel_access_token)?.trim() || ''
    const targetId = (targetIdParam !== null ? targetIdParam : config.line_target_id)?.trim() || ''
    const isBroadcast = broadcastParam !== null ? broadcastParam === 'true' : config.line_broadcast
    const tgToken = (tgTokenParam !== null ? tgTokenParam : config.telegram_bot_token)?.trim() || ''

    const results: {
      line: {
        configured: boolean
        connected: boolean
        bot: {
          displayName: string
          basicId: string
          pictureUrl?: string
          userId?: string
        } | null
        targetValid: boolean
        targetType: string
        quota: {
          type: 'limited' | 'none' | 'unknown'
          total: number | null
          used: number | null
          remaining: number | null
          percentRemaining: number | null
        } | null
        error: string | null
      }
      telegram: {
        configured: boolean
        connected: boolean
        bot: {
          username: string
          first_name: string
        } | null
        error: string | null
      }
    } = {
      line: {
        configured: Boolean(lineToken),
        connected: false,
        bot: null,
        targetValid: false,
        targetType: 'none',
        quota: null,
        error: null,
      },
      telegram: {
        configured: Boolean(tgToken),
        connected: false,
        bot: null,
        error: null,
      },
    }

    // 1. Verify LINE Messaging API Token
    if (lineToken) {
      try {
        const lineRes = await fetch('https://api.line.me/v2/bot/info', {
          headers: { Authorization: `Bearer ${lineToken}` },
          cache: 'no-store',
        })
        const lineData = await lineRes.json().catch(() => ({}))
        if (lineRes.ok && lineData.userId) {
          results.line.connected = true
          results.line.bot = {
            displayName: lineData.displayName || 'LINE Official Account',
            basicId: lineData.basicId || '',
            pictureUrl: lineData.pictureUrl,
            userId: lineData.userId,
          }

          // Fetch message quota & consumption
          try {
            const [quotaRes, usageRes] = await Promise.all([
              fetch('https://api.line.me/v2/bot/message/quota', {
                headers: { Authorization: `Bearer ${lineToken}` },
                cache: 'no-store',
              }),
              fetch('https://api.line.me/v2/bot/message/quota/consumption', {
                headers: { Authorization: `Bearer ${lineToken}` },
                cache: 'no-store',
              }),
            ])
            const quotaData = await quotaRes.json().catch(() => ({}))
            const usageData = await usageRes.json().catch(() => ({}))

            if (quotaRes.ok && quotaData.type) {
              const qType = quotaData.type
              const total = typeof quotaData.value === 'number' ? quotaData.value : null
              const used = typeof usageData.totalUsage === 'number' ? usageData.totalUsage : 0
              const remaining = total !== null ? Math.max(0, total - used) : null
              const percentRemaining = (total !== null && total > 0 && remaining !== null)
                ? Math.round((remaining / total) * 100)
                : null

              results.line.quota = {
                type: qType,
                total,
                used,
                remaining,
                percentRemaining,
              }
            }
          } catch (qErr) {
            console.warn('Failed to fetch LINE quota:', qErr)
          }
        } else {
          results.line.connected = false
          results.line.error = lineData.message || 'Channel Access Token ไม่ถูกต้องหรือหมดอายุ'
        }
      } catch (err: any) {
        results.line.connected = false
        results.line.error = err.message || 'ไม่สามารถติดต่อ LINE Messaging API ได้'
      }

      // Check Target ID validity
      if (isBroadcast) {
        results.line.targetValid = true
        results.line.targetType = 'broadcast'
      } else if (targetId) {
        if (/^[UCR][0-9a-zA-Z]{32}$/.test(targetId)) {
          results.line.targetValid = true
          results.line.targetType = targetId.startsWith('C') ? 'group' : targetId.startsWith('U') ? 'user' : 'room'
        } else {
          results.line.targetValid = false
          results.line.targetType = 'invalid'
        }
      } else {
        results.line.targetValid = false
        results.line.targetType = 'empty'
      }
    }

    // 2. Verify Telegram Bot Token
    if (tgToken) {
      try {
        const tgRes = await fetch(`https://api.telegram.org/bot${tgToken}/getMe`, {
          cache: 'no-store',
        })
        const tgData = await tgRes.json().catch(() => ({}))
        if (tgRes.ok && tgData.ok && tgData.result) {
          results.telegram.connected = true
          results.telegram.bot = {
            username: tgData.result.username || '',
            first_name: tgData.result.first_name || '',
          }
        } else {
          results.telegram.connected = false
          results.telegram.error = tgData.description || 'Telegram Bot Token ไม่ถูกต้อง'
        }
      } catch (err: any) {
        results.telegram.connected = false
        results.telegram.error = err.message || 'ไม่สามารถติดต่อ Telegram API ได้'
      }
    }

    return NextResponse.json({
      success: true,
      data: results,
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
