import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Save, Loader2, CheckCircle2, Bot, Hash, Bell, Link as LinkIcon, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AdminSettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Record<string, string>>({
    telegram_bot_token: "",
    telegram_chat_id: "",
    notification_type: "both",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-bot-webhook`;

  useEffect(() => {
    supabase.from("settings").select("key, value").then(({ data }) => {
      if (data) {
        const map: Record<string, string> = {};
        data.forEach((s: { key: string; value: string | null }) => { map[s.key] = s.value || ""; });
        setSettings((prev) => ({ ...prev, ...map }));
      }
      setLoading(false);
    });
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

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast({ title: "Скопировано!", description: "URL вебхука скопирован в буфер обмена" });
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-orange animate-spin" /></div>;

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-4xl tracking-wider">НАСТРОЙКИ</h1>
        <p className="font-mono text-sm text-muted-foreground">Конфигурация уведомлений и Telegram-бота</p>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Telegram bot config */}
        <div className="bg-surface border-2 border-border p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-orange/10 border border-orange/20 flex items-center justify-center">
              <Bot className="w-5 h-5 text-orange" />
            </div>
            <div>
              <h3 className="font-display text-2xl tracking-wider">TELEGRAM-БОТ</h3>
              <p className="font-mono text-xs text-muted-foreground">Токен и Chat ID для уведомлений мастеру</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2 font-mono text-xs text-muted-foreground uppercase tracking-widest mb-2">
                <Bot className="w-3 h-3 text-orange" /> Bot Token
              </label>
              <input type="text" value={settings.telegram_bot_token}
                onChange={(e) => setSettings((p) => ({ ...p, telegram_bot_token: e.target.value }))}
                placeholder="1234567890:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw"
                className="w-full bg-background border-2 border-border px-4 py-3 font-mono text-sm focus:outline-none focus:border-orange transition-colors" />
              <p className="font-mono text-xs text-muted-foreground mt-1">Получите у @BotFather командой /newbot</p>
            </div>

            <div>
              <label className="flex items-center gap-2 font-mono text-xs text-muted-foreground uppercase tracking-widest mb-2">
                <Hash className="w-3 h-3 text-orange" /> Chat ID мастера
              </label>
              <input type="text" value={settings.telegram_chat_id}
                onChange={(e) => setSettings((p) => ({ ...p, telegram_chat_id: e.target.value }))}
                placeholder="-100123456789 или 123456789"
                className="w-full bg-background border-2 border-border px-4 py-3 font-mono text-sm focus:outline-none focus:border-orange transition-colors" />
              <p className="font-mono text-xs text-muted-foreground mt-1">Используйте @userinfobot для получения Chat ID</p>
            </div>
          </div>
        </div>

        {/* Notification type */}
        <div className="bg-surface border-2 border-border p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-orange/10 border border-orange/20 flex items-center justify-center">
              <Bell className="w-5 h-5 text-orange" />
            </div>
            <div>
              <h3 className="font-display text-2xl tracking-wider">ТИП УВЕДОМЛЕНИЙ</h3>
              <p className="font-mono text-xs text-muted-foreground">Кому отправлять уведомления при смене статуса</p>
            </div>
          </div>

          <div className="space-y-2">
            {[
              { value: "master", label: "Только мастеру", desc: "Уведомления о новых заявках и изменениях — только вам в Telegram" },
              { value: "client", label: "Только клиенту", desc: "Клиент получает уведомления при смене статуса на «Готово», «Запчасти приехали»" },
              { value: "both", label: "Всем (рекомендуется)", desc: "Мастер получает уведомления о заявках, клиент — об изменениях статуса" },
            ].map((opt) => (
              <label key={opt.value} className={`flex items-start gap-3 p-4 cursor-pointer border-2 transition-colors ${settings.notification_type === opt.value ? "border-orange bg-orange/5" : "border-border hover:border-orange/30"}`}>
                <input type="radio" name="notification_type" value={opt.value}
                  checked={settings.notification_type === opt.value}
                  onChange={(e) => setSettings((p) => ({ ...p, notification_type: e.target.value }))}
                  className="mt-0.5 accent-orange flex-shrink-0" />
                <div>
                  <span className="font-mono text-sm font-bold block">{opt.label}</span>
                  <span className="font-mono text-xs text-muted-foreground">{opt.desc}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Webhook URL for client bot */}
        <div className="bg-surface border-2 border-border p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-orange/10 border border-orange/20 flex items-center justify-center">
              <LinkIcon className="w-5 h-5 text-orange" />
            </div>
            <div>
              <h3 className="font-display text-2xl tracking-wider">ВЕБХУК КЛИЕНТСКОГО БОТА</h3>
              <p className="font-mono text-xs text-muted-foreground">Зарегистрируйте этот URL в Telegram для клиентских команд</p>
            </div>
          </div>

          <div className="flex gap-2">
            <input readOnly value={webhookUrl}
              className="flex-1 bg-background border-2 border-border px-3 py-2 font-mono text-xs text-muted-foreground focus:outline-none" />
            <button onClick={copyWebhook} className="px-3 border-2 border-border hover:border-orange hover:text-orange transition-colors">
              <Copy className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-4 bg-orange/5 border border-orange/20 p-4">
            <p className="font-mono text-xs text-muted-foreground leading-relaxed">
              <span className="text-orange font-bold">Как зарегистрировать вебхук:</span><br />
              Откройте в браузере следующий URL (замените TOKEN на ваш Bot Token):<br />
              <code className="text-orange break-all">https://api.telegram.org/bot<span className="text-foreground">TOKEN</span>/setWebhook?url=<span className="text-foreground">{webhookUrl}</span></code>
            </p>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-orange/5 border-2 border-orange/20 p-5">
          <h4 className="font-display text-lg tracking-wider text-orange mb-3">БЫСТРЫЙ СТАРТ</h4>
          <ol className="space-y-2">
            {[
              "Создайте бота через @BotFather и получите токен",
              "Вставьте токен в поле «Bot Token» выше",
              "Узнайте ваш Chat ID через @userinfobot и вставьте в «Chat ID мастера»",
              "Выберите тип уведомлений",
              "Нажмите «Сохранить настройки»",
              "Зарегистрируйте вебхук для клиентского бота (команда /status [телефон])",
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="font-mono text-xs text-orange border border-orange/30 w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                <span className="font-mono text-xs text-muted-foreground">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 bg-orange text-primary-foreground px-6 py-3 font-display text-xl tracking-widest hover:bg-orange-bright transition-colors disabled:opacity-50 shadow-brutal">
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
          {saving ? "Сохраняем..." : "Сохранить настройки"}
        </button>
      </div>
    </div>
  );
}
