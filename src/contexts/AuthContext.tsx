/**
 * AuthContext v3 — useReducer + чистая state machine.
 *
 * КЛЮЧЕВЫЕ ИСПРАВЛЕНИЯ:
 * 1. onAuthStateChange НЕ async — убирает deadlock и race condition в React
 * 2. fetchRole запускается ОТДЕЛЬНО вне обработчика через startTransition-подобный паттерн
 * 3. useReducer вместо нескольких useState — атомарные обновления, нет рассинхронизации
 * 4. Роль кэшируется в sessionStorage — переживает TOKEN_REFRESHED без сброса
 * 5. Таймаут 800мс как fallback если INITIAL_SESSION не пришёл (StrictMode)
 */
import React, {
  createContext, useContext, useEffect, useRef, useReducer, useCallback
} from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  logAuthEvent, logJwt, cacheRole, getCachedRole, clearRoleCache, hasLocalStorageSession
} from "@/lib/auth-debug";

// ── Types ────────────────────────────────────────────────────────────────────
export type AppRole = "admin" | "master" | "manager" | null;

// DB-driven permissions — loaded per user based on their role
// This map is populated after role is fetched
const dbPermissionsCache = new Map<string, Set<string>>(); // userId → Set<permission>

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: [
    "view_dashboard", "view_appointments", "edit_appointments", "delete_appointments",
    "view_appointment_price", "edit_appointment_status", "edit_appointment_services",
    "view_supply", "create_supply_order", "edit_supply_order", "approve_supply_order", "delete_supply_order",
    "view_services", "edit_services", "delete_services", "edit_service_price",
    "view_categories", "edit_categories", "delete_categories",
    "view_portfolio", "edit_portfolio", "delete_portfolio", "publish_portfolio",
    "view_promotions", "edit_promotions", "delete_promotions",
    "view_clients", "edit_clients", "delete_clients", "view_client_history",
    "view_reviews", "edit_reviews", "publish_reviews", "delete_reviews",
    "view_users", "edit_users", "approve_user", "block_user", "assign_role",
    "view_settings", "edit_settings", "edit_contacts", "edit_telegram_settings", "edit_integrations",
    "view_system", "view_audit_log",
    "view_groups", "edit_groups", "delete_groups",
    "view_permissions", "edit_permissions",
    "view_revenue", "view_prices", "view_finances",
    "manage_wiki",
  ],
  manager: [
    "view_dashboard", "view_appointments", "edit_appointments", "edit_appointment_status",
    "edit_appointment_services", "view_appointment_price",
    "view_supply", "create_supply_order", "edit_supply_order", "approve_supply_order",
    "view_services", "edit_services", "edit_service_price",
    "view_categories", "edit_categories",
    "view_portfolio", "edit_portfolio", "publish_portfolio",
    "view_promotions", "edit_promotions",
    "view_clients", "edit_clients", "view_client_history",
    "view_reviews", "publish_reviews",
    "view_users", "view_settings", "view_revenue", "view_prices", "view_finances",
  ],
  master: ["view_dashboard", "view_appointments", "edit_appointment_status", "view_supply", "create_supply_order"],
};

// ── State Machine ─────────────────────────────────────────────────────────────
type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthState {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  role: AppRole;
}

type AuthAction =
  | { type: "LOADING" }
  | { type: "AUTHENTICATED"; session: Session }
  | { type: "UNAUTHENTICATED" }
  | { type: "ROLE_SET"; role: AppRole }
  | { type: "SESSION_REFRESHED"; session: Session };

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "LOADING":
      return { ...state, status: "loading" };

    case "AUTHENTICATED":
      return {
        status: "authenticated",
        session: action.session,
        user: action.session.user,
        role: state.role, // сохраняем роль если уже была загружена
      };

    case "SESSION_REFRESHED":
      // Только обновляем токен, НЕ сбрасываем роль
      return { ...state, session: action.session, user: action.session.user };

    case "ROLE_SET":
      return { ...state, role: action.role };

    case "UNAUTHENTICATED":
      return { status: "unauthenticated", session: null, user: null, role: null };

    default:
      return state;
  }
}

const initialState: AuthState = {
  status: "loading",
  session: null,
  user: null,
  role: null,
};

// ── Context ───────────────────────────────────────────────────────────────────
const OWNER_EMAIL = "maxfor1997@gmail.com";

interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  role: AppRole;
  loading: boolean;
  hasLocalSession: boolean;
  isOwner: boolean;
  hasPermission: (p: string) => boolean;
  isAtLeast: (min: "master" | "manager" | "admin") => boolean;
  refreshRole: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const DEV = import.meta.env.DEV;
const FORCE_REFRESH_MS = 15 * 60 * 1000;

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Refs для доступа к актуальным значениям без пересоздания функций
  const currentUserIdRef  = useRef<string | null>(null);
  const roleFetchedRef    = useRef<string | null>(null); // userId для которого роль уже загружена
  const initDoneRef       = useRef(false);

  // ── fetchRole — вызывается СНАРУЖИ onAuthStateChange ─────────────────────
  const fetchRole = useCallback(async (userId: string, force = false): Promise<void> => {
    // Не перезапрашиваем роль если она уже загружена для этого пользователя
    if (!force && roleFetchedRef.current === userId) {
      if (DEV) console.log("[Auth] fetchRole: already loaded for", userId);
      return;
    }

    // Сначала отдаём из кэша (нет задержки UI)
    if (!force) {
      const cached = getCachedRole(userId);
      if (cached) {
        if (DEV) console.log("[Auth] Role from sessionStorage cache:", cached);
        dispatch({ type: "ROLE_SET", role: cached as AppRole });
        roleFetchedRef.current = userId;
        // Still load permissions from DB in background
        supabase
          .from("role_permissions")
          .select("permission")
          .eq("role", cached as "admin" | "manager" | "master")
          .then(({ data }) => {
            if (data) dbPermissionsCache.set(userId, new Set(data.map((d: { permission: string }) => d.permission)));
          });
        return;
      }
    }

    if (DEV) console.log("[Auth] Fetching role from DB for", userId);

    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .order("role")
      .limit(1)
      .maybeSingle();

    if (error) {
      if (DEV) console.warn("[Auth] Role fetch error:", error.code, error.message);
      // При сбое — пробуем кэш, не сбрасываем роль
      const cached = getCachedRole(userId);
      if (cached) dispatch({ type: "ROLE_SET", role: cached as AppRole });
      return;
    }

    const r = (data?.role as AppRole) ?? null;
    if (DEV) console.log("[Auth] Role from DB:", r);
    dispatch({ type: "ROLE_SET", role: r });
    roleFetchedRef.current = userId;
    if (r) {
      cacheRole(userId, r);
      // Load granular permissions from role_permissions table
      const { data: permsData } = await supabase
        .from("role_permissions")
        .select("permission")
        .eq("role", r);
      if (permsData) {
        dbPermissionsCache.set(userId, new Set(permsData.map((d: { permission: string }) => d.permission)));
        if (DEV) console.log("[Auth] Loaded", permsData.length, "permissions for role:", r);
      }
    } else {
      clearRoleCache();
      dbPermissionsCache.delete(userId);
    }
  }, []);

  const refreshRole = useCallback(async () => {
    if (currentUserIdRef.current) {
      roleFetchedRef.current = null; // сбрасываем флаг чтобы перезагрузить
      await fetchRole(currentUserIdRef.current, true);
    }
  }, [fetchRole]);

  // ── Основной эффект ───────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    // Вспомогательная функция — обрабатывает появление сессии
    const handleSession = (session: Session, event: string) => {
      if (!mounted) return;
      const userId = session.user.id;

      if (DEV) logJwt(session.access_token, event);

      if (event === "TOKEN_REFRESHED") {
        // Только обновляем токен, роль НЕ сбрасываем
        dispatch({ type: "SESSION_REFRESHED", session });
        currentUserIdRef.current = userId;
      } else {
        dispatch({ type: "AUTHENTICATED", session });
        currentUserIdRef.current = userId;
        // Загружаем роль асинхронно — НЕ блокируем рендер
        fetchRole(userId);
      }
    };

    // ── 1. onAuthStateChange — СИНХРОННЫЙ, без async ──────────────────────
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        logAuthEvent(event, session?.user?.id);

        if (event === "INITIAL_SESSION") {
          initDoneRef.current = true;
          if (session) {
            handleSession(session, event);
          } else {
            dispatch({ type: "UNAUTHENTICATED" });
          }
          return;
        }

        if (event === "SIGNED_IN") {
          if (session) handleSession(session, event);
          return;
        }

        if (event === "TOKEN_REFRESHED") {
          if (session) handleSession(session, event);
          return;
        }

        if (event === "USER_UPDATED") {
          if (session) dispatch({ type: "SESSION_REFRESHED", session });
          return;
        }

        if (event === "SIGNED_OUT") {
          currentUserIdRef.current = null;
          roleFetchedRef.current = null;
          clearRoleCache();
          dispatch({ type: "UNAUTHENTICATED" });
        }
      }
    );

    // ── 2. Fallback если INITIAL_SESSION не пришёл за 1с (React StrictMode) ──
    const fallbackTimer = setTimeout(async () => {
      if (!mounted || initDoneRef.current) return;
      if (DEV) console.warn("[Auth] INITIAL_SESSION not received in 1s, falling back to getSession()");

      const { data: { session }, error } = await supabase.auth.getSession();
      if (!mounted) return;

      if (error) { dispatch({ type: "UNAUTHENTICATED" }); return; }
      if (session) {
        handleSession(session, "FALLBACK_SESSION");
      } else {
        dispatch({ type: "UNAUTHENTICATED" });
      }
    }, 1000);

    // ── 3. Force-refresh каждые 15 мин ────────────────────────────────────
    const forceRefreshTimer = setInterval(async () => {
      if (!mounted) return;
      const { error } = await supabase.auth.getUser();
      if (!mounted) return;
      if (error) {
        if (DEV) console.warn("[Auth] Force-refresh: getUser failed, trying refreshSession...");
        const { data } = await supabase.auth.refreshSession();
        if (!data.session) {
          if (DEV) console.warn("[Auth] Force-refresh: session not recoverable");
          clearRoleCache();
          dispatch({ type: "UNAUTHENTICATED" });
        }
      }
    }, FORCE_REFRESH_MS);

    // ── 4. Cross-tab sync ─────────────────────────────────────────────────
    const handleStorage = (e: StorageEvent) => {
      if (!mounted || !e.key?.startsWith("sb-")) return;
      if (DEV) console.log("[Auth] Cross-tab storage change:", e.key);

      if (e.newValue === null) {
        currentUserIdRef.current = null;
        roleFetchedRef.current = null;
        clearRoleCache();
        dispatch({ type: "UNAUTHENTICATED" });
      } else if (!e.oldValue && e.newValue) {
        supabase.auth.getSession().then(({ data: { session: s } }) => {
          if (!mounted || !s) return;
          handleSession(s, "CROSS_TAB_SIGNIN");
        });
      }
    };
    window.addEventListener("storage", handleStorage);

    // ── 5. Visibility change — бесшумное восстановление ──────────────────
    const handleVisibility = () => {
      if (document.hidden || !mounted) return;
      supabase.auth.getSession().then(({ data: { session: s } }) => {
        if (!mounted) return;
        if (!s && hasLocalStorageSession()) {
          supabase.auth.refreshSession().then(({ data }) => {
            if (!mounted || !data.session) return;
            handleSession(data.session, "VISIBILITY_REFRESH");
          });
        } else if (s && s.user.id !== currentUserIdRef.current) {
          handleSession(s, "VISIBILITY_SESSION");
        }
      });
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(fallbackTimer);
      clearInterval(forceRefreshTimer);
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Memoized helpers ──────────────────────────────────────────────────────
  const hasPermission = useCallback((permission: string): boolean => {
    const { role } = state;
    if (!role) return false;
    if (role === "admin") return true;
    // Use DB-loaded permissions cache if available, fall back to static map
    const userId = currentUserIdRef.current;
    if (userId && dbPermissionsCache.has(userId)) {
      return dbPermissionsCache.get(userId)!.has(permission);
    }
    return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
  }, [state.role]);

  const isAtLeast = useCallback((minRole: "master" | "manager" | "admin"): boolean => {
    const hierarchy = { admin: 3, manager: 2, master: 1 };
    return (state.role ? (hierarchy[state.role] ?? 0) : 0) >= hierarchy[minRole];
  }, [state.role]);

  const signOut = useCallback(async () => {
    clearRoleCache();
    roleFetchedRef.current = null;
    currentUserIdRef.current = null;
    await supabase.auth.signOut();
  }, []);

  const isOwner = state.user?.email === OWNER_EMAIL;

  return (
    <AuthContext.Provider value={{
      status:         state.status,
      session:        state.session,
      user:           state.user,
      role:           state.role,
      loading:        state.status === "loading",
      hasLocalSession: hasLocalStorageSession(),
      isOwner,
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
