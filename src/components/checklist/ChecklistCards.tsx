'use client'

import { useState, useEffect } from 'react'
import type { ChecklistEntry, ChecklistPpeItem } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Clock, MapPin, Zap, User, Pencil, Trash2,
  HardHat, CheckCircle2, XCircle, AlertTriangle, Shield,
} from 'lucide-react'
import Link from 'next/link'
import { getContractorAlcRisk, isAlcoholFailed, isAlcoholUnchecked, DEFAULT_CHECKLIST_PPE_ITEMS } from '@/lib/types'

/* ── Dynamic PPE compact ── */
const PPEStrip = ({ entry, ppeConfig }: { entry: ChecklistEntry; ppeConfig: ChecklistPpeItem[] }) => {
  let details: Record<string, boolean> | null = null
  try {
    if (entry.notes) {
      const parsed = JSON.parse(entry.notes)
      if (parsed?.ppe_details && typeof parsed.ppe_details === 'object') {
        details = parsed.ppe_details
      }
    }
  } catch {}

  const activeItems = ppeConfig.filter(i => i.is_active)
  const items = (activeItems.length > 0 ? activeItems : DEFAULT_CHECKLIST_PPE_ITEMS).map(it => {
    let passed = false
    if (details && typeof details[it.id] === 'boolean') {
      passed = details[it.id]
    } else if (it.id === 'helmet') passed = !!entry.ppe_helmet
    else if (it.id === 'vest') passed = !!entry.ppe_vest
    else if (it.id === 'glasses' || it.id === 'shirt') passed = !!entry.ppe_shirt
    else if (it.id === 'gloves') passed = !!entry.ppe_gloves
    else if (it.id === 'shoes') passed = !!entry.ppe_shoes
    return { ...it, v: passed }
  })

  const pass = items.filter(i => i.v).length
  const total = items.length

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ display: 'flex', gap: 3 }}>
        {items.map(i => (
          <span key={i.id} title={`${i.label}: ${i.v ? 'ผ่าน' : 'ไม่ผ่าน'}`} style={{
            width: 10, height: 10, borderRadius: '50%',
            background: i.v ? 'hsl(142 72% 29%)' : 'hsl(var(--c-border-2))',
          }} />
        ))}
      </div>
      <span style={{
        fontSize: 12, fontWeight: 400, lineHeight: 1,
        color: pass === total ? 'hsl(142 72% 29%)' : pass >= Math.ceil(total / 2) ? 'hsl(34 90% 38%)' : 'hsl(0 72% 50%)',
      }}>
        {pass}/{total}
      </span>
    </div>
  )
}

interface ChecklistCardsProps {
  entries: ChecklistEntry[]
  loading: boolean
  onDelete: (id: string) => void
}

export function ChecklistCards({ entries, loading, onDelete }: ChecklistCardsProps) {
  const [ppeConfig, setPpeConfig] = useState<ChecklistPpeItem[]>(DEFAULT_CHECKLIST_PPE_ITEMS)

  useEffect(() => {
    fetch(`/api/settings?id=checklist_ppe_items&t=${Date.now()}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(json => {
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          setPpeConfig(json.data)
        }
      })
      .catch(() => {})
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="card p-4" style={{ opacity: 0.5 }}>
            <div style={{
              height: 14, width: '60%', borderRadius: 4,
              background: 'hsl(var(--c-border))', marginBottom: 8,
              animation: 'pulse 1.5s ease infinite',
            }} />
            <div style={{
              height: 12, width: '40%', borderRadius: 4,
              background: 'hsl(var(--c-border))',
            }} />
          </div>
        ))}
      </div>
    )
  }

  if (!entries.length) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '64px 0', gap: 8,
      }}>
        <HardHat className="w-10 h-10" style={{ color: 'hsl(var(--c-border-2))' }} />
        <p style={{ fontSize: 13, fontWeight: 500, color: 'hsl(var(--c-fg-4))' }}>ไม่พบรายการ</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {entries.map((e, idx) => {
        const hasDanger = e.is_blacklisted
        const hasWarn   = isAlcoholFailed(e.alc_result) && !hasDanger

        return (
          <div key={e.id}
            className={cn('entry-card fade-up', hasDanger ? 'danger' : hasWarn ? 'warning' : '')}
            style={{ animationDelay: `${idx * 30}ms` }}>

            {/* Top stripe */}
            <div style={{ height: 3, background: hasDanger ? 'hsl(0 72% 50%)' : 'hsl(var(--c-brand))' }} />

            <div style={{ padding: '12px 14px' }}>

              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                {/* Avatar */}
                <div style={{
                  width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                  background: hasDanger ? 'hsl(0 72% 50%)' : 'hsl(var(--c-brand))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 13, fontWeight: 600,
                }}>
                  {e.contractor_name.charAt(0)}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <p style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: 'hsl(var(--c-fg))',
                      lineHeight: 1.2,
                      background: (getContractorAlcRisk(e.contractors) || e.notes?.includes('[เสี่ยง ALC]') || e.purpose?.includes('[เสี่ยง ALC]')) ? '#fef3c7' : undefined,
                      padding: (getContractorAlcRisk(e.contractors) || e.notes?.includes('[เสี่ยง ALC]') || e.purpose?.includes('[เสี่ยง ALC]')) ? '1px 6px' : undefined,
                      borderRadius: (getContractorAlcRisk(e.contractors) || e.notes?.includes('[เสี่ยง ALC]') || e.purpose?.includes('[เสี่ยง ALC]')) ? 4 : undefined,
                    }}>
                      {e.contractor_name}
                    </p>
                    {hasDanger && (
                      <span className="badge badge-danger-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <Shield className="w-3 h-3" />บัญชีดำ
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 12, color: 'hsl(var(--c-fg-4))', lineHeight: 1.3, fontWeight: 400 }}>
                    {e.company_name ?? '—'}
                  </p>
                </div>
              </div>

              {/* Info rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
                {e.supervisor && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'hsl(var(--c-fg-3))' }}>
                    <User className="w-3.5 h-3.5 shrink-0" style={{ color: 'hsl(var(--c-fg-4))' }} />
                    ผู้ควบคุม:
                    <span style={{ fontWeight: 400, color: 'hsl(var(--c-fg-2))' }}>{e.supervisor}</span>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'hsl(var(--c-fg-3))' }}>
                  <Clock className="w-3.5 h-3.5 shrink-0" style={{ color: 'hsl(var(--c-fg-4))' }} />
                  เวลาตรวจ:
                  <span style={{ fontWeight: 400, color: 'hsl(var(--c-fg))' }}>{e.check_in_time ?? '—'}</span>
                </div>
                {e.activity_name && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12, color: 'hsl(var(--c-fg-3))' }}>
                    <Zap className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: 'hsl(var(--c-fg-4))' }} />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, flex: 1 }}>
                      {e.activity_name.split(',').map((act, i) => (
                        <span
                          key={i}
                          style={{
                            fontSize: 12,
                            fontWeight: 400,
                            padding: '1px 6px',
                            borderRadius: 4,
                            background: '#f3e8ff',
                            color: '#6b21a8',
                            border: '1px solid #e9d5ff',
                            display: 'inline-block',
                          }}
                        >
                          {act.trim()}
                        </span>
                      ))}
                      {e.location && <span style={{ color: 'hsl(var(--c-fg-4))', fontSize: 12, alignSelf: 'center', fontWeight: 400 }}>· 📍 {e.location}</span>}
                    </div>
                  </div>
                )}
              </div>

              {/* ALC + PPE row */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 0', borderTop: '1px solid hsl(var(--c-border))',
                borderBottom: '1px solid hsl(var(--c-border))',
                flexWrap: 'wrap',
              }}>
                <span className={`badge ${
                  isAlcoholUnchecked(e.alc_result)
                    ? 'badge-muted'
                    : isAlcoholFailed(e.alc_result)
                    ? 'badge-alc-fail'
                    : 'badge-alc-ok'
                }`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 400 }}>
                  {isAlcoholUnchecked(e.alc_result) ? (
                    'ALC ยังไม่ตรวจ'
                  ) : (
                    <>
                      {isAlcoholFailed(e.alc_result)
                        ? <AlertTriangle className="w-3.5 h-3.5" />
                        : <CheckCircle2 className="w-3.5 h-3.5" />}
                      ALC {e.alc_result}
                    </>
                  )}
                </span>
                <PPEStrip entry={e} ppeConfig={ppeConfig} />
                {e.noise_area && (
                  <span className="badge badge-warn" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 400 }}>
                    <Zap className="w-3.5 h-3.5" />พื้นที่เสียงดัง
                  </span>
                )}
              </div>

              {/* Wage */}
              {e.daily_wage && (
                <div style={{ paddingTop: 8, fontSize: 12, color: 'hsl(var(--c-fg-3))' }}>
                  ค่าแรง:
                  <span style={{ fontWeight: 400, color: 'hsl(var(--c-fg))', marginLeft: 6 }}>
                    ฿{e.daily_wage.toLocaleString()}
                  </span>
                  {e.meal_allowance && (
                    <span className="badge badge-active" style={{ marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 400 }}>
                      <CheckCircle2 className="w-3.5 h-3.5" />เบี้ยเลี้ยง
                    </span>
                  )}
                </div>
              )}

              {/* Actions */}
              <div style={{
                display: 'flex', gap: 6, marginTop: 10,
                paddingTop: 10, borderTop: '1px solid hsl(var(--c-border))',
              }}>
                <Link href={`/checklist/${e.id}/edit`} style={{ flex: 1 }}>
                  <button className="ctrl-btn" style={{ width: '100%', fontSize: 12, fontWeight: 500 }}>
                    <Pencil className="w-3.5 h-3.5" />แก้ไข
                  </button>
                </Link>
                <button className="ctrl-btn ctrl-btn-icon" onClick={() => onDelete(e.id)}
                  style={{ color: 'hsl(var(--c-danger))', borderColor: 'hsl(var(--c-danger-bd))', background: 'hsl(var(--c-danger-bg))' }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
