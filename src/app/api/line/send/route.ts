import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      message,
      channelAccessToken,
      targetId,
      broadcast = false,
      notifyToken,
      webhookUrl,
    } = body

    if (!message && !body.flex) {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 })
    }

    const results: Record<string, any> = {}

    // 1. LINE Notify (if token provided)
    if (notifyToken) {
      try {
        const formData = new URLSearchParams()
        formData.append('message', message)
        const notifyRes = await fetch('https://notify-api.line.me/api/notify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Bearer ${notifyToken}`,
          },
          body: formData.toString(),
        })
        const notifyData = await notifyRes.json()
        results.notify = notifyData
      } catch (err: any) {
        results.notifyError = err.message
      }
    }

    // 2. Custom Webhook (if provided)
    if (webhookUrl) {
      try {
        const hookRes = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, ...body }),
        })
        results.webhook = { status: hookRes.status, ok: hookRes.ok }
      } catch (err: any) {
        results.webhookError = err.message
      }
    }

    // 3. LINE Official Account Messaging API (Push / Broadcast)
    const token = channelAccessToken || process.env.LINE_CHANNEL_ACCESS_TOKEN
    if (token) {
      const messages = body.flex
        ? [body.flex]
        : [{ type: 'text', text: message }]

      if (broadcast || !targetId) {
        // Broadcast to all followers / friends
        const broadcastRes = await fetch('https://api.line.me/v2/bot/message/broadcast', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
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
            Authorization: `Bearer ${token}`,
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
    }

    // If no provider succeeded or configured
    if (!token && !notifyToken && !webhookUrl) {
      return NextResponse.json(
        {
          error: 'กรุณาระบุ Channel Access Token หรือ LINE Notify Token ในการตั้งค่า',
          results,
        },
        { status: 400 }
      )
    }

    const isSuccess =
      (results.lineOA && results.lineOA.ok) ||
      (results.notify && results.notify.status === 200) ||
      (results.webhook && results.webhook.ok)

    if (!isSuccess && results.lineOA && !results.lineOA.ok) {
      const errMsg = results.lineOA.data?.message || 'ส่งข้อความผ่าน LINE OA ไม่สำเร็จ ตรวจสอบ Token หรือ Target ID'
      return NextResponse.json({ error: errMsg, results }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'ส่งการแจ้งเตือนไปยัง LINE เรียบร้อยแล้ว',
      results,
    })
  } catch (error: any) {
    console.error('LINE notification error:', error)
    return NextResponse.json(
      { error: error.message || 'เกิดข้อผิดพลาดในการส่งข้อความ' },
      { status: 500 }
    )
  }
}
