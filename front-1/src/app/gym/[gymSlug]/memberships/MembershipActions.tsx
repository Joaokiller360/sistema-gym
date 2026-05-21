'use client'

import { MembershipStatus } from '@/types'
import {
  suspendMembershipAction,
  freezeMembershipAction,
  cancelMembershipAction,
  unfreezeMembershipAction,
} from './actions'

interface Props {
  membershipId: string
  status: MembershipStatus
  gymSlug: string
}

export function MembershipActions({ membershipId, status, gymSlug }: Props) {
  const suspend = suspendMembershipAction.bind(null, gymSlug, membershipId)
  const freeze = freezeMembershipAction.bind(null, gymSlug, membershipId)
  const cancel = cancelMembershipAction.bind(null, gymSlug, membershipId)
  const unfreeze = unfreezeMembershipAction.bind(null, gymSlug, membershipId)

  return (
    <div className="flex gap-3 justify-end">
      {status === 'ACTIVE' && (
        <>
          <form action={suspend}>
            <button type="submit" className="text-xs text-amber-600 hover:underline">
              Suspender
            </button>
          </form>
          <form action={freeze}>
            <button type="submit" className="text-xs text-blue-600 hover:underline">
              Congelar
            </button>
          </form>
          <form action={cancel}>
            <button type="submit" className="text-xs text-red-600 hover:underline">
              Cancelar
            </button>
          </form>
        </>
      )}
      {status === 'FROZEN' && (
        <form action={unfreeze}>
          <button type="submit" className="text-xs text-green-600 hover:underline">
            Descongelar
          </button>
        </form>
      )}
      {status === 'SUSPENDED' && (
        <form action={cancel}>
          <button type="submit" className="text-xs text-red-600 hover:underline">
            Cancelar
          </button>
        </form>
      )}
    </div>
  )
}
