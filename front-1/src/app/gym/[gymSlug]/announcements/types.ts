export const ANNOUNCEMENT_TYPES = ['CLOSURE', 'HOLIDAY', 'RENOVATION', 'SCHEDULE', 'GENERAL'] as const
export type AnnouncementType = (typeof ANNOUNCEMENT_TYPES)[number]

export interface AnnouncementQuota {
  /** Plan's monthly messages: null = unlimited, 0 = none included */
  limit: number | null
  /** Added every month by active monthly packs */
  monthlyExtra: number
  /** One-time pack messages left (never expire) */
  credits: number
  used: number
  /** Everything still available this month; null = unlimited */
  remaining: number | null
  resetsAt: string
  enabled: boolean
  packsEnabled: boolean
  whatsappReady: boolean
  ownerPhoneSet: boolean
  activeRecipients: number
  membersWithoutPhone: number
  birthdayMessagesEnabled: boolean
  expiryRemindersEnabled: boolean
}

export interface Announcement {
  id: string
  subject: string
  body: string
  type: AnnouncementType
  sentAt: string
  sentCount: number
  failedCount: number
  recipientCount: number
}

export type PackBilling = 'ONCE' | 'MONTHLY'

export interface MessagePack {
  id: string
  name: string
  messages: number
  price: number
  currency: string
  billing: PackBilling
}

export interface MessagePurchase {
  id: string
  packId: string | null
  name: string
  messages: number
  price: number
  currency: string
  billing: PackBilling
  status: 'PENDING' | 'ACTIVE' | 'CANCELLED' | 'REJECTED'
  createdAt: string
}

export interface GymMessagePacks {
  enabled: boolean
  packs: MessagePack[]
  purchases: MessagePurchase[]
}
