import type { UserDto } from '@packages/shared-schemas';

export function canAccess(role: UserDto['role'] | undefined, requireRole?: string | string[]) {
  if (!requireRole) return true;
  if (!role) return false;
  return Array.isArray(requireRole) ? requireRole.includes(role) : role === requireRole;
}
