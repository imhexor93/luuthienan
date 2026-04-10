'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Kol } from '@/lib/types'
import { formatMoney, formatMoneyFull } from '@/lib/utils'
import { COLLAB_LABEL, COLLAB_COLOR, STATUS_CONFIG, PLATFORM_COLOR } from '@/lib/constants'
import KolTrendChart from '@/components/KolTrendChart'

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtCount(n: number | undefined): string {
  if (n == null) return '–'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`
  return n.toLocaleString('vi-VN')
}

function fmtPct(n: number | undefined): string {
  if (n == null) return '–'
  return `${n.toFixed(2)}%`
}

function fmtDate(iso: string): string {
  if (!iso) return '–'                   // Fix 2: guard against empty string
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '–'    // Fix 2: guard against Invalid Date
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function calcRoas(gmv: number | undefined, fee: number): string {
  if (!gmv || fee === 0) return '–'
  const r = gmv / fee
  return `${r.toFixed(1)}x`
}

function calcConv(orders: number | undefined, clicks: number | undefined): string {
  if (!orders || !clicks || clicks === 0) return '–'
  return fmtPct((orders / clicks) * 100)
}

// ─── Small reusable metric cell ───────────────────────────────────────────────

interface MetricCellProps {
  label: string
  value: string
  highlight?: 'green' | 'blue' | 'red' | 'orange' | 'default'
  tooltip?: string
}

function MetricCell({ label, value, highlight = 'default', tooltip }: MetricCellProps) {
  const colorMap = {
    green:   'text-emerald-700',
    blue:    'text-blue-700',
    red:     'text-red-600',
    orange:  'text-orange-600',
    default: 'text-gray-900',
  }
  return (
    <div className="bg-gray-50 rounded-xl p-3" title={tooltip}>
      <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide leading-none mb-1">
        {label}
      </p>
      <p className={`text-sm font-bold leading-snug tabular-nums ${colorMap[highlight]}`}>
        {value}
      </p>
    </div>
  )
}

// ─── Summary metric card (header area) ───────────────────────────────────────

interface SummaryCardProps {
  label: string
  value: string
  sub?: string
  accent?: string
}

function SummaryCard({ label, value, sub, accent = 'bg-gray-50' }: SummaryCardProps) {
  return (
    <div className={`rounded-2xl p-4 ${accent}`}>
      <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-lg font-bold text-gray-900 mt-0.5 leading-tight">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  kol: Kol | null
  onClose: () => void
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CampaignDetailDrawer({ kol, onClose }: Props) {
  // Animation state: visible drives the CSS transition
  const [visible, setVisible] = useState(false)
  // Keep a reference to the last known KOL so the drawer content
  // stays populated during the exit slide animation
  const lastKol = useRef<Kol | null>(null)

  useEffect(() => {
    if (kol) {
      lastKol.current = kol
      // Double rAF: first frame mounts the element at translate-x-full,
      // second frame triggers the transition to translate-x-0
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
    } else {
      setVisible(false)
    }
  }, [kol])

  // Fix 1: wrap inline so useCallback memoizes a stable closure, not the raw prop reference
  const handleClose = useCallback(() => onClose(), [onClose])
  useEffect(() => {
    if (!kol) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [kol, handleClose])

  // Truly unmount after exit animation completes (300ms)
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    if (kol) {
      setMounted(true)
    } else {
      const t = setTimeout(() => setMounted(false), 320)
      return () => clearTimeout(t)
    }
  }, [kol])

  if (!mounted) return null

  const displayKol = kol ?? lastKol.current
  if (!displayKol) return null

  // ── Aggregate stats ────────────────────────────────────────────────────────
  const campaigns = displayKol.campaigns
  const totalCampaigns   = campaigns.length
  const totalBookingFee  = campaigns.reduce((s, c) => s + c.booking_fee, 0)
  const totalGmv         = campaigns.reduce((s, c) => s + (c.gmv ?? 0), 0)
  const gmvPerCampaign   = totalCampaigns > 0 ? totalGmv / totalCampaigns : 0
  const overallRoas      = totalBookingFee > 0 ? totalGmv / totalBookingFee : 0
  const roi              = totalBookingFee > 0
    ? ((totalGmv - totalBookingFee) / totalBookingFee) * 100 : 0
  const totalOrders      = campaigns.reduce((s, c) => s + (c.orders ?? 0), 0)
  const totalClicks      = campaigns.reduce((s, c) => s + (c.clicks ?? 0), 0)
  const avgConvRate      = totalClicks > 0 ? (totalOrders / totalClicks) * 100 : 0

  // Sorted newest first
  const sortedCampaigns = [...campaigns].sort(
    (a, b) => new Date(b.collaboration_date).getTime() - new Date(a.collaboration_date).getTime()
  )

  const statusCfg = STATUS_CONFIG[displayKol.status]

  return (
    <>
      {/* ── Backdrop ──────────────────────────────────────────────────── */}
      <div
        aria-hidden="true"
        onClick={handleClose}
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40
          transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* ── Drawer panel ──────────────────────────────────────────────── */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Chi tiết ${displayKol.name}`}
        className={`fixed right-0 top-0 h-full w-full max-w-[680px] bg-white z-50 shadow-2xl
          flex flex-col transform transition-transform duration-300 ease-out
          ${visible ? 'translate-x-0' : 'translate-x-full'}`}
      >

        {/* ── Sticky header ─────────────────────────────────────────── */}
        <div className="flex-shrink-0 border-b border-gray-100 px-6 py-4 bg-white">
          <div className="flex items-start justify-between gap-4">

            {/* Avatar + name */}
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600
                flex items-center justify-center text-white font-bold text-xl flex-shrink-0 shadow-md">
                {displayKol.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-gray-900 leading-tight truncate">
                  {displayKol.name}
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {displayKol.platform}
                  {displayKol.category ? ` · ${displayKol.category}` : ''}
                  {displayKol.follower_count
                    ? ` · ${fmtCount(displayKol.follower_count)} followers`
                    : ''}
                </p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full
                    text-xs font-medium ${statusCfg.badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                    {statusCfg.label}
                  </span>
                  {displayKol.contact && (
                    <span className="text-xs text-gray-400">{displayKol.contact}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={handleClose}
              aria-label="Đóng"
              className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center
                text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Notes (nếu có) */}
          {displayKol.notes && (
            <div className="mt-3 flex items-start gap-2 bg-yellow-50 border border-yellow-200
              rounded-xl px-3 py-2 text-xs text-yellow-800">
              <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0
                  1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd" />
              </svg>
              {displayKol.notes}
            </div>
          )}
        </div>

        {/* ── Scrollable body ───────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Tổng quan hiệu quả ─────────────────────────────────── */}
          <section className="px-6 py-5 border-b border-gray-100">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Tổng quan hiệu quả
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <SummaryCard
                label="Số lần HT"
                value={`${totalCampaigns} lần`}
                sub="Tổng chiến dịch"
                accent="bg-indigo-50"
              />
              <SummaryCard
                label="Tổng GMV"
                value={formatMoney(totalGmv)}
                sub={`avg ${formatMoney(gmvPerCampaign)}/lần`}
                accent="bg-emerald-50"
              />
              <SummaryCard
                label="Tổng Booking Fee"
                value={formatMoney(totalBookingFee)}
                sub={`ROI ${roi >= 0 ? '+' : ''}${roi.toFixed(0)}%`}
                accent="bg-orange-50"
              />
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <SummaryCard
                label="ROAS tổng"
                value={`${overallRoas.toFixed(1)}x`}
                sub="GMV / Tổng fee"
                accent="bg-blue-50"
              />
              <SummaryCard
                label="Tổng Đơn hàng"
                value={fmtCount(totalOrders)}
                sub="Tất cả chiến dịch"
                accent="bg-gray-50"
              />
              <SummaryCard
                label="Conv Rate TB"
                value={fmtPct(avgConvRate)}
                sub="Đơn / Click"
                accent="bg-gray-50"
              />
            </div>
          </section>

          {/* ── Xu hướng hiệu quả – Chart ────────────────────────── */}
          <section className="px-6 py-5 border-b border-gray-100">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Xu hướng Phí Booking vs GMV
              </h3>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Theo thứ tự thời gian · đánh giá hiệu quả theo từng lần hợp tác
            </p>
            <KolTrendChart campaigns={campaigns} />
          </section>

          {/* ── Lịch sử chiến dịch – Timeline ──────────────────────── */}
          <section className="px-6 py-5">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
              Lịch sử chiến dịch ({totalCampaigns})
            </h3>

            <div className="relative">
              {/* Vertical timeline line */}
              <div className="absolute left-[19px] top-2 bottom-2 w-px bg-gray-200" aria-hidden="true" />

              <div className="space-y-4">
                {sortedCampaigns.map((c, idx) => {
                  const roas     = calcRoas(c.gmv, c.booking_fee)
                  const convRate = calcConv(c.orders, c.clicks)
                  const isLatest = idx === 0

                  return (
                    <div key={c.id} className="relative flex gap-4">
                      {/* Timeline dot */}
                      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center
                        justify-center z-10 shadow-sm border-2 mt-0.5
                        ${isLatest
                          ? 'bg-blue-600 border-blue-200'
                          : 'bg-white border-gray-200'}`}>
                        <svg className={`w-4 h-4 ${isLatest ? 'text-white' : 'text-gray-400'}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2
                            M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </div>

                      {/* Campaign card */}
                      <div className="flex-1 bg-white rounded-2xl border border-gray-200 p-4
                        shadow-sm mb-0.5 hover:border-blue-200 transition-colors">

                        {/* Card header */}
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-xs
                                font-medium border ${COLLAB_COLOR[c.collab_type]}`}>
                                {COLLAB_LABEL[c.collab_type]}
                              </span>
                              <span className={`inline-block px-2 py-0.5 rounded-full text-xs
                                font-medium ${PLATFORM_COLOR[c.platform]}`}>
                                {c.platform}
                              </span>
                            </div>
                            <h4 className="font-semibold text-gray-900 text-sm leading-snug">
                              {c.campaign_name}
                            </h4>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs font-medium text-gray-900">{fmtDate(c.collaboration_date)}</p>
                            <p className="text-[11px] text-gray-400 mt-0.5">PIC: {c.pic}</p>
                          </div>
                        </div>

                        {/* Booking fee row */}
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-3 pb-3
                          border-b border-gray-100">
                          <svg className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" fill="none"
                            stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6
                              a3 3 0 00-3 3v8a3 3 0 003 3z" />
                          </svg>
                          <span>Phí booking:</span>
                          <span className="font-semibold text-gray-800">
                            {formatMoney(c.booking_fee)}
                          </span>
                          <span className="text-gray-300 mx-1">·</span>
                          <span className="text-gray-400">
                            Trạng thái: <span className="text-emerald-600 font-medium">{c.status}</span>
                          </span>
                        </div>

                        {/* Metrics grid — 3 columns × 2 rows */}
                        <div className="grid grid-cols-3 gap-2">
                          <MetricCell
                            label="GMV"
                            value={c.gmv ? formatMoney(c.gmv) : '–'}
                            highlight="green"
                            tooltip={c.gmv ? `Tổng GMV: ${formatMoneyFull(c.gmv)}` : undefined}
                          />
                          <MetricCell
                            label="ROAS"
                            value={roas}
                            highlight={roas !== '–' && parseFloat(roas) >= 5 ? 'green' : 'default'}
                            tooltip="ROAS = GMV ÷ Phí booking"
                          />
                          <MetricCell
                            label="Lượt xem"
                            value={fmtCount(c.views)}
                            highlight="blue"
                          />
                          <MetricCell
                            label="Lượt click"
                            value={fmtCount(c.clicks)}
                          />
                          <MetricCell
                            label="Đơn hàng"
                            value={c.orders ? c.orders.toLocaleString('vi-VN') : '–'}
                          />
                          <MetricCell
                            label="Conv Rate"
                            value={convRate}
                            tooltip="Tỷ lệ chuyển đổi = Đơn hàng ÷ Lượt click"
                          />
                        </div>

                        {/* Return rate — full width only if data exists */}
                        {c.return_rate != null && (
                          <div className={`mt-2 flex items-center justify-between rounded-xl px-3 py-2
                            ${c.return_rate >= 10
                              ? 'bg-red-50 border border-red-100'
                              : c.return_rate >= 6
                                ? 'bg-orange-50 border border-orange-100'
                                : 'bg-gray-50 border border-gray-100'}`}>
                            <div className="flex items-center gap-1.5">
                              <svg className={`w-3.5 h-3.5 ${
                                c.return_rate >= 10 ? 'text-red-500'
                                : c.return_rate >= 6 ? 'text-orange-500'
                                : 'text-gray-400'
                              }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                              </svg>
                              <span className="text-xs text-gray-500 font-medium">Tỷ lệ hoàn hàng</span>
                            </div>
                            <span className={`text-sm font-bold ${
                              c.return_rate >= 10 ? 'text-red-600'
                              : c.return_rate >= 6 ? 'text-orange-600'
                              : 'text-gray-700'
                            }`}>
                              {c.return_rate.toFixed(1)}%
                              {c.return_rate >= 10 && (
                                <span className="ml-1 text-xs font-medium text-red-500">⚠ Cao</span>
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>

          {/* Bottom padding */}
          <div className="h-8" />
        </div>

        {/* ── Sticky footer ─────────────────────────────────────────── */}
        <div className="flex-shrink-0 border-t border-gray-100 px-6 py-3 bg-gray-50/80
          flex items-center justify-between">
          <span className="text-xs text-gray-400">
            Cập nhật gần nhất: {fmtDate(sortedCampaigns[0]?.collaboration_date ?? '')}
          </span>
          <button
            onClick={handleClose}
            className="text-sm text-gray-500 hover:text-gray-800 font-medium transition-colors"
          >
            Đóng
          </button>
        </div>
      </aside>
    </>
  )
}
