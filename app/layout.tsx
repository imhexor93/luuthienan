import type { Metadata } from 'next'
import './globals.css'
import Providers from '@/components/Providers'

export const metadata: Metadata = {
  title: 'KOL/KOC Hub – Quản lý hợp tác TikTok & Shopee',
  description: 'Hệ thống quản lý thông tin và hiệu quả hợp tác với KOC/KOL nội bộ',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="bg-gray-50 text-gray-900 antialiased min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
