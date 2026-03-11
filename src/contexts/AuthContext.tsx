/**
 * AuthContext — единственный источник правды для сессии и роли.
 *
 * Ключевые принципы:
 * 1. onAuthStateChange регистрируется ПЕРЕД getSession (требование Supabase)
 * 2. Роль кэшируется в sessionStorage — переживает hot-reload и TOKEN_REFRESHED
 * 3. isFetchingRoleRef предотвращает race condition при параллельных вызовах fetchRole
 * 4. Force-refresh каждые 15 мин через supabase.auth.getUser()
 * 5. Cross-tab sync через storage event
 * 6. Dev-логгер с JWT-декодированием
 */
import React, {
  createContext, useContext, useEffect, useRef, useState, useCallback
} from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  logAuthEvent, logJwt, cacheRole, getCachedRole, clearRoleCache, hasLocalStorageSession
} from "@/lib/auth-debug";

export type AppRole = "admin" | "master" | "manager" | null;

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: [
    "view_dashboard", "view_appointments", "edit_appointments",
    "view_services",  "edit_services",
    "view_portfolio", "edit_portfolio",
    "view_promotions","edit_promotions",
    "view_clients",   "edit_clients",
    "view_settings",  "edit_settings",
    "view_categories","edit_categories",
    "view_users",     "edit_users",
  ],
  manager: [
    "view_dashboard", "view_appointments",
    "view_services",  "edit_services",
    "view_portfolio", "edit_portfolio",
    "view_promotions","edit_promotions",
    "view_categories","edit_categories",
  ],
  master: [
    "view_dashboard", "view_appointments", "edit_appointments",
  ],
};

const FORCE_REFRESH_INTERVAL = 15 * 60 * 1000; // 15 минут

interface AuthContextValue {
  session: Session | null | undefined; // undefined = ещё грузится
  user: User | null;
  role: AppRole;
  loading: boolean;
  hasLocalSession: boolean; // есть ли запись в localStorage
  hasPermission: (p: string) => boolean;
  isAtLeast: (min: "master" | "manager" | "admin") => boolean;
  refreshRole: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const DEV = import.meta.env.DEV;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession]   = useState<Session | null | undefined>(undefined);
  const [role, setRole]         = useState<AppRole>(null);
  const [loading, setLoading]   = useState(true);

  // ── refs — не вызывают ре-рендер, не попадают в замыкания устаревшими ──
  const userIdRef         = useRef<string | null>(null);
  const isFetchingRoleRef = useRef(false);   // race-condition guard
  const initializedRef    = useRef(false);   // INITIAL_SESSION уже обработан?

  // ── fetchRole с race-condition защитой и sessionStorage кэшем ──────────
  const fetchRole = useCallback(async (userId: string, force = false): Promise<void> => {
    if (isFetchingRoleRef.current && !force) {
      if (DEV) console.log("[Auth] fetchRole skipped — already in progress");
      return;
    }

    // Сначала отдаём кэшированную роль (мгновенно)
    if (!force) {
      const cached = getCachedRole(userId);
      if (cached) {
        if (DEV) console.log("[Auth] Role from cache:", cached);
        setRole(cached as AppRole);
        return;
      }
    }

    isFetchingRoleRef.current = true;
    if (DEV) console.log("[Auth] Fetching role from DB for", userId);

    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .order("role")
      .limit(1)
      .maybeSingle();

    isFetchingRoleRef.current = false;

    if (error) {
      if (DEV) console.warn("[Auth] Role fetch error:", error.code, error.message);
      // Не сбрасываем роль при сетевой/временной ошибке — используем кэш
      const cached = getCachedRole(userId);
      if (cached) setRole(cached as AppRole);
      return;
    }

    const fetchedRole = (data?.role as AppRole) ?? null;
    if (DEV) console.log("[Auth] Role from DB:", fetchedRole);
    setRole(fetchedRole);
    if (fetchedRole) cacheRole(userId, fetchedRole);
    else clearRoleCache();
  }, []);

  const refreshRole = useCallback(async () => {
    if (userIdRef.current) await fetchRole(userIdRef.current, true);
  }, [fetchRole]);

  // ── Основной эффект авторизации ────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    // ── 1. onAuthStateChange ПЕРЕД getSession ──
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return;

        logAuthEvent(event, newSession?.user?.id, role);

        if (event === "SIGNED_OUT") {
          userIdRef.current = null;
          clearRoleCache();
          setSession(null);
          setRole(null);
          setLoading(false);
          return;
        }

        if (event === "SIGNED_IN") {
          if (newSession?.user) {
            userIdRef.current = newSession.user.id;
            setSession(newSession);
            if (DEV) logJwt(newSession.access_token, "SIGNED_IN token");
            await fetchRole(newSession.user.id);
          }
          setLoading(false);
          return;
        }

        if (event === "TOKEN_REFRESHED") {
          if (newSession?.user) {
            // Обновляем сессию но НЕ сбрасываем роль (токен обновился, роль та же)
            setSession(newSession);
            if (DEV) logJwt(newSession.access_token, "TOKEN_REFRESHED");
          }
          setLoading(false);
          return;
        }

        if (event === "USER_UPDATED") {
          if (newSession?.user) setSession(newSession);
          setLoading(false);
          return;
        }

        if (event === "INITIAL_SESSION") {
          initializedRef.current = true;
          if (newSession?.user) {
            userIdRef.current = newSession.user.id;
            setSession(newSession);
            if (DEV) logJwt(newSession.access_token, "INITIAL_SESSION token");
            await fetchRole(newSession.user.id);
          } else {
            setSession(null);
          }
          setLoading(false);
        }
      }
    );

    // ── 2. getSession — запасной путь если INITIAL_SESSION не сработал ──
    const initTimer = setTimeout(async () => {
      if (!mounted || initializedRef.current) return; // INITIAL_SESSION уже отработал
      if (DEV) console.log("[Auth] INITIAL_SESSION timeout — falling back to getSession()");

      const { data: { session: s }, error } = await supabase.auth.getSession();
      if (!mounted) return;

      if (error || !s) {
        setSession(null);
        setLoading(false);
        return;
      }
      if (userIdRef.current === s.user.id) return; // уже обработано
      userIdRef.current = s.user.id;
      setSession(s);
      await fetchRole(s.user.id);
      if (mounted) setLoading(false);
    }, 800); // ждём 800 мс — если INITIAL_SESSION придёт, он сработает первым

    // ── 3. Force-refresh каждые 15 минут ──
    const forceRefreshTimer = setInterval(async () => {
      if (!mounted) return;
      if (DEV) console.log("[Auth] Force-refresh: calling getUser()");
      const { data: { user }, error } = await supabase.auth.getUser();
      if (!mounted) return;
      if (error || !user) {
        if (DEV) console.warn("[Auth] Force-refresh: user lost, refreshing session...");
        const { data } = await supabase.auth.refreshSession();
        if (!data.session && mounted) {
          if (DEV) console.warn("[Auth] Force-refresh: session not recoverable");
          // Не делаем редирект здесь — useAuthGuard обработает
          setSession(null);
          setRole(null);
          clearRoleCache();
        }
      } else {
        if (DEV) console.log("[Auth] Force-refresh: session OK, user:", user.email);
      }
    }, FORCE_REFRESH_INTERVAL);

    // ── 4. Cross-tab sync через storage event ──
    const handleStorage = (e: StorageEvent) => {
      if (!mounted) return;
      // Supabase хранит токен в ключе sb-*-auth-token
      if (!e.key?.startsWith("sb-")) return;

      if (DEV) console.log("[Auth] Storage event:", e.key, "changed in another tab");

      if (e.newValue === null) {
        // Другая вкладка вышла
        if (DEV) console.log("[Auth] Cross-tab SIGN_OUT detected");
        userIdRef.current = null;
        clearRoleCache();
        setSession(null);
        setRole(null);
      } else if (e.oldValue === null && e.newValue) {
        // Другая вкладка залогинилась
        if (DEV) console.log("[Auth] Cross-tab SIGN_IN detected, refreshing...");
        supabase.auth.getSession().then(({ data: { session: s } }) => {
          if (!mounted || !s) return;
          userIdRef.current = s.user.id;
          setSession(s);
          fetchRole(s.user.id);
        });
      }
    };
    window.addEventListener("storage", handleStorage);

    // ── 5. Visibility change — проверяем при возврате на вкладку ──
    const handleVisibility = () => {
      if (document.hidden || !mounted) return;
      supabase.auth.getSession().then(({ data: { session: s } }) => {
        if (!mounted) return;
        if (!s && userIdRef.current && hasLocalStorageSession()) {
          // Есть localStorage запись, но getSession вернул null — пробуем refresh
          if (DEV) console.log("[Auth] Visibility: session mismatch, trying refreshSession...");
          supabase.auth.refreshSession().then(({ data }) => {
            if (!mounted) return;
            if (data.session) {
              setSession(data.session);
              if (data.session.user.id !== userIdRef.current) {
                userIdRef.current = data.session.user.id;
                fetchRole(data.session.user.id);
              }
            }
          });
        } else if (s && s.user.id !== userIdRef.current) {
          if (DEV) console.log("[Auth] Visibility: new session detected");
          userIdRef.current = s.user.id;
          setSession(s);
          fetchRole(s.user.id);
        }
      });
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(initTimer);
      clearInterval(forceRefreshTimer);
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // fetchRole стабильна через useCallback

  const hasPermission = useCallback((permission: string): boolean => {
    if (!role) return false;
    if (role === "admin") return true;
    return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
  }, [role]);

  const isAtLeast = useCallback((minRole: "master" | "manager" | "admin"): boolean => {
    const hierarchy = { admin: 3, manager: 2, master: 1 };
    return (role ? (hierarchy[role] ?? 0) : 0) >= hierarchy[minRole];
  }, [role]);

  const signOut = useCallback(async () => {
    clearRoleCache();
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider value={{
      session,
      user:           session?.user ?? null,
      role,
      loading,
      hasLocalSession: hasLocalStorageSession(),
      hasPermission,
      isAtLeast,
      refreshRole,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
