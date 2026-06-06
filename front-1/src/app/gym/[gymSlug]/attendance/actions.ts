'use server'

import { cookies } from 'next/headers'
import { updateTag } from 'next/cache'
import { apiFetch, apiFetchWithError } from '@/lib/api'

async function getToken() {
  const store = await cookies()
  return store.get('session')?.value ?? ''
}

export async function checkInAction(
  gymSlug: string,
  memberId: string,
  groupId?: string,
): Promise<{ error?: string }> {
  if (!memberId.trim()) return { error: 'ID de miembro requerido' }
  const token = await getToken()
  const result = await apiFetchWithError('/attendance/checkin', token, {
    method: 'POST',
    body: JSON.stringify({ memberId, ...(groupId ? { groupId } : {}) }),
    headers: { 'x-gym-slug': gymSlug },
  })
  if ('error' in result) {
    const lower = result.error.toLowerCase()
    const msg = lower.includes('already checked in')
      ? 'El miembro ya tiene una entrada registrada hoy'
      : lower.includes('no active membership')
      ? 'El miembro no tiene una membresía activa'
      : result.error
    return { error: msg }
  }
  updateTag(`attendance-${gymSlug}`)
  return {}
}

export async function checkOutAction(
  gymSlug: string,
  memberId: string,
): Promise<{ error?: string }> {
  const token = await getToken()
  const result = await apiFetch('/attendance/checkout', token, {
    method: 'POST',
    body: JSON.stringify({ memberId }),
    headers: { 'x-gym-slug': gymSlug },
  })
  if (!result) return { error: 'Error al registrar salida' }
  updateTag(`attendance-${gymSlug}`)
  return {}
}

export async function deleteAttendanceAction(
  gymSlug: string,
  attendanceId: string,
): Promise<{ error?: string }> {
  const token = await getToken()
  const result = await apiFetch(`/attendance/${attendanceId}`, token, {
    method: 'DELETE',
    headers: { 'x-gym-slug': gymSlug },
  })
  if (result === null) return { error: 'Error al eliminar registro' }
  updateTag(`attendance-${gymSlug}`)
  return {}
}

export async function createGroupAction(
  gymSlug: string,
  name: string,
): Promise<{ error?: string }> {
  if (!name.trim()) return { error: 'Nombre requerido' }
  const token = await getToken()
  const result = await apiFetch('/attendance/groups', token, {
    method: 'POST',
    body: JSON.stringify({ name: name.trim() }),
    headers: { 'x-gym-slug': gymSlug },
  })
  if (!result) return { error: 'Error al crear grupo' }
  updateTag(`attendance-groups-${gymSlug}`)
  return {}
}

export async function deleteGroupAction(
  gymSlug: string,
  groupId: string,
): Promise<{ error?: string }> {
  const token = await getToken()
  const result = await apiFetch(`/attendance/groups/${groupId}`, token, {
    method: 'DELETE',
    headers: { 'x-gym-slug': gymSlug },
  })
  if (result === null) return { error: 'Error al eliminar grupo' }
  updateTag(`attendance-groups-${gymSlug}`)
  return {}
}
