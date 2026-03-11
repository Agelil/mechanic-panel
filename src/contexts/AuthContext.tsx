/**
 * AuthContext — единственный источник правды для сессии и роли.
 * Все компоненты читают отсюда, никто не создаёт свои подписки.
 */
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

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

interface AuthContextValue {
  /** Текущая сессия (null = не залогинен, undefined = ещё грузится) */
  session: Session | null | undefined;
  user: User | null;
  role: AppRole;
  /** true пока идёт первичная загрузка сессии + роли */
  loading: boolean;
  hasPermission: (p: string) => boolean;
  isAtLeast: (min: "master" | "manager" | "admin") => boolean;
  /** Принудительно обновить роль (например, после смены роли в AdminUsers) */
  refreshRole: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const DEV = import.meta.env.DEV;

function devLog(...args: unknown[]) {
  if (DEV) console.log("[Auth]", ...args);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // undefined = ещё не знаем, null = нет сессии, Session = есть
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [role, setRole] = useState<AppRole>(null);
  const [loading, setLoading] = useState(true);

  // Используем ref для userId чтобы не пересоздавать fetchRole в замыканиях
  const userIdRef = useRef<string | null>(null);

  const fetchRole = useCallback(async (userId: string): Promise<void> => {
    devLog("Fetching role for", userId);
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .order("role")
      .limit(1)
      .maybeSingle();

    if (error) {
      devLog("Role fetch error:", error.message);
      // При ошибке RLS/401 — не сбрасываем роль если уже была загружена
      return;
    }

    const fetchedRole = (data?.role as AppRole) ?? null;
    devLog("Role fetched:", fetchedRole);
    setRole(fetchedRole);
  }, []);

  const refreshRole = useCallback(async () => {
    if (userIdRef.current) await fetchRole(userIdRef.current);
  }, [fetchRole]);

  useEffect(() => {
    let mounted = true;

    // ── 1. Подписка ДО getSession (обязательный порядок по документации Supabase) ──
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return;

        devLog("Auth event:", event, "| Session status:", newSession ? "valid" : "null");

        if (event === "SIGNED_OUT") {
          userIdRef.current = null;
          setSession(null);
          setRole(null);
          setLoading(false);
          return;
        }

        if (
          event === "SIGNED_IN"       ||
          event === "TOKEN_REFRESHED" ||
          event === "USER_UPDATED"
        ) {
          if (newSession?.user) {
            setSession(newSession);
            // Подгружаем роль только если userId изменился (логин нового юзера)
            // или при SIGNED_IN (мог появиться новый пользователь)
            if (event === "SIGNED_IN" || userIdRef.current !== newSession.user.id) {
              userIdRef.current = newSession.user.id;
              await fetchRole(newSession.user.id);
            }
          }
          setLoading(false);
          return;
        }

        // INITIAL_SESSION — первая отдача из localStorage
        if (event === "INITIAL_SESSION") {
          if (newSession?.user) {
            userIdRef.current = newSession.user.id;
            setSession(newSession);
            await fetchRole(newSession.user.id);
          } else {
            setSession(null);
          }
          setLoading(false);
        }
      }
    );

    // ── 2. Получаем актуальную сессию ──
    supabase.auth.getSession().then(({ data: { session: s }, error }) => {
      if (!mounted) return;
      if (error) {
        devLog("getSession error:", error.message);
        setSession(null);
        setLoading(false);
        return;
      }
      // Если onAuthStateChange уже отработал с INITIAL_SESSION — не дублируем
      if (s?.user && userIdRef.current !== s.user.id) {
        userIdRef.current = s.user.id;
        setSession(s);
        fetchRole(s.user.id).then(() => {
          if (mounted) setLoading(false);
        });
      } else if (!s) {
        setSession(null);
        setLoading(false);
      }
    });

    // ── 3. Проверка при фокусе вкладки — восстанавливаем сессию если нужно ──
    const handleFocus = () => {
      if (!document.hidden) {
        supabase.auth.getSession().then(({ data: { session: s } }) => {
          if (!mounted) return;
          if (s && s.user.id !== userIdRef.current) {
            devLog("Focus: session restored for", s.user.email);
            userIdRef.current = s.user.id;
            setSession(s);
            fetchRole(s.user.id);
          } else if (!s && userIdRef.current) {
            devLog("Focus: session lost — logging out");
            userIdRef.current = null;
            setSession(null);
            setRole(null);
          }
        });
      }
    };
    document.addEventListener("visibilitychange", handleFocus);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, [fetchRole]);

  // Dev logger: выводит статус при каждом изменении
  useEffect(() => {
    if (!DEV) return;
    devLog(
      `Session status: ${session === undefined ? "loading" : session ? "valid" : "expired"}`,
      `| Current User Role: ${role ?? "none"}`
    );
  }, [session, role]);

  const hasPermission = useCallback((permission: string): boolean => {
    if (!role) return false;
    if (role === "admin") return true;
    return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
  }, [role]);

  const isAtLeast = useCallback((minRole: "master" | "manager" | "admin"): boolean => {
    const hierarchy = { admin: 3, manager: 2, master: 1 };
    const userLevel = role ? (hierarchy[role] ?? 0) : 0;
    return userLevel >= hierarchy[minRole];
  }, [role]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      role,
      loading,
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
