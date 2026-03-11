/**
 * useAuthGuard — вызывается в AdminLayout.
 *
 * Логика:
 * 1. Пока loading — ничего не делаем (ждём AuthContext)
 * 2. session === null + нет localStorage записи → редирект на логин
 * 3. session === null + есть localStorage запись → тихий refreshSession
 * 4. session есть → проверяем профиль (is_approved, is_blocked)
 * 5. Ошибка JWT в профиле → refreshSession перед редиректом
 */
import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { hasLocalStorageSession } from "@/lib/auth-debug";

const DEV = import.meta.env.DEV;

export function useAuthGuard() {
  const { session, loading, refreshRole } = useAuth();
  const navigate     = useNavigate();
  const location     = useLocation();
  const profileCheck = useRef<string | null>(null); // хранит userId последней проверки

  useEffect(() => {
    if (loading) return; // ждём пока AuthContext инициализируется

    // ── Нет сессии ──────────────────────────────────────────────────────
    if (session === null) {
      if (hasLocalStorageSession()) {
        // Есть запись в localStorage, но контекст ещё не восстановил сессию.
        // Пробуем тихий refresh вместо редиректа.
        if (DEV) console.log("[AuthGuard] session=null but localStorage present — trying silent refresh");
        supabase.auth.refreshSession().then(({ data, error }) => {
          if (error || !data.session) {
            if (DEV) console.log("[AuthGuard] Silent refresh failed — redirecting to login");
            const returnTo = location.pathname + location.search;
            navigate(
              `/admin/login${returnTo !== "/admin" ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`,
              { replace: true }
            );
          }
          // Если refresh успешен — onAuthStateChange в AuthContext сам обновит состояние
        });
        return;
      }

      const returnTo = location.pathname + location.search;
      if (DEV) console.log("[AuthGuard] No session, no localStorage — login redirect, returnTo:", returnTo);
      navigate(
        `/admin/login${returnTo !== "/admin" ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`,
        { replace: true }
      );
      return;
    }

    // ── Есть сессия — проверяем профиль (одобрение) ─────────────────────
    const userId = session.user.id;
    if (profileCheck.current === userId) return; // уже проверяли для этого пользователя
    profileCheck.current = userId;

    const checkProfile = async () => {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("is_approved, is_blocked")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        // JWT истёк или RLS ошибка
        if (error.code === "PGRST301" || error.message?.includes("JWT") || error.message?.includes("invalid")) {
          if (DEV) console.log("[AuthGuard] JWT error on profile check, trying refreshSession...");
          const { data } = await supabase.auth.refreshSession();
          if (data.session) {
            await refreshRole();
            profileCheck.current = null; // сбрасываем, чтобы перепроверить с новым токеном
          } else {
            navigate("/admin/login?expired=1", { replace: true });
          }
        } else {
          if (DEV) console.warn("[AuthGuard] Profile check error:", error.message);
        }
        return;
      }

      if (profile && (!profile.is_approved || profile.is_blocked)) {
        if (DEV) console.log("[AuthGuard] User pending/blocked → /admin/pending");
        navigate("/admin/pending", { replace: true });
      } else {
        if (DEV) console.log("[AuthGuard] Profile OK ✓");
      }
    };

    checkProfile();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, loading]);
}
