export const ANNOUNCEMENT_TYPES = ['CLOSURE', 'HOLIDAY', 'RENOVATION', 'SCHEDULE', 'GENERAL'] as const
export type AnnouncementType = (typeof ANNOUNCEMENT_TYPES)[number]

export interface AnnouncementQuota {
  limit: number | null
  used: number
  remaining: number | null
  resetsAt: string
  enabled: boolean
  whatsappReady: boolean
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
