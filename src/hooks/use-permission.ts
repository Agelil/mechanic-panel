import { useAuth } from "@/contexts/AuthContext";

/**
 * usePermission — check if current user has a specific action permission.
 * Admins always have all permissions (server RLS enforces this too).
 */
export function usePermission(permission: string): boolean {
  const { hasPermission } = useAuth();
  return hasPermission(permission);
}

/**
 * usePermissions — check multiple permissions at once.
 * Returns an object { [permission]: boolean }
 */
export function usePermissions<T extends string>(
  permissions: T[]
): Record<T, boolean> {
  const { hasPermission } = useAuth();
  return Object.fromEntries(
    permissions.map((p) => [p, hasPermission(p)])
  ) as Record<T, boolean>;
}
