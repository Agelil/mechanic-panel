import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Save, Loader2, CheckCircle2, Bot, Hash, Bell, Link as LinkIcon,
  Copy, Sheet, ToggleLeft, ToggleRight, Users, Phone, MapPin, Clock,
  Globe, Search, Share2, Settings2, ChevronDown, ChevronRight, Star, Lock
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { invalidateSiteSettingsCache } from "@/hooks/use-site-settings";
import { usePermission } from "@/hooks/use-permission";

// ── Types ──────────────────────────────────────────────────────────
type Settings = Record<string, string>;

interface SettingField {
  key: string;
  label: string;
  placeholder?: string;
  hint?: string;
  type?: "text" | "toggle" | "radio" | "textarea";
  options?: { value: string; label: string; desc: string }[];
}

interface SettingSection {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  accent?: boolean;
  fields: SettingField[];
}

// ── Sections config ───────────────────────────────────────────────
const SECTIONS: SettingSection[] = [
  {
    id: "contacts",
    title: "КОНТАКТЫ",
    subtitle: "Название, адрес и контактные данные сервиса",
    icon: <Phone className="w-5 h-5" />,
    fields: [
      { key: "site_name",    label: "Название сервиса",   placeholder: "Сервис-Точка" },
      { key: "site_phone",   label: "Телефон основной",   placeholder: "+7 (999) 000-00-00" },
      { key: "site_phone_2", label: "Телефон доп.",       placeholder: "+7 (999) 111-11-11" },
      { key: "site_email",   label: "Email",              placeholder: "info@service.ru" },
      { key: "site_address", label: "Адрес",              placeholder: "г. Москва, ул. Примерная, 1" },
      { key: "site_hours",   label: "Режим работы (Пн–Сб)", placeholder: "Пн-Сб: 9:00–19:00" },
      { key: "site_hours_sun", label: "Воскресенье",     placeholder: "Вс: выходной" },
      { key: "yandex_maps_url", label: "Ссылка Яндекс.Карты", placeholder: "https://yandex.ru/maps/..." },
    ],
  },
  {
    id: "social",
    title: "СОЦ. СЕТИ",
    subtitle: "Ссылки на соцсети и мессенджеры",
    icon: <Share2 className="w-5 h-5" />,
    fields: [
      { key: "social_vk",               label: "ВКонтакте",       placeholder: "https://vk.com/yourgroup" },
      { key: "social_instagram",        label: "Instagram",        placeholder: "https://instagram.com/..." },
      { key: "social_whatsapp",         label: "WhatsApp (номер)", placeholder: "79991234567", hint: "Только цифры, с кодом страны (7...)" },
      { key: "social_telegram_channel", label: "Telegram-канал",  placeholder: "https://t.me/yourcannel" },
    ],
  },
  {
    id: "modules",
    title: "МОДУЛИ",
    subtitle: "Включение и отключение разделов сайта",
    icon: <Settings2 className="w-5 h-5" />,
    fields: [
      { key: "module_booking",   label: "Онлайн-запись",       type: "toggle", hint: "Форма записи на главной и отдельная страница /booking" },
      { key: "module_portfolio", label: "Портфолио",           type: "toggle", hint: "Раздел с работами на главной странице" },
      { key: "module_reviews",   label: "Отзывы",              type: "toggle", hint: "Блок отзывов на главной странице" },
      { key: "module_cabinet",   label: "Личный кабинет",      type: "toggle", hint: "Страница /cabinet для клиентов" },
      { key: "allow_registration", label: "Регистрация в адм. панели", type: "toggle", hint: "Показывать форму регистрации на /admin/login" },
    ],
  },
  {
    id: "telegram",
    title: "TELEGRAM-БОТ",
    subtitle: "Токен бота и Chat ID для уведомлений",
    icon: <Bot className="w-5 h-5" />,
    accent: true,
    fields: [
      { key: "telegram_bot_token",    label: "Bot Token",         placeholder: "1234567890:AAHdq...", hint: "Получите у @BotFather командой /newbot" },
      { key: "telegram_chat_id",      label: "Chat ID (мастер)",  placeholder: "-100123456789",       hint: "Используйте @userinfobot для получения ID" },
      { key: "telegram_bot_username", label: "Username бота",     placeholder: "your_bot",            hint: "Без символа @, нужен для Login Widget в кабинете" },
      {
        key: "notification_type",
        label: "Кому отправлять уведомления",
        type: "radio",
        options: [
          { value: "master", label: "Только мастеру",          desc: "Уведомления о новых заявках — только вам" },
          { value: "client", label: "Только клиенту",          desc: "Клиент получает уведомления о статусах" },
          { value: "both",   label: "Всем (рекомендуется)",    desc: "Мастер — о заявках, клиент — о статусах" },
        ],
      },
    ],
  },
  {
    id: "integrations",
    title: "ИНТЕГРАЦИИ",
    subtitle: "Google Таблицы и webhook клиентского бота",
    icon: <Sheet className="w-5 h-5" />,
    fields: [
      { key: "google_sheets_enabled", label: "Синхронизация с Google Sheets", type: "toggle", hint: "Новые заявки и смена статусов отправляются в таблицу" },
      { key: "google_sheets_id",      label: "ID Google Таблицы",             placeholder: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms", hint: "Из URL таблицы: /spreadsheets/d/[ID]/edit" },
    ],
  },
  {
    id: "bonuses",
    title: "БОНУСНАЯ СИСТЕМА",
    subtitle: "Кешбэк и ограничения оплаты баллами",
    icon: <Star className="w-5 h-5" />,
    fields: [
      { key: "bonus_percentage", label: "Кешбэк от суммы чека (%)", placeholder: "5", hint: "Процент от итоговой суммы заказа, который начисляется клиенту бонусами при закрытии заказа" },
      { key: "max_bonus_payment_percentage", label: "Макс. % оплаты бонусами (%)", placeholder: "30", hint: "Клиент может оплатить бонусами не более этого процента от суммы заказа" },
    ],
  },
  {
    id: "seo",
    title: "SEO",
    subtitle: "Мета-теги для поисковых систем",
    icon: <Search className="w-5 h-5" />,
    fields: [
      { key: "meta_description", label: "Мета-описание (description)", placeholder: "Профессиональный автосервис...", type: "textarea", hint: "До 160 символов" },
      { key: "meta_keywords",    label: "Ключевые слова (keywords)",   placeholder: "автосервис, ремонт авто, шиномонтаж" },
    ],
  },
];

// ── Component ─────────────────────────────────────────────────────
export default function AdminSettingsPage() {
  const { toast } = useToast();
  const canEdit = usePermission("edit_site_config");
  const canManageBonusRate = usePermission("manage_bonus_rate");
  const canEditTelegram = usePermission("edit_telegram_settings");
  const canEditIntegrations = usePermission("edit_integrations");
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(["contacts", "modules", "telegram"]));

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-bot-webhook`;

  useEffect(() => {
    supabase.from("settings").select("key, value").then(({ data }) => {
      if (data) {
        const map: Settings = {};
        data.forEach((s: { key: string; value: string | null }) => { map[s.key] = s.value || ""; });
        setSettings(map);
      }
      setLoading(false);
    });
  }, []);

  const set = useCallback((key: string, value: string) => {
    setSettings((p) => ({ ...p, [key]: value }));
    setDirty(true);
  }, []);

  const toggle = useCallback((key: string) => {
    setSettings((p) => {
      const next = p[key] === "true" ? "false" : "true";
      return { ...p, [key]: next };
    });
    setDirty(true);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all(
        Object.entries(settings).map(([key, value]) =>
          supabase.from("settings").upsert({ key, value }, { onConflict: "key" })
        )
      );
      toast({ title: "✓ Сохранено", description: "Настройки успешно обновлены." });
      invalidateSiteSettingsCache();
      setDirty(false);
    } catch {
      toast({ title: "Ошибка", description: "Не удалось сохранить настройки.", variant: "destructive" });
    }
    setSaving(false);
  };

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast({ title: "Скопировано!" });
  };

  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) return (
    <div className="flex justify-center py-16">
      <Loader2 className="w-6 h-6 text-orange animate-spin" />
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-4xl tracking-wider">НАСТРОЙКИ САЙТА</h1>
          <p className="font-mono text-sm text-muted-foreground">Конфигурация, контакты, модули и интеграции</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="flex items-center gap-2 bg-orange text-primary-foreground px-6 py-3 font-display text-xl tracking-widest hover:bg-orange-bright transition-colors disabled:opacity-40 shadow-brutal"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
          {saving ? "Сохраняем..." : "Сохранить"}
        </button>
      </div>

      {dirty && (
        <div className="mb-6 flex items-center gap-2 bg-orange/10 border border-orange/30 px-4 py-2">
          <Save className="w-4 h-4 text-orange" />
          <span className="font-mono text-xs text-orange">Есть несохранённые изменения</span>
        </div>
      )}

      <div className="max-w-2xl space-y-3">
        {SECTIONS.map((section) => {
          const isOpen = openSections.has(section.id);
          return (
            <div key={section.id} className="bg-surface border-2 border-border overflow-hidden">
              {/* Section header */}
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center gap-4 p-5 hover:bg-background/50 transition-colors text-left"
              >
                <div className={`w-10 h-10 flex items-center justify-center flex-shrink-0 ${section.accent ? "bg-orange text-primary-foreground" : "bg-orange/10 border border-orange/20 text-orange"}`}>
                  {section.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display text-xl tracking-wider">{section.title}</h3>
                  <p className="font-mono text-xs text-muted-foreground">{section.subtitle}</p>
                </div>
                {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
              </button>

              {/* Section body */}
              {isOpen && (
                <div className="border-t-2 border-border p-5 space-y-4">
                  {section.fields.map((field) => (
                    <SettingField
                      key={field.key}
                      field={field}
                      value={settings[field.key] ?? ""}
                      onChange={(v) => set(field.key, v)}
                      onToggle={() => toggle(field.key)}
                    />
                  ))}

                  {/* Webhook section inside integrations */}
                  {section.id === "integrations" && (
                    <div className="pt-2">
                      <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-2 flex items-center gap-1.5">
                        <LinkIcon className="w-3 h-3 text-orange" />
                        URL вебхука клиентского бота
                      </label>
                      <div className="flex gap-2">
                        <input
                          readOnly
                          value={webhookUrl}
                          className="flex-1 bg-background border-2 border-border px-3 py-2 font-mono text-xs text-muted-foreground focus:outline-none"
                        />
                        <button
                          onClick={copyWebhook}
                          className="px-3 border-2 border-border hover:border-orange hover:text-orange transition-colors"
                          title="Скопировать"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="font-mono text-xs text-muted-foreground mt-1">
                        Зарегистрируйте через: api.telegram.org/bot<span className="text-orange">TOKEN</span>/setWebhook?url=...
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Sticky save bar on mobile */}
      {dirty && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t-2 border-orange/30 flex justify-end sm:hidden z-40">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-orange text-primary-foreground px-6 py-3 font-display text-lg tracking-widest shadow-brutal"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Сохранить
          </button>
        </div>
      )}
    </div>
  );
}

// ── Field renderer ────────────────────────────────────────────────
function SettingField({
  field,
  value,
  onChange,
  onToggle,
}: {
  field: SettingField;
  value: string;
  onChange: (v: string) => void;
  onToggle: () => void;
}) {
  const inputCls = "w-full bg-background border-2 border-border px-4 py-3 font-mono text-sm focus:outline-none focus:border-orange transition-colors";

  if (field.type === "toggle") {
    const isOn = value === "true";
    return (
      <div
        onClick={onToggle}
        className="flex items-center justify-between p-4 border-2 border-border cursor-pointer hover:border-orange/30 transition-colors select-none"
      >
        <div>
          <span className="font-mono text-sm font-bold block">{field.label}</span>
          {field.hint && <span className="font-mono text-xs text-muted-foreground">{field.hint}</span>}
        </div>
        <div className="flex-shrink-0 ml-4">
          {isOn
            ? <ToggleRight className="w-8 h-8 text-orange" />
            : <ToggleLeft className="w-8 h-8 text-muted-foreground" />
          }
        </div>
      </div>
    );
  }

  if (field.type === "radio" && field.options) {
    return (
      <div>
        <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-2">{field.label}</label>
        <div className="space-y-2">
          {field.options.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-start gap-3 p-3 cursor-pointer border-2 transition-colors ${value === opt.value ? "border-orange bg-orange/5" : "border-border hover:border-orange/30"}`}
            >
              <input
                type="radio"
                name={field.key}
                value={opt.value}
                checked={value === opt.value}
                onChange={() => onChange(opt.value)}
                className="mt-0.5 accent-orange flex-shrink-0"
              />
              <div>
                <span className="font-mono text-sm font-bold block">{opt.label}</span>
                <span className="font-mono text-xs text-muted-foreground">{opt.desc}</span>
              </div>
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === "textarea") {
    return (
      <div>
        <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-2">{field.label}</label>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={3}
          className={inputCls + " resize-none"}
        />
        {field.hint && <p className="font-mono text-xs text-muted-foreground mt-1">{field.hint}</p>}
      </div>
    );
  }

  return (
    <div>
      <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-2">{field.label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        className={inputCls}
      />
      {field.hint && <p className="font-mono text-xs text-muted-foreground mt-1">{field.hint}</p>}
    </div>
  );
}
