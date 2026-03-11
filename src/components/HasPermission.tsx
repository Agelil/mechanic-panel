import React from "react";
import { Shield } from "lucide-react";
import { usePermission } from "@/hooks/use-permission";

interface HasPermissionProps {
  permission: string;
  children: React.ReactNode;
  /**
   * fallback — what to render when permission is denied.
   * "hide" (default) = renders nothing
   * "disable" = renders children but wrapped with pointer-events-none + opacity
   * "message" = renders a small "no access" badge
   * React.ReactNode = custom fallback
   */
  fallback?: "hide" | "disable" | "message" | React.ReactNode;
}

/**
 * HasPermission — renders children only if the current user
 * has the specified action permission.
 *
 * Usage:
 *   <HasPermission permission="delete_portfolio">
 *     <button onClick={handleDelete}>Удалить</button>
 *   </HasPermission>
 *
 *   <HasPermission permission="edit_service_price" fallback="disable">
 *     <input ... />
 *   </HasPermission>
 */
export function HasPermission({ permission, children, fallback = "hide" }: HasPermissionProps) {
  const allowed = usePermission(permission);

  if (allowed) return <>{children}</>;

  if (fallback === "hide" || fallback === undefined) return null;

  if (fallback === "disable") {
    return (
      <div
        className="pointer-events-none opacity-30 select-none"
        title="Недостаточно прав"
        aria-disabled="true"
      >
        {children}
      </div>
    );
  }

  if (fallback === "message") {
    return (
      <div className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground border border-border/50 px-2 py-1 opacity-60">
        <Shield className="w-3 h-3" />
        <span>Нет доступа</span>
      </div>
    );
  }

  // Custom fallback node
  return <>{fallback}</>;
}
