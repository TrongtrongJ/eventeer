import type { UserDto } from '@packages/shared-schemas';
import type { User } from '../entities/user.entity';

/** The only place a User entity becomes an API object: never leaks hashes or tokens. */
export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl ?? undefined,
    role: user.role,
    provider: user.provider,
    isEmailVerified: user.isEmailVerified,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt ? user.updatedAt.toISOString() : null,
  };
}
