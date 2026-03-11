/**
 * auth-debug.ts — Debug Engine (только dev-режим)
 * Декодирует JWT, логирует RLS-статус, проверяет sessionStorage.
 */

const DEV = import.meta.env.DEV;

// ── JWT Decoder (без внешних зависимостей) ──────────────────────
function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const [, payload] = token.split(".");
    const padded = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(padded.padEnd(padded.length + (4 - (padded.length % 4)) % 4, "="));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** Логирует декодированный JWT-токен в консоль */
export function logJwt(token: string, label = "JWT") {
  if (!DEV) return;
  const decoded = decodeJwt(token);
  if (!decoded) { console.warn("[AuthDebug] Failed to decode JWT"); return; }
  const exp = decoded.exp as number | undefined;
  const now = Math.floor(Date.now() / 1000);
  const ttl = exp ? exp - now : null;
  console.groupCollapsed(`[AuthDebug] ${label}`);
  console.log("sub (user_id):", decoded.sub);
  console.log("role (DB)    :", decoded.role);
  console.log("email        :", decoded.email);
  console.log("aal          :", decoded.aal);
  console.log("session_id   :", decoded.session_id);
  if (ttl !== null) {
    console.log(`expires in   : ${ttl}s (${Math.round(ttl / 60)} min)`);
    if (ttl < 300) console.warn("[AuthDebug] ⚠ Token expires in less than 5 minutes!");
  }
  console.groupEnd();
}

/** Логирует auth-событие */
export function logAuthEvent(event: string, userId?: string | null, role?: string | null) {
  if (!DEV) return;
  const ts = new Date().toISOString().slice(11, 23);
  const status = event === "SIGNED_OUT" ? "🔴" : event === "TOKEN_REFRESHED" ? "🔄" : "🟢";
  console.log(
    `[Auth ${ts}] ${status} AUTH_STATE_CHANGE: ${event}`,
    `| user: ${userId ?? "—"}`,
    `| role: ${role ?? "none"}`
  );
}

/** Предупреждает если запрос вернул [] при наличии авторизации */
export function warnEmptyResponse(
  table: string,
  rows: unknown[],
  accessToken: string | undefined
) {
  if (!DEV || rows.length > 0) return;
  if (!accessToken) return;
  console.warn(
    `[AuthDebug] ⚠ Table "${table}" returned empty [] despite authenticated session.`
  );
  logJwt(accessToken, `Token for empty "${table}" response`);
}

/** Ключ sessionStorage для кэша роли */
const ROLE_CACHE_KEY = "auth_role_cache";

interface RoleCache { userId: string; role: string; cachedAt: number }

/** Сохранить роль в sessionStorage (переживает hot-reload, не переживает закрытие вкладки) */
export function cacheRole(userId: string, role: string) {
  try {
    sessionStorage.setItem(ROLE_CACHE_KEY, JSON.stringify({ userId, role, cachedAt: Date.now() }));
  } catch { /* quota exceeded — ignore */ }
}

/** Прочитать роль из sessionStorage (максимум 30 мин) */
export function getCachedRole(userId: string): string | null {
  try {
    const raw = sessionStorage.getItem(ROLE_CACHE_KEY);
    if (!raw) return null;
    const cache: RoleCache = JSON.parse(raw);
    if (cache.userId !== userId) return null;
    if (Date.now() - cache.cachedAt > 30 * 60 * 1000) return null; // expired
    return cache.role;
  } catch { return null; }
}

/** Очистить кэш роли */
export function clearRoleCache() {
  try { sessionStorage.removeItem(ROLE_CACHE_KEY); } catch { /* ignore */ }
}

/** Проверить, есть ли хоть что-то в localStorage от Supabase */
export function hasLocalStorageSession(): boolean {
  try {
    return Object.keys(localStorage).some((k) => k.startsWith("sb-") && k.endsWith("-auth-token"));
  } catch { return false; }
}
