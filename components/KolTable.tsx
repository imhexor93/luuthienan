'use client'

import { useState, useMemo } from 'react'
import { KolDashboardRow } from '@/lib/types'
import { formatMoney, formatMoneyFull } from '@/lib/utils'
import { COLLAB_LABEL, COLLAB_COLOR, STATUS_CONFIG } from '@/lib/constants'

// ─── External Link Icon ───────────────────────────────────────────────────────

function IconExternal() {
  return (
    <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  )
}

function IconChevronRight() {
  return (
    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
    </svg>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface KolTableProps {
  rows: KolDashboardRow[]
  onViewDetail: (id: string) => void
}

export default function KolTable({ rows, onViewDetail }: KolTableProps) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase()
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.category ?? '').toLowerCase().includes(q) ||
        r.pics.some((p) => p.toLowerCase().includes(q))
    )
  }, [rows, search])

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Table header bar */}
      <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="font-semibold text-gray-900">Danh sách KOL/KOC</h2>
          <p className="text-xs text-gray-400 mt-0.5">{filtered.length} influencer</p>
        </div>
        <div className="relative">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none"
            stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
          </svg>
          <input
            type="text"
            placeholder="Tìm theo tên, ngành hàng, PIC..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg w-full sm:w-72
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              placeholder:text-gray-400"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider w-12">
                STT
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider min-w-[180px]">
                Tên KOL/KOC
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Link Kênh
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider w-24">
                Số lần HT
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider min-w-[200px]">
                Loại hình HT
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                PIC
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider min-w-[130px]">
                Tổng Booking Fee
              </th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider min-w-[160px]">
                Hiệu quả HT
                <span className="block font-normal normal-case text-gray-300">(GMV / Lần)</span>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-16 text-center text-gray-400 text-sm">
                  Không tìm thấy KOL/KOC phù hợp
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-blue-50/40 transition-colors duration-100 group"
                >
                  {/* STT */}
                  <td className="px-4 py-4 text-center text-gray-400 text-xs font-mono">
                    {String(row.stt).padStart(2, '0')}
                  </td>

                  {/* Tên KOL */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_CONFIG[row.status].dot}`}
                        title={STATUS_CONFIG[row.status].label}
                      />
                      <div>
                        <div className="font-medium text-gray-900 leading-snug">{row.name}</div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {row.platform} {row.category ? `· ${row.category}` : ''}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Link kênh */}
                  <td className="px-4 py-4">
                    <a
                      href={row.channel_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800
                        text-xs font-medium hover:underline transition-colors"
                    >
                      <IconExternal />
                      Xem kênh
                    </a>
                  </td>

                  {/* Số lần hợp tác */}
                  <td className="px-4 py-4 text-center">
                    <span
                      className="inline-flex items-center justify-center w-8 h-8 rounded-full
                        bg-indigo-50 text-indigo-600 font-bold text-sm border border-indigo-100"
                    >
                      {row.total_campaigns}
                    </span>
                  </td>

                  {/* Loại hình hợp tác */}
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-1">
                      {row.collab_types.map((type) => (
                        <span
                          key={type}
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${COLLAB_COLOR[type]}`}
                        >
                          {COLLAB_LABEL[type]}
                        </span>
                      ))}
                    </div>
                  </td>

                  {/* PIC */}
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-1">
                      {row.pics.map((pic) => (
                        <span
                          key={pic}
                          className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md text-xs"
                        >
                          {pic}
                        </span>
                      ))}
                    </div>
                  </td>

                  {/* Tổng booking fee */}
                  <td className="px-4 py-4 text-right">
                    <span className="font-medium text-gray-800 tabular-nums">
                      {formatMoney(row.total_booking_fee)}
                    </span>
                  </td>

                  {/* Hiệu quả HT — GMV/Lần (clickable) */}
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => onViewDetail(row.id)}
                      title={`Tổng GMV: ${formatMoneyFull(row.total_gmv)}\nSố chiến dịch: ${row.total_campaigns}\nNhấn để xem chi tiết`}
                      className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800
                        font-semibold tabular-nums cursor-pointer
                        hover:underline underline-offset-2 transition-colors"
                    >
                      {formatMoney(row.gmv_per_campaign)}
                      <IconChevronRight />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      {filtered.length > 0 && (
        <div className="px-6 py-3 border-t border-gray-50 bg-gray-50/50 flex items-center justify-between">
          <span className="text-xs text-gray-400">
            Hiển thị {filtered.length} / {rows.length} KOL/KOC
          </span>
          <span className="text-xs text-gray-400">
            * GMV/Lần = Tổng GMV ÷ Số lần hợp tác
          </span>
        </div>
      )}
    </div>
  )
}
