'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MoreHorizontal, Pencil, Trash2, Star, Zap, ShoppingCart } from 'lucide-react'

import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plan } from '@/types'

interface PlanCardProps {
  plan: Plan
  gymSlug: string
  onToggleActive?: (id: string, active: boolean) => void
  onDelete?: (id: string) => void
}

export function PlanCard({ plan, gymSlug, onToggleActive, onDelete }: PlanCardProps) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isActive, setIsActive] = useState(plan.isActive)

  function handleToggle(v: boolean) {
    setIsActive(v)
    onToggleActive?.(plan.id, v)
  }

  return (
    <>
      <div className={`relative rounded-2xl border-2 bg-white overflow-hidden transition-all ${
        plan.isFeatured
          ? 'border-[#fffb00] shadow-lg shadow-[#fffb00]/20'
          : 'border-zinc-200 hover:border-zinc-300'
      } ${!isActive ? 'opacity-60' : ''}`}>

        {/* Featured ribbon */}
        {plan.isFeatured && (
          <div className="absolute top-0 right-0 bg-[#fffb00] px-3 py-1 flex items-center gap-1 rounded-bl-xl">
            <Star className="h-3 w-3 text-black" fill="black" />
            <span className="text-xs font-bold text-black">Destacado</span>
          </div>
        )}

        {/* Header */}
        <div className="p-5 pb-3 border-b border-zinc-100">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-base truncate">{plan.name}</h3>
              <div className="mt-3">
                <span className="text-3xl font-black tracking-tight">
                  {plan.price.toLocaleString('es-AR', { style: 'currency', currency: plan.currency })}
                </span>
                <span className="text-sm text-muted-foreground ml-1">/ {plan.durationDays} días</span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0 mt-1">
              <Switch
                checked={isActive}
                onCheckedChange={handleToggle}
                aria-label="Activar plan"
              />
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-zinc-100 hover:text-foreground transition-colors"
                  aria-label="Opciones"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <Link
                      href={`/gym/${gymSlug}/plans?edit=${plan.id}`}
                      className="flex items-center gap-2 w-full"
                    >
                      <Pencil className="h-4 w-4" />
                      Editar
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                    <Trash2 className="h-4 w-4" />
                    Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Zap className="h-4 w-4 text-[#1fad9d]" />
            {plan.daysPerWeek === null
              ? 'Acceso ilimitado'
              : `${plan.daysPerWeek} veces por semana`}
          </div>

          {plan.storeEnabled && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1fad9d]">
              <ShoppingCart className="h-3.5 w-3.5" />
              Incluye tienda
            </div>
          )}

          {plan.benefits.length > 0 && (
            <ul className="space-y-1.5">
              {plan.benefits.map((b, i) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-[#1fad9d]/15 flex items-center justify-center shrink-0 mt-0.5">
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M1.5 4l2 2L6.5 2" stroke="#1fad9d" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                  <span className="text-zinc-700">{b}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar plan?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{plan.name}&rdquo; será eliminado permanentemente. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button variant="destructive" onClick={() => { setDeleteOpen(false); onDelete?.(plan.id) }}>
              Eliminar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
