/**
 * useUserRole — тонкая обёртка над AuthContext.
 * Существует для обратной совместимости со страницами, которые его импортируют.
 * НЕ создаёт своих подписок, не делает запросов — только читает из контекста.
 */
import { useAuth, AppRole, ROLE_PERMISSIONS } from "@/contexts/AuthContext";

export type { AppRole };
export { ROLE_PERMISSIONS };

export function useUserRole() {
  const { role, loading, isOwner, hasPermission, groupDisplayName } = useAuth();

  const isAtLeast = (minRole: "master" | "manager" | "admin"): boolean => {
    const hierarchy = { admin: 3, manager: 2, master: 1 };
    const userLevel = role ? (hierarchy[role] ?? 0) : 0;
    return userLevel >= hierarchy[minRole];
  };

  return { role, loading, hasPermission, isAtLeast, isOwner, groupDisplayName };
}
