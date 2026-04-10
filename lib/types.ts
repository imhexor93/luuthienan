export type Platform = 'TikTok' | 'Shopee' | 'Both'
export type KolStatus = 'ACTIVE' | 'INACTIVE' | 'BLACKLIST'
export type CollabType = 'VIDEO_REVIEW' | 'LIVESTREAM' | 'AFFILIATE' | 'COMBO' | 'OTHER'
export type CampaignStatus = 'PLANNED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED'

export interface Campaign {
  id: string
  kol_id: string
  campaign_name: string
  collaboration_date: string // ISO date string YYYY-MM-DD
  pic: string
  collab_type: CollabType
  platform: Platform
  booking_fee: number  // VND
  gmv?: number         // VND - Gross Merchandise Value
  views?: number
  clicks?: number
  orders?: number
  revenue?: number     // VND - actual revenue received
  status: CampaignStatus
  notes?: string
}

export interface Kol {
  id: string
  name: string
  channel_url: string
  platform: Platform
  category?: string
  follower_count?: number
  contact?: string
  status: KolStatus
  notes?: string
  campaigns: Campaign[]
}

// Derived type used for rendering dashboard rows
export interface KolDashboardRow {
  id: string
  stt: number
  name: string
  channel_url: string
  platform: Platform
  category?: string
  status: KolStatus
  total_campaigns: number
  collab_types: CollabType[]
  pics: string[]
  total_booking_fee: number
  total_gmv: number
  gmv_per_campaign: number
}
