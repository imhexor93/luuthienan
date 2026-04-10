import { CollabType, KolStatus, CampaignPlatform } from './types'

export const COLLAB_LABEL: Record<CollabType, string> = {
  VIDEO_REVIEW: 'Video Review',
  LIVESTREAM:   'Livestream',
  AFFILIATE:    'Affiliate',
  COMBO:        'Combo',
  OTHER:        'Khác',
}

export const COLLAB_COLOR: Record<CollabType, string> = {
  VIDEO_REVIEW: 'bg-purple-100 text-purple-700 border-purple-200',
  LIVESTREAM:   'bg-red-100    text-red-700    border-red-200',
  AFFILIATE:    'bg-emerald-100 text-emerald-700 border-emerald-200',
  COMBO:        'bg-blue-100   text-blue-700   border-blue-200',
  OTHER:        'bg-gray-100   text-gray-600   border-gray-200',
}

// Unified status config used by both KolTable and CampaignDetailDrawer
export const STATUS_CONFIG: Record<KolStatus, { dot: string; label: string; badge: string }> = {
  ACTIVE:    { dot: 'bg-emerald-400', label: 'Đang hợp tác', badge: 'bg-emerald-50 text-emerald-700' },
  INACTIVE:  { dot: 'bg-yellow-400',  label: 'Tạm dừng',     badge: 'bg-yellow-50  text-yellow-700'  },
  BLACKLIST: { dot: 'bg-red-500',     label: 'Blacklist',     badge: 'bg-red-50     text-red-700'     },
}

export const PLATFORM_COLOR: Record<CampaignPlatform, string> = {
  TikTok: 'bg-zinc-900 text-white',
  Shopee: 'bg-orange-500 text-white',
}
