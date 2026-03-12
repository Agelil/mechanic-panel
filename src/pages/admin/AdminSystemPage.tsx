import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  loadAppConfig, saveConfigToStorage, clearConfigFromStorage,
  pingSupabase, getConfigFromStorage, AppConfig
} from "@/lib/db-config";
import {
  Database, Key, Wifi, WifiOff, Loader2, Save, RotateCcw,
  Shield, AlertTriangle, CheckCircle2, Eye, EyeOff
} from "lucide-react";

export default function AdminSystemPage() {
  const { isAtLeast } = useUserRole();
  const { toast } = useToast();

  const [config, setConfig] = useState<AppConfig>({ supabase_url: "", supabase_key: "", encryption_key: "" });
  const [originalConfig, setOriginalConfig] = useState<AppConfig>({ supabase_url: "", supabase_key: "", encryption_key: "" });
  const [loading, setLoading] = useState(true);
  const [pinging, setPinging] = useState(false);
  const [pingResult, setPingResult] = useState<{ ok: boolean; latency: number; error?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [showEncKey, setShowEncKey] = useState(false);
  const [hasCustomConfig, setHasCustomConfig] = useState(false);

  useEffect(() => {
    loadAppConfig().then((cfg) => {
      setConfig(cfg);
      setOriginalConfig(cfg);
      const ls = getConfigFromStorage();
      setHasCustomConfig(!!(ls.supabase_url || ls.supabase_key || ls.encryption_key));
      setLoading(false);
    });
  }, []);

  const handlePing = async () => {
    setPinging(true);
    setPingResult(null);
    const result = await pingSupabase(config.supabase_url, config.supabase_key);
    setPingResult(result);
    setPinging(false);
  };

  const handleSave = async () => {
    if (!config.supabase_url || !config.supabase_key) {
      toast({ title: "Ошибка", description: "URL и ключ обязательны", variant: "destructive" });
      return;
    }

    setSaving(true);
    // Ping before saving
    const result = await pingSupabase(config.supabase_url, config.supabase_key);
    setPingResult(result);

    if (!result.ok) {
      toast({
        title: "Соединение не установлено",
        description: `Проверьте URL и ключ. ${result.error || ""}`,
        variant: "destructive",
      });
      setSaving(false);
      return;
    }

    saveConfigToStorage(config);
    setOriginalConfig(config);
    setHasCustomConfig(true);
    setSaving(false);
    toast({
      title: "Настройки сохранены",
      description: "Конфигурация применена. Обновите страницу для применения новых параметров.",
    });
  };

  const handleReset = () => {
    clearConfigFromStorage();
    setHasCustomConfig(false);
    setConfig(originalConfig);
    setPingResult(null);
    toast({ title: "Сброс выполнен", description: "Используются параметры по умолчанию (.env)" });
  };

  if (!isAtLeast("admin")) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-30" />
          <p className="font-mono text-sm text-muted-foreground">Только для администраторов</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 text-orange animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-4xl tracking-wider">СИСТЕМНЫЕ НАСТРОЙКИ</h1>
        <p className="font-mono text-sm text-muted-foreground">Конфигурация базы данных и шифрования</p>
      </div>

      {/* Warning */}
      <div className="bg-orange/5 border-2 border-orange/30 p-4 mb-6 flex gap-3">
        <AlertTriangle className="w-5 h-5 text-orange flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-mono text-sm text-orange font-bold">Внимание! Системные настройки</p>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            Изменение URL и ключа базы данных затронет всю работу приложения.
            Настройки сохраняются в localStorage браузера и применяются без пересборки проекта.
            После сохранения обновите страницу.
          </p>
        </div>
      </div>

      {/* Status */}
      {hasCustomConfig && (
        <div className="bg-orange/10 border border-orange/30 px-4 py-3 mb-6 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-orange" />
          <p className="font-mono text-xs text-orange">Активна пользовательская конфигурация из localStorage</p>
        </div>
      )}

      <div className="max-w-2xl space-y-6">
        {/* Database Config */}
        <div className="bg-surface border-2 border-border p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-orange/10 border border-orange/20 flex items-center justify-center">
              <Database className="w-5 h-5 text-orange" />
            </div>
            <div>
              <h3 className="font-display text-2xl tracking-wider">БАЗА ДАННЫХ</h3>
              <p className="font-mono text-xs text-muted-foreground">Supabase URL и анонимный ключ</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-2">
                Supabase URL
              </label>
              <input
                type="url"
                value={config.supabase_url}
                onChange={(e) => setConfig((p) => ({ ...p, supabase_url: e.target.value }))}
                placeholder="https://your-project.supabase.co"
                className="w-full bg-background border-2 border-border px-4 py-3 font-mono text-sm focus:outline-none focus:border-orange transition-colors"
              />
            </div>

            <div>
              <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-2">
                Anon / Publishable Key
              </label>
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={config.supabase_key}
                  onChange={(e) => setConfig((p) => ({ ...p, supabase_key: e.target.value }))}
                  placeholder="eyJhbGciOi..."
                  className="w-full bg-background border-2 border-border px-4 py-3 pr-12 font-mono text-sm focus:outline-none focus:border-orange transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Ping result */}
          {pingResult && (
            <div className={`mt-4 flex items-center gap-2 px-3 py-2 border font-mono text-xs ${pingResult.ok ? "border-green-400/30 bg-green-400/10 text-green-400" : "border-destructive/30 bg-destructive/10 text-destructive"}`}>
              {pingResult.ok ? <CheckCircle2 className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
              {pingResult.ok
                ? `Соединение установлено (${pingResult.latency}ms)`
                : `Ошибка: ${pingResult.error}`}
            </div>
          )}

          <button
            type="button"
            onClick={handlePing}
            disabled={pinging || !config.supabase_url}
            className="mt-4 flex items-center gap-2 font-mono text-xs border-2 border-border px-4 py-2 hover:border-orange hover:text-orange transition-colors disabled:opacity-50"
          >
            {pinging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
            {pinging ? "Проверяем..." : "Проверить соединение"}
          </button>
        </div>

        {/* Encryption Key */}
        <div className="bg-surface border-2 border-border p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-orange/10 border border-orange/20 flex items-center justify-center">
              <Key className="w-5 h-5 text-orange" />
            </div>
            <div>
              <h3 className="font-display text-2xl tracking-wider">КЛЮЧ ШИФРОВАНИЯ</h3>
              <p className="font-mono text-xs text-muted-foreground">AES-256 для ФЗ-152 (ФИО, телефон, VIN)</p>
            </div>
          </div>

          <div>
            <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-2">
              Encryption Key
            </label>
            <div className="relative">
              <input
                type={showEncKey ? "text" : "password"}
                value={config.encryption_key}
                onChange={(e) => setConfig((p) => ({ ...p, encryption_key: e.target.value }))}
                placeholder="Минимум 32 символа рекомендуется"
                className="w-full bg-background border-2 border-border px-4 py-3 pr-12 font-mono text-sm focus:outline-none focus:border-orange transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowEncKey(!showEncKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showEncKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="mt-3 bg-background border border-border p-3">
              <p className="font-mono text-xs text-muted-foreground leading-relaxed">
                <span className="text-orange font-bold">Важно (ФЗ-152):</span> Этот ключ используется для шифрования
                персональных данных (AES-256). Без него данные будут нечитаемы. Храните резервную копию ключа в надёжном месте.
                Смена ключа делает существующие зашифрованные данные недоступными.
              </p>
            </div>
          </div>
        </div>

        {/* Safe Mode info */}
        <div className="bg-surface border-2 border-border p-6">
          <h3 className="font-display text-xl tracking-wider mb-3">SAFE MODE</h3>
          <p className="font-mono text-xs text-muted-foreground leading-relaxed mb-3">
            Если конфигурация не задана — приложение автоматически использует переменные окружения (.env).
            Порядок приоритета:
          </p>
          <ol className="font-mono text-xs space-y-1">
            <li><span className="text-orange">1.</span> localStorage (эта страница)</li>
            <li><span className="text-orange">2.</span> /public/app-config.json (файл на сервере)</li>
            <li><span className="text-orange">3.</span> .env переменные (Safe Mode)</li>
          </ol>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-orange text-primary-foreground px-6 py-3 font-display text-xl tracking-widest hover:bg-orange-bright transition-colors disabled:opacity-50 shadow-brutal"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {saving ? "Проверяем..." : "Сохранить"}
          </button>

          {hasCustomConfig && (
            <button
              onClick={handleReset}
              className="flex items-center gap-2 font-mono text-sm border-2 border-destructive/40 text-destructive px-5 py-3 hover:bg-destructive/10 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Сброс к .env
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
