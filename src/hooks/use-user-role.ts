import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "master" | "manager" | null;

const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: [
    "view_dashboard", "view_appointments", "edit_appointments",
    "view_services", "edit_services", "view_portfolio", "edit_portfolio",
    "view_promotions", "edit_promotions", "view_clients", "edit_clients",
    "view_settings", "edit_settings", "view_categories", "edit_categories",
    "view_users", "edit_users",
  ],
  manager: [
    "view_dashboard", "view_appointments",
    "view_services", "edit_services",
    "view_portfolio", "edit_portfolio",
    "view_promotions", "edit_promotions",
    "view_categories", "edit_categories",
  ],
  master: [
    "view_dashboard", "view_appointments", "edit_appointments",
  ],
};

export function useUserRole() {
  const [role, setRole] = useState<AppRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchRole = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        if (mounted) { setRole(null); setLoading(false); }
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .order("role")
        .limit(1)
        .maybeSingle();

      if (mounted) {
        setRole((data?.role as AppRole) || null);
        setLoading(false);
      }
    };

    fetchRole();
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      fetchRole();
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const hasPermission = (permission: string): boolean => {
    if (!role) return false;
    // Admin always has all permissions
    if (role === "admin") return true;
    return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
  };

  const isAtLeast = (minRole: "master" | "manager" | "admin"): boolean => {
    const hierarchy = { admin: 3, manager: 2, master: 1 };
    const userLevel = role ? (hierarchy[role] ?? 0) : 0;
    const minLevel = hierarchy[minRole];
    return userLevel >= minLevel;
  };

  return { role, loading, hasPermission, isAtLeast };
}
