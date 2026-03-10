import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Save, Loader2, CheckCircle2, Bot, Hash } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Setting {
  key: string;
  value: string | null;
  description: string | null;
}

export default function AdminSettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Record<string, string>>({
    telegram_bot_token: "",
    telegram_chat_id: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("settings").select("key, value, description");
      if (data) {
        const map: Record<string, string> = {};
        data.forEach((s: Setting) => { map[s.key] = s.value || ""; });
        setSettings((prev) => ({ ...prev, ...map }));
      }
      setLoading(false);
    }
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = Object.entries(settings).map(([key, value]) =>
        supabase.from("settings").upsert({ key, value }, { onConflict: "key" })
      );
      await Promise.all(updates);
      toast({ title: "Сохранено", description: "Настройки успешно обновлены." });
    } catch {
      toast({ title: "Ошибка", description: "Не удалось сохранить настройки.", variant: "destructive" });
    }
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-orange animate-spin" /></div>;

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-4xl tracking-wider">НАСТРОЙКИ</h1>
        <p className="font-mono text-sm text-muted-foreground">Конфигурация уведомлений и интеграций</p>
      </div>

      <div className="max-w-xl space-y-6">
        {/* Telegram section */}
        <div className="bg-surface border-2 border-border p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-orange/10 border border-orange/30 flex items-center justify-center">
              <Bot className="w-5 h-5 text-orange" />
            </div>
            <div>
              <h3 className="font-display text-2xl tracking-wider">TELEGRAM-БОТ</h3>
              <p className="font-mono text-xs text-muted-foreground">Уведомления о новых заявках</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2 font-mono text-xs text-muted-foreground uppercase tracking-widest mb-2">
                <Bot className="w-3 h-3 text-orange" />
                Bot Token
              </label>
              <input
                type="text"
                value={settings.telegram_bot_token}
                onChange={(e) => setSettings((p) => ({ ...p, telegram_bot_token: e.target.value }))}
                placeholder="1234567890:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw"
                className="w-full bg-background border-2 border-border px-4 py-3 font-mono text-sm focus:outline-none focus:border-orange transition-colors"
              />
              <p className="font-mono text-xs text-muted-foreground mt-1">
                Получите токен у @BotFather в Telegram
              </p>
            </div>

            <div>
              <label className="flex items-center gap-2 font-mono text-xs text-muted-foreground uppercase tracking-widest mb-2">
                <Hash className="w-3 h-3 text-orange" />
                Chat ID
              </label>
              <input
                type="text"
                value={settings.telegram_chat_id}
                onChange={(e) => setSettings((p) => ({ ...p, telegram_chat_id: e.target.value }))}
                placeholder="-100123456789 или 123456789"
                className="w-full bg-background border-2 border-border px-4 py-3 font-mono text-sm focus:outline-none focus:border-orange transition-colors"
              />
              <p className="font-mono text-xs text-muted-foreground mt-1">
                Используйте @userinfobot для получения вашего Chat ID
              </p>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-orange/5 border-2 border-orange/20 p-5">
          <h4 className="font-display text-lg tracking-wider text-orange mb-3">КАК НАСТРОИТЬ TELEGRAM-БОТ</h4>
          <ol className="space-y-2">
            {[
              "Напишите @BotFather в Telegram и создайте нового бота командой /newbot",
              "Скопируйте полученный токен и вставьте в поле «Bot Token» выше",
              "Добавьте бота в нужный чат или оставьте его диалог с вами",
              "Узнайте Chat ID через @userinfobot или @RawDataBot",
              "Сохраните настройки — уведомления начнут приходить мгновенно",
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="font-mono text-xs text-orange border border-orange/30 w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span className="font-mono text-xs text-muted-foreground">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-orange text-primary-foreground px-6 py-3 font-display text-xl tracking-widest hover:bg-orange-bright transition-colors disabled:opacity-50 shadow-brutal"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
          {saving ? "Сохраняем..." : "Сохранить настройки"}
        </button>
      </div>
    </div>
  );
}
