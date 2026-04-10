'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { Campaign } from '@/lib/types'
import { formatMoneyFull } from '@/lib/utils'

// ─── Constants ────────────────────────────────────────────────────────────────

const COLOR_GMV     = '#10b981' // emerald-500
const COLOR_BOOKING = '#f97316' // orange-500

// ─── Y-axis formatter ────────────────────────────────────────────────────────

function fmtY(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1).replace('.0', '')}tỷ`
  }
  if (value >= 1_000_000) {
    return `${Math.round(value / 1_000_000)}tr`
  }
  return value.toLocaleString('vi-VN')
}

// ─── Data shape ───────────────────────────────────────────────────────────────

interface ChartPoint {
  name: string        // "Lần 1", "Lần 2"...
  date: string        // formatted date for tooltip
  campaignName: string
  collabType: string
  bookingFee: number
  gmv: number
  roas: string
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

interface TooltipEntry {
  name: string
  value: number
  fill: string
  payload: ChartPoint
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload

  const roasValue = d.bookingFee > 0 ? d.gmv / d.bookingFee : 0
  const roasColor = roasValue >= 10 ? '#10b981' : roasValue >= 5 ? '#3b82f6' : '#f97316'

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-xl p-4 min-w-[220px] text-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <span className="font-bold text-gray-900">{label}</span>
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-50"
          style={{ color: roasColor }}
        >
          ROAS {d.roas}
        </span>
      </div>
      <p className="text-xs text-gray-400 mb-1">{d.date}</p>
      <p className="text-xs text-gray-500 truncate mb-3 leading-snug">{d.campaignName}</p>

      {/* Metric rows */}
      {payload.map((entry) => (
        <div
          key={entry.name}
          className="flex items-center justify-between gap-4 py-1 border-t border-gray-50"
        >
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-[3px] flex-shrink-0"
              style={{ backgroundColor: entry.fill }}
            />
            <span className="text-xs text-gray-600">{entry.name}</span>
          </div>
          <span
            className="text-xs font-semibold tabular-nums"
            style={{ color: entry.fill }}
          >
            {formatMoneyFull(entry.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Custom Legend ─────────────────────────────────────────────────────────────

interface LegendPayloadItem {
  value: string
  color: string
}

function CustomLegend({ payload }: { payload?: LegendPayloadItem[] }) {
  if (!payload) return null
  return (
    <div className="flex items-center justify-center gap-5 pt-2">
      {payload.map((entry) => (
        <div key={entry.value} className="flex items-center gap-1.5">
          <span
            className="w-3 h-3 rounded-[3px] flex-shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs text-gray-500">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  campaigns: Campaign[]
}

export default function KolTrendChart({ campaigns }: Props) {
  // Sort chronologically so Lần 1 = oldest, Lần N = most recent
  const data: ChartPoint[] = [...campaigns]
    .sort(
      (a, b) =>
        new Date(a.collaboration_date).getTime() -
        new Date(b.collaboration_date).getTime()
    )
    .map((c, i) => {
      const gmv = c.gmv ?? 0
      const roas = c.booking_fee > 0 ? gmv / c.booking_fee : 0
      return {
        name: `Lần ${i + 1}`,
        date: (() => {
          const d = new Date(c.collaboration_date)
          return isNaN(d.getTime())
            ? c.collaboration_date
            : d.toLocaleDateString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              })
        })(),
        campaignName: c.campaign_name,
        collabType: c.collab_type,
        bookingFee: c.booking_fee,
        gmv,
        roas: roas > 0 ? `${roas.toFixed(1)}x` : '–',
      }
    })

  // Detect if GMV trend is growing (used to show a hint label)
  const isGmvGrowing =
    data.length >= 2 &&
    data[data.length - 1].gmv > data[0].gmv

  return (
    <div className="space-y-2">
      {/* Trend hint */}
      {data.length >= 2 && (
        <div className="flex items-center gap-1.5 text-xs">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${
              isGmvGrowing
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-orange-50 text-orange-700'
            }`}
          >
            {isGmvGrowing ? (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            ) : (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                  d="M13 17H5m0 0V9m0 8l8-8 4 4 6-6" />
              </svg>
            )}
            GMV {isGmvGrowing ? 'tăng trưởng' : 'chưa tăng trưởng đều'}
          </span>
          <span className="text-gray-400">so giữa lần đầu và lần gần nhất</span>
        </div>
      )}

      {/* Bar Chart */}
      <ResponsiveContainer width="100%" height={230}>
        <BarChart
          data={data}
          margin={{ top: 6, right: 6, left: 0, bottom: 0 }}
          barCategoryGap="28%"
          barGap={4}
        >
          {/* Subtle grid — horizontal lines only */}
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />

          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
          />

          <YAxis
            tickFormatter={fmtY}
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            width={44}
          />

          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: '#f9fafb', radius: [6, 6, 0, 0] as unknown as number }}
          />

          <Legend content={<CustomLegend />} />

          {/* Booking Fee bars */}
          <Bar
            dataKey="bookingFee"
            name="Phí Booking"
            fill={COLOR_BOOKING}
            radius={[4, 4, 0, 0]}
            maxBarSize={44}
          />

          {/* GMV bars */}
          <Bar
            dataKey="gmv"
            name="GMV"
            fill={COLOR_GMV}
            radius={[4, 4, 0, 0]}
            maxBarSize={44}
          />
        </BarChart>
      </ResponsiveContainer>

      {/* Footnote */}
      <p className="text-[11px] text-gray-400 text-center">
        Hover từng cột để xem chi tiết · Cũ → Mới (trái → phải)
      </p>
    </div>
  )
}
