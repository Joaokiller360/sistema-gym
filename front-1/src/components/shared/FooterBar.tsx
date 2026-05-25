import { apiFetch } from '@/lib/api'

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

export async function FooterBar() {
  const settings = await apiFetch<PlatformSettings>('/platform-settings', '', {
    next: { tags: ['platform-settings'] },
  }).catch(() => null) ?? DEFAULTS

  const hasContent =
    settings.footerShowPoweredBy ||
    !!settings.footerText ||
    settings.footerLinks.length > 0 ||
    !!settings.creatorName

  if (!hasContent) return null

  return (
    <footer className="shrink-0 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-6 py-3 text-xs text-zinc-400 dark:text-zinc-500 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-4 flex-wrap">
        {settings.footerShowPoweredBy && (
          <span className="flex items-center gap-1.5">
            {settings.logoUrl && (
              <img src={settings.logoUrl} alt={settings.saasName} className="h-4 w-4 rounded object-cover" />
            )}
            Desarrollado por{' '}
            <span className="font-semibold text-zinc-600 dark:text-zinc-400">
              {settings.saasName}
            </span>
          </span>
        )}
        {settings.creatorName && (
          <span>
            Creado por{' '}
            {settings.creatorUrl ? (
              <a
                href={settings.creatorUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-zinc-600 dark:text-zinc-400 hover:text-[#1fad9d] transition-colors"
              >
                {settings.creatorName}
              </a>
            ) : (
              <span className="font-semibold text-zinc-600 dark:text-zinc-400">{settings.creatorName}</span>
            )}
          </span>
        )}
      </div>

      <div>
        {settings.footerText && (
          <span className='font-semibold text-zinc-500 dark:text-zinc-400'>@ {settings.footerText}</span>
        )}
      </div>

      {settings.footerLinks.length > 0 && (
        <div className="flex items-center gap-4 flex-wrap">
          {settings.footerLinks.map((link, i) => (
            <a
              key={i}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
            >
              {link.label}
            </a>
          ))}
        </div>
      )}
    </footer>
  )
}
