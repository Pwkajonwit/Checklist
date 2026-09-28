'use client'

import { useEffect } from 'react'

/**
 * Background heartbeat that pings the server schedule check every 60 seconds
 * to ensure scheduled notification triggers execute reliably even if server sleep occurs.
 */
export function SchedulerHeartbeat() {
  useEffect(() => {
    // Initial check on load
    fetch('/api/line/cron-check', { method: 'POST' }).catch(() => {})

    // Periodic check every 60 seconds
    const interval = setInterval(() => {
      fetch('/api/line/cron-check', { method: 'POST' }).catch(() => {})
    }, 60_000)

    return () => clearInterval(interval)
  }, [])

  return null
}
