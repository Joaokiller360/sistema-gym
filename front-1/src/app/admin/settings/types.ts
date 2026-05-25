export interface FooterLink {
  label: string
  url: string
}

export interface PlatformSettings {
  saasName: string
  logoUrl: string | null
  footerText: string | null
  footerLinks: FooterLink[]
  footerShowPoweredBy: boolean
  creatorName: string | null
  creatorUrl: string | null
}

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  saasName: 'GymOS',
  logoUrl: null,
  footerText: null,
  footerLinks: [],
  footerShowPoweredBy: true,
  creatorName: null,
  creatorUrl: null,
}
