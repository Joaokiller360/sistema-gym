// Shared shift palette: index of the group in the gym's list → colors.
export const GROUP_COLORS = [
  { dot: 'bg-amber-500',   tag: 'bg-amber-100 text-amber-800',     active: 'text-amber-800' },
  { dot: 'bg-sky-600',     tag: 'bg-sky-100 text-sky-800',         active: 'text-sky-800' },
  { dot: 'bg-violet-600',  tag: 'bg-violet-100 text-violet-800',   active: 'text-violet-800' },
  { dot: 'bg-emerald-600', tag: 'bg-emerald-100 text-emerald-800', active: 'text-emerald-800' },
  { dot: 'bg-rose-500',    tag: 'bg-rose-100 text-rose-800',       active: 'text-rose-800' },
]

export const NO_GROUP_COLOR = { dot: 'bg-zinc-400', tag: 'bg-adm-chip text-adm-muted', active: 'text-adm-ink' }

export function groupColor(idx: number) {
  return idx < 0 ? NO_GROUP_COLOR : GROUP_COLORS[idx % GROUP_COLORS.length]
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
}
