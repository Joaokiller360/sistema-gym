import { apiFetch } from '@/lib/api'
import { normalizeLogoUrl } from '@/lib/utils'
import { defineMessages } from '@/i18n/config'
import { getT } from '@/i18n/server'

interface PlatformSettings {
  saasName: string
  logoUrl: string | null
  footerText: string | null
  footerLinks: Array<{ label: string; url: string }>
  footerShowPoweredBy: boolean
  creatorName: string | null
  creatorUrl: string | null
}

const DEFAULTS: PlatformSettings = {
  saasName: 'GymOS',
  logoUrl: null,
  footerText: null,
  footerLinks: [],
  footerShowPoweredBy: true,
  creatorName: null,
  creatorUrl: null,
}

const footerMessages = defineMessages({
  es: { poweredBy: 'Desarrollado por', createdBy: 'Creado por', links: 'Enlaces del pie de página' },
  en: { poweredBy: 'Powered by', createdBy: 'Created by', links: 'Footer links' },
})

export async function FooterBar() {
  const [fetched, t] = await Promise.all([
    apiFetch<PlatformSettings>('/platform-settings', '', {
      next: { tags: ['platform-settings'], revalidate: 300 },
      // Optional chrome with defaults: an unreachable API shouldn't spam the console
      silent: true,
    }).catch(() => null),
    getT(footerMessages),
  ])
  const settings = { ...DEFAULTS, ...fetched, footerLinks: fetched?.footerLinks ?? [] }

  // Uploads are proxied to the API by a rewrite, which the image optimizer can't fetch
  const logoSrc = normalizeLogoUrl(settings.logoUrl)
  const hasMeta = settings.footerLinks.length > 0 || !!settings.footerText
  if (!settings.footerShowPoweredBy && !settings.creatorName && !hasMeta) return null

  return (
    // Same night tone as the sidebar, so it reads as panel chrome on light and dark pages alike
    <footer className="adm-night shrink-0 border-t border-white/10 bg-adm-night px-4 py-3.5 font-admin text-xs text-[#85857f] sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {settings.footerShowPoweredBy && (
            <span className="inline-flex items-center gap-2">
              {logoSrc && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoSrc} alt="" width={18} height={18} className="size-[18px] rounded object-cover" />
              )}
              {t.poweredBy}
              <span className="font-bold text-[#e7e7e2]">{settings.saasName}</span>
            </span>
          )}
          {settings.creatorName && (
            <span className="inline-flex items-center gap-1">
              {t.createdBy}
              {settings.creatorUrl ? (
                <a
                  href={settings.creatorUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-[#e7e7e2] transition-colors hover:text-adm-brand"
                >
                  {settings.creatorName}
                </a>
              ) : (
                <span className="font-bold text-[#e7e7e2]">{settings.creatorName}</span>
              )}
            </span>
          )}
        </div>

        {hasMeta && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {settings.footerLinks.length > 0 && (
              <nav aria-label={t.links} className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                {settings.footerLinks.map((link, i) => (
                  <a
                    key={i}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-colors hover:text-white"
                  >
                    {link.label}
                  </a>
                ))}
              </nav>
            )}
            {settings.footerText && <span>© {settings.footerText}</span>}
          </div>
        )}
      </div>
    </footer>
  )
}
