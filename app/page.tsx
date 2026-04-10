'use client'

import { useState } from 'react'
import KolTable from '@/components/KolTable'
import CampaignDetailDrawer from '@/components/CampaignDetailDrawer'
import { mockKols, buildDashboardRows, getDashboardStats } from '@/lib/mock-data'
import { formatMoney } from '@/lib/utils'
import { Kol } from '@/lib/types'

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: string
  sub?: string
  icon: React.ReactNode
  color: string
}

function StatCard({ label, value, sub, icon, color }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide truncate">{label}</p>
        <p className="text-xl font-bold text-gray-900 leading-tight mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const IconUsers = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2
      a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0
      M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

const IconCalendar = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
)

const IconWallet = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
      d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
  </svg>
)

const IconChart = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
      d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
)

const IconPlus = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
  </svg>
)

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const rows  = buildDashboardRows(mockKols)
  const stats = getDashboardStats(mockKols)

  // Detail drawer state: holds the full Kol object (null = closed)
  const [activeKol, setActiveKol] = useState<Kol | null>(null)

  const roi = stats.totalBookingFee > 0
    ? ((stats.totalGmv - stats.totalBookingFee) / stats.totalBookingFee * 100).toFixed(0)
    : '0'

  function handleViewDetail(id: string) {
    const kol = mockKols.find((k) => k.id === id) ?? null
    setActiveKol(kol)
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Topbar ──────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg
              flex items-center justify-center shadow-sm">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462
                  c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921
                  -.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838
                  -.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81
                  .588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </div>
            <div>
              <span className="font-bold text-gray-900 text-base">KOL/KOC Hub</span>
              <span className="ml-2 text-xs text-gray-400">Quản lý hợp tác TikTok & Shopee</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 hidden sm:block">Dữ liệu mock · Phase 3</span>
            <button className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700
              text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shadow-sm">
              <IconPlus />
              Thêm KOL
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">

        {/* ── Stat Cards ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="KOL/KOC đang HT"
            value={String(stats.activeKols)}
            sub={`${stats.totalKols} tổng cộng`}
            icon={<IconUsers />}
            color="bg-blue-50 text-blue-600"
          />
          <StatCard
            label="Tổng chiến dịch"
            value={String(stats.totalCampaigns)}
            sub="Đã hoàn thành"
            icon={<IconCalendar />}
            color="bg-indigo-50 text-indigo-600"
          />
          <StatCard
            label="Tổng Booking Fee"
            value={formatMoney(stats.totalBookingFee)}
            sub="Chi phí KOL"
            icon={<IconWallet />}
            color="bg-orange-50 text-orange-500"
          />
          <StatCard
            label="Tổng GMV"
            value={formatMoney(stats.totalGmv)}
            sub={`ROI ~${roi}%`}
            icon={<IconChart />}
            color="bg-emerald-50 text-emerald-600"
          />
        </div>

        {/* ── KOL Table ─────────────────────────────────────────────── */}
        <KolTable rows={rows} onViewDetail={handleViewDetail} />

      </main>

      {/* ── Detail Drawer (Phase 3) ────────────────────────────────── */}
      <CampaignDetailDrawer
        kol={activeKol}
        onClose={() => setActiveKol(null)}
      />
    </div>
  )
}
