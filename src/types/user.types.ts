// User Role Type Definition
export type UserRole = 'superadmin' | 'admin' | 'faculty' | 'student' | 'employee';

// Valid role values array for validation
export const VALID_ROLES: UserRole[] = ['superadmin', 'admin', 'faculty', 'student', 'employee'];

/**
 * Validates and converts a string to a valid UserRole type
 * @param role - The role string to validate
 * @returns The validated UserRole or undefined if invalid
 */
export function validateUserRole(role: string | null | undefined): UserRole | undefined {
  if (!role) return undefined;
  const normalizedRole = role.toLowerCase().trim();
  return VALID_ROLES.includes(normalizedRole as UserRole) ? (normalizedRole as UserRole) : undefined;
}

/**
 * Safely converts form data role to UserRole type
 * @param roleValue - The role value from form data
 * @returns The validated UserRole or undefined
 */
export function parseRoleFromForm(roleValue: string | null | undefined): UserRole | undefined {
  return validateUserRole(roleValue);
}





