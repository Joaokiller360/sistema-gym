import Image from 'next/image'

interface TenantHeaderProps {
  gymName: string
  gymLogo?: string
}

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

export function TenantHeader({ gymName, gymLogo }: TenantHeaderProps) {
  return (
    <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
      <div className="h-9 w-9 rounded-xl bg-[#fffb00] flex items-center justify-center shrink-0 overflow-hidden relative">
        {gymLogo ? (
          <Image src={gymLogo} alt={gymName} fill className="object-cover" sizes="36px" />
        ) : (
          <span className="text-black font-black text-sm">{initials(gymName)}</span>
        )}
      </div>
      <div className="leading-none min-w-0">
        <p className="font-bold text-sm text-white truncate">{gymName}</p>
        <p className="text-xs text-white/40 mt-0.5">Panel de gestión</p>
      </div>
    </div>
  )
}
