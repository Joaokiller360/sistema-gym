import { Card, CardContent } from '@/components/ui/card'
import { LucideIcon } from 'lucide-react'

interface KpiCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  change?: number
  accent?: 'teal' | 'yellow' | 'red'
}

const ACCENT = {
  teal:   { border: 'border-l-[#1fad9d]', icon: 'bg-[#1fad9d]/10 text-[#1fad9d]' },
  yellow: { border: 'border-l-[#fffb00]', icon: 'bg-[#fffb00]/30 text-black' },
  red:    { border: 'border-l-[#ff0000]', icon: 'bg-[#ff0000]/10 text-[#ff0000]' },
}

export function KpiCard({ title, value, icon: Icon, change, accent = 'teal' }: KpiCardProps) {
  const { border, icon } = ACCENT[accent]

  return (
    <Card className={`border-l-4 ${border} rounded-xl shadow-sm`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              {title}
            </p>
            <p className="text-3xl font-black tracking-tight leading-none">{value}</p>
            {change !== undefined && (
              <p className={`text-xs mt-2 font-medium ${change >= 0 ? 'text-[#1fad9d]' : 'text-[#ff0000]'}`}>
                {change >= 0 ? '↑' : '↓'} {Math.abs(change)}% vs mes anterior
              </p>
            )}
          </div>
          <div className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 ${icon}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
