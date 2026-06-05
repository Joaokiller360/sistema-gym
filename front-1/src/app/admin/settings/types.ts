export interface FooterLink {
  label: string
  url: string
}

export interface LandingFeature {
  title: string
  description: string
}

export interface PlatformSettings {
  saasName: string
  logoUrl: string | null
  footerText: string | null
  footerLinks: FooterLink[]
  footerShowPoweredBy: boolean
  creatorName: string | null
  creatorUrl: string | null
  heroTitle: string | null
  heroSubtitle: string | null
  heroCtaText: string | null
  heroCtaUrl: string | null
  primaryColor: string | null
  landingFeatures: LandingFeature[]
  landingShowPlans: boolean
  termsContent: string | null
  availableSlots: string[]
}

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  saasName: 'GymOS',
  logoUrl: null,
  footerText: null,
  footerLinks: [],
  footerShowPoweredBy: true,
  creatorName: null,
  creatorUrl: null,
  heroTitle: null,
  heroSubtitle: null,
  heroCtaText: null,
  heroCtaUrl: null,
  primaryColor: '#fffb00',
  landingFeatures: [],
  landingShowPlans: true,
  termsContent: null,
  availableSlots: [],
}
