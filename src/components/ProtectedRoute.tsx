import { useAuth } from "@/contexts/AuthContext";
import { ShieldCheck } from "lucide-react";

interface ProtectedRouteProps {
  permission: string;
  children: React.ReactNode;
}

/**
 * ProtectedRoute — blocks page render if user lacks the required permission.
 * Shows a "no access" message instead of the page content.
 * Used inside AdminLayout routes to enforce per-page access control.
 */
export function ProtectedRoute({ permission, children }: ProtectedRouteProps) {
  const { role, hasPermission, loading } = useAuth();

  // Still loading role — show nothing (AdminLayout shows its own spinner)
  if (loading || !role) return null;

  if (!hasPermission(permission)) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-3">
          <ShieldCheck className="w-12 h-12 text-muted-foreground mx-auto opacity-30" />
          <h2 className="font-display text-2xl tracking-wider">ДОСТУП ЗАПРЕЩЁН</h2>
          <p className="font-mono text-sm text-muted-foreground max-w-md">
            У вас нет прав для просмотра этой страницы. Обратитесь к администратору для получения доступа.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
