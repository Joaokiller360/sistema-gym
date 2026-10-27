import { LanguageSwitcher } from '@/components/gym/LanguageSwitcher'
import { getT } from '@/i18n/server'
import { ChangePasswordForm } from '../settings/ChangePasswordForm'
import { accountMessages } from './messages'

/** Personal settings for front-desk staff, who can't open the gym's Configuración. */
export default async function AccountPage() {
  const t = await getT(accountMessages)

  return (
    <div className="admin-surface min-h-full bg-adm-ground px-4 pb-14 pt-8 text-adm-ink sm:px-8">
      <div className="mx-auto flex max-w-[720px] flex-col gap-5">
        <header className="space-y-1.5">
          <p className="font-admin-mono text-xs uppercase text-adm-muted">{t.eyebrow}</p>
          <h1 className="text-[34px] font-black leading-tight tracking-[-0.02em]">{t.title}</h1>
          <p className="text-sm text-adm-muted">{t.subtitle}</p>
        </header>
        <LanguageSwitcher />
        <ChangePasswordForm />
      </div>
    </div>
  )
}
