/**
 * Which parts of the gym panel each role can open. Shared by the proxy (route guard),
 * the sidebar and the guided tour, so all three always agree.
 */

/** Front-desk sections for invited administrators: serve members and take payments. */
const STAFF_SECTIONS = ['payments', 'members', 'memberships', 'attendance', 'store', 'support', 'account'] as const

/** Roles limited to the front desk; owners and super admins see everything. */
const STAFF_ROLES = new Set(['GYM_ADMIN'])

export function isStaffRole(role: string | undefined): boolean {
  return !!role && STAFF_ROLES.has(role)
}

/** `section` is the path after /gym/[slug]/, e.g. "attendance/scan" or "members". */
export function canAccessSection(role: string | undefined, section: string): boolean {
  if (!isStaffRole(role)) return true
  const root = section.split('/')[0]
  return (STAFF_SECTIONS as readonly string[]).includes(root)
}

/** Where a role lands after login, or when it opens a section it can't use. */
export function gymHomePath(role: string | undefined, gymSlug: string): string {
  return isStaffRole(role) ? `/gym/${gymSlug}/attendance` : `/gym/${gymSlug}/dashboard`
}
