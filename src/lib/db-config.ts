/**
 * Dynamic DB Config (ФЗ-152 / Safe Mode)
 * Priority: localStorage → public/app-config.json → .env (fallback)
 */

const LS_KEY = "service_tochka_db_config";

export interface AppConfig {
  supabase_url: string;
  supabase_key: string;
  encryption_key: string;
}

const DEFAULT_CONFIG: AppConfig = {
  supabase_url: import.meta.env.VITE_SUPABASE_URL || "",
  supabase_key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
  encryption_key: "",
};

// Synchronous read from localStorage (already loaded at runtime)
export function getConfigFromStorage(): Partial<AppConfig> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

export function saveConfigToStorage(config: Partial<AppConfig>): void {
  localStorage.setItem(LS_KEY, JSON.stringify(config));
}

export function clearConfigFromStorage(): void {
  localStorage.removeItem(LS_KEY);
}

// Async: try to load from /public/app-config.json
export async function loadAppConfig(): Promise<AppConfig> {
  // 1. localStorage takes priority
  const ls = getConfigFromStorage();
  if (ls.supabase_url && ls.supabase_key) {
    return {
      supabase_url: ls.supabase_url,
      supabase_key: ls.supabase_key,
      encryption_key: ls.encryption_key || DEFAULT_CONFIG.encryption_key,
    };
  }

  // 2. Try app-config.json
  try {
    const res = await fetch("/app-config.json", { cache: "no-cache" });
    if (res.ok) {
      const json = await res.json();
      if (json.supabase_url && json.supabase_key) {
        return {
          supabase_url: json.supabase_url,
          supabase_key: json.supabase_key,
          encryption_key: json.encryption_key || DEFAULT_CONFIG.encryption_key,
        };
      }
    }
  } catch { /* Safe Mode: fall through */ }

  // 3. Safe Mode: .env defaults
  return DEFAULT_CONFIG;
}

// Get encryption key (sync, for use in components)
export function getEncryptionKey(): string {
  const ls = getConfigFromStorage();
  return ls.encryption_key || DEFAULT_CONFIG.encryption_key || "SERVICE_TOCHKA_DEFAULT_KEY_2024";
}

/** Returns all known encryption keys to try during decryption (handles key rotation) */
export function getAllEncryptionKeys(): string[] {
  const keys = new Set<string>();
  const ls = getConfigFromStorage();
  if (ls.encryption_key) keys.add(ls.encryption_key);
  if (DEFAULT_CONFIG.encryption_key) keys.add(DEFAULT_CONFIG.encryption_key);
  keys.add("SERVICE_TOCHKA_DEFAULT_KEY_2024");
  // Also try key from sessionStorage (set by settings page)
  try {
    const dbKey = sessionStorage.getItem("encryption_key_from_db");
    if (dbKey) keys.add(dbKey);
  } catch { /* ignore */ }
  return Array.from(keys);
}

// Ping a Supabase URL to test connection
export async function pingSupabase(url: string, key: string): Promise<{ ok: boolean; latency: number; error?: string }> {
  const start = Date.now();
  try {
    const res = await fetch(`${url}/rest/v1/`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    });
    const latency = Date.now() - start;
    if (res.ok || res.status === 200 || res.status === 404) {
      return { ok: true, latency };
    }
    return { ok: false, latency, error: `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, latency: Date.now() - start, error: String(e) };
  }
}
