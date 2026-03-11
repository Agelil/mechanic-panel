/**
 * useAuthGuard — вызывается в AdminLayout.
 * - Проверяет сессию и одобрение профиля.
 * - При ошибках 401/403 пробует восстановить сессию, иначе редиректит.
 * - Сохраняет текущий путь в returnTo.
 */
import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const DEV = import.meta.env.DEV;

export function useAuthGuard() {
  const { session, loading, refreshRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const checkingProfile = useRef(false);

  // Проверяем профиль (одобрение) когда сессия появилась
  useEffect(() => {
    if (loading) return;

    // Нет сессии — на логин
    if (session === null) {
      const returnTo = location.pathname + location.search;
      if (DEV) console.log("[AuthGuard] No session, redirecting to login. returnTo:", returnTo);
      navigate(`/admin/login${returnTo !== "/admin" ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`, {
        replace: true,
      });
      return;
    }

    if (!session?.user || checkingProfile.current) return;
    checkingProfile.current = true;

    const checkProfile = async () => {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("is_approved, is_blocked")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (error) {
        // 401/403 — пробуем обновить сессию
        if (error.code === "PGRST301" || error.message?.includes("JWT")) {
          if (DEV) console.log("[AuthGuard] JWT error, refreshing session...");
          const { data } = await supabase.auth.refreshSession();
          if (data.session) {
            await refreshRole();
          } else {
            navigate("/admin/login?expired=1", { replace: true });
          }
        }
        checkingProfile.current = false;
        return;
      }

      if (profile && (!profile.is_approved || profile.is_blocked)) {
        if (DEV) console.log("[AuthGuard] User not approved or blocked, redirecting to /admin/pending");
        navigate("/admin/pending", { replace: true });
      }
      checkingProfile.current = false;
    };

    checkProfile();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, loading]);
}
