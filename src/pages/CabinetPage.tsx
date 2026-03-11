import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import {
  Car, FileText, Star, Clock, CheckCircle2, Wrench,
  Package, XCircle, Download, LogOut, User, Phone,
  ChevronRight, Loader2, Shield, Gift, TrendingUp
} from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

interface AppointmentDoc {
  id: string;
  doc_type: string;
  file_url: string;
  file_name: string;
  created_at: string;
}

interface WorkItem {
  name: string;
  price: number;
  type: "part" | "service";
}

interface AppointmentItem {
  id: string;
  car_make: string;
  license_plate: string | null;
  service_type: string;
  status: string;
  created_at: string;
  total_price: number | null;
  parts_cost: number;
  services_cost: number;
  work_items: WorkItem[];
  services: { name: string; price_from: number }[] | null;
  documents?: AppointmentDoc[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType; step: number }> = {
  new:            { label: "Принята",             color: "text-orange",           icon: Clock,        step: 1 },
  processing:     { label: "В работе",            color: "text-blue-400",         icon: Wrench,       step: 2 },
  parts_ordered:  { label: "Запчасти заказаны",   color: "text-yellow-400",       icon: Package,      step: 3 },
  parts_arrived:  { label: "Запчасти прибыли",    color: "text-purple-400",       icon: Package,      step: 4 },
  ready:          { label: "Готово к выдаче!",     color: "text-green-400",        icon: CheckCircle2, step: 5 },
  completed:      { label: "Завершено",           color: "text-muted-foreground", icon: CheckCircle2, step: 6 },
  cancelled:      { label: "Отменена",            color: "text-destructive",      icon: XCircle,      step: 0 },
};

const TIMELINE_STEPS = [
  { key: "new",           label: "Принята" },
  { key: "processing",    label: "В работе" },
  { key: "parts_ordered", label: "Запчасти" },
  { key: "ready",         label: "Готово" },
  { key: "completed",     label: "Завершено" },
];

const DOC_TYPE_LABELS: Record<string, string> = {
  acceptance_act: "Акт приёмки",
  work_order: "Заказ-наряд",
  completion_act: "Акт выполненных работ",
};

const TERMINAL = ["completed", "cancelled"];

export default function CabinetPage() {
  const navigate = useNavigate();
  const [tgUser, setTgUser] = useState<TelegramUser | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [bonusPoints, setBonusPoints] = useState<number>(0);
  const [bonusPct, setBonusPct] = useState<number>(0);
  const [maxBonusPct, setMaxBonusPct] = useState<number>(30);
  const [useBonuses, setUseBonuses] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const [clientName, setClientName] = useState<string | null>(null);
  const [needsName, setNeedsName] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("tg_cabinet_user");
    if (saved) {
      try {
        const user = JSON.parse(saved) as TelegramUser;
        const now = Math.floor(Date.now() / 1000);
        if (now - user.auth_date < 86400) {
          setTgUser(user);
          loadClientData(user);
        } else {
          localStorage.removeItem("tg_cabinet_user");
        }
      } catch { localStorage.removeItem("tg_cabinet_user"); }
    }
  }, []);

  useEffect(() => {
    if (tgUser || !widgetRef.current) return;
    (window as unknown as Record<string, unknown>).onTelegramAuth = (user: TelegramUser) => {
      localStorage.setItem("tg_cabinet_user", JSON.stringify(user));
      setTgUser(user);
      loadClientData(user);
    };
    supabase.from("settings").select("value").eq("key", "telegram_bot_username").maybeSingle().then(({ data }) => {
      const botName = data?.value || "ServiceTochkaBot";
      const script = document.createElement("script");
      script.src = "https://telegram.org/js/telegram-widget.js?22";
      script.setAttribute("data-telegram-login", botName);
      script.setAttribute("data-size", "large");
      script.setAttribute("data-onauth", "onTelegramAuth(user)");
      script.setAttribute("data-request-access", "write");
      script.setAttribute("data-radius", "0");
      script.async = true;
      widgetRef.current?.appendChild(script);
    });
  }, [tgUser]);

  const loadClientData = async (user: TelegramUser) => {
    setLoading(true);
    try {
      const { data: tgSession } = await supabase
        .from("telegram_sessions")
        .select("phone")
        .eq("telegram_id", user.id)
        .maybeSingle();

      const clientPhone = tgSession?.phone || phone;
      if (clientPhone) setPhone(clientPhone);

      // Load settings
      const { data: settings } = await supabase
        .from("settings")
        .select("key, value")
        .in("key", ["max_bonus_payment_percentage", "bonus_percentage"]);
      if (settings) {
        const maxPctSetting = settings.find((s) => s.key === "max_bonus_payment_percentage");
        if (maxPctSetting?.value) setMaxBonusPct(parseFloat(maxPctSetting.value) || 30);
        const bonusPctSetting = settings.find((s) => s.key === "bonus_percentage");
        if (bonusPctSetting?.value) setBonusPct(parseFloat(bonusPctSetting.value) || 0);
      }

      if (clientPhone) {
        const { data: appts } = await supabase
          .from("appointments")
          .select("id, car_make, license_plate, service_type, status, created_at, total_price, services, work_items, parts_cost, services_cost")
          .eq("phone", clientPhone)
          .order("created_at", { ascending: false })
          .limit(50);

        if (appts && appts.length > 0) {
          const apptIds = appts.map((a) => a.id);
          const { data: docs } = await supabase
            .from("appointment_documents")
            .select("*")
            .in("appointment_id", apptIds);

          const apptsWithDocs = appts.map((a) => ({
            ...a,
            services: Array.isArray(a.services) ? a.services as { name: string; price_from: number }[] : null,
            work_items: Array.isArray(a.work_items) ? (a.work_items as unknown as WorkItem[]) : [],
            parts_cost: (a as any).parts_cost ?? 0,
            services_cost: (a as any).services_cost ?? 0,
            documents: docs?.filter((d) => d.appointment_id === a.id) || [],
          }));
          setAppointments(apptsWithDocs);
        }

        const { data: client } = await supabase
          .from("clients")
          .select("bonus_points, name")
          .eq("phone", clientPhone)
          .maybeSingle();
        if (client) {
          setBonusPoints(client.bonus_points || 0);
          setClientName(client.name || null);
          // Check if name has at least 2 words
          const hasFullName = client.name && /^\S+\s+\S+/.test(client.name.trim());
          setNeedsName(!hasFullName);
        } else {
          setNeedsName(true);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("tg_cabinet_user");
    setTgUser(null);
    setAppointments([]);
    setPhone(null);
    setBonusPoints(0);
  };

  const activeOrders = appointments.filter((a) => !TERMINAL.includes(a.status));
  const historyOrders = appointments.filter((a) => TERMINAL.includes(a.status));

  const currentAppt = activeOrders[0] || null;

  const bonusDiscount = (() => {
    if (!currentAppt?.total_price || bonusPoints <= 0) return 0;
    const maxByPct = Math.floor(currentAppt.total_price * maxBonusPct / 100);
    return Math.min(bonusPoints, maxByPct);
  })();

  const bonusForecast = (() => {
    if (!currentAppt?.total_price || bonusPct <= 0) return 0;
    return Math.floor(currentAppt.total_price * bonusPct / 100);
  })();

  // Progress percentage for active order
  const progressPct = (() => {
    if (!currentAppt) return 0;
    const cfg = STATUS_CONFIG[currentAppt.status];
    if (!cfg || cfg.step === 0) return 0;
    // 5 meaningful steps, completed = 100%
    return Math.min(100, Math.round((cfg.step / 6) * 100));
  })();

  return (
    <div className="min-h-screen pt-16 bg-background">
      {/* Header */}
      <section className="relative bg-surface border-b-2 border-border py-12 bg-grid">
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-orange" />
        <div className="container mx-auto px-4">
          <span className="font-mono text-xs text-orange uppercase tracking-widest">// Личный кабинет</span>
          <h1 className="font-display text-5xl md:text-7xl tracking-wider mt-2">
            МОЙ <span className="text-orange">СЕРВИС</span>
          </h1>
          <p className="font-mono text-sm text-muted-foreground mt-3">
            История ремонтов, документы и статусы заказов
          </p>
        </div>
      </section>

      <div className="container mx-auto px-4 py-10">
        {!tgUser ? (
          <div className="max-w-md mx-auto text-center">
            <div className="bg-surface border-2 border-border p-10 shadow-brutal">
              <div className="w-16 h-16 bg-orange/10 border-2 border-orange/20 flex items-center justify-center mx-auto mb-6">
                <Shield className="w-8 h-8 text-orange" />
              </div>
              <h2 className="font-display text-3xl tracking-wider mb-3">ВОЙДИТЕ В КАБИНЕТ</h2>
              <p className="font-mono text-sm text-muted-foreground mb-8 leading-relaxed">
                Для доступа к истории заказов, документам и бонусам.
              </p>
              
              {/* Email login button */}
              <a
                href="/login?returnTo=/cabinet"
                className="w-full inline-flex items-center justify-center gap-2 bg-orange text-primary-foreground px-6 py-3 font-display text-xl tracking-widest hover:bg-orange-bright transition-colors mb-4"
              >
                Войти по Email
              </a>

              {/* Telegram widget */}
              <p className="font-mono text-xs text-muted-foreground mb-3">или через Telegram</p>
              <div ref={widgetRef} className="flex justify-center mb-6" />

              <div className="mt-4 bg-orange/5 border border-orange/20 p-4 text-left">
                <p className="font-mono text-xs text-muted-foreground leading-relaxed">
                  <span className="text-orange font-bold">Нет аккаунта?</span>{" "}
                  <a href="/register?returnTo=/cabinet" className="text-orange hover:text-orange-bright underline">Зарегистрироваться</a>
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-8">
            {/* Profile + Bonus */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 bg-surface border-2 border-border p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {tgUser.photo_url ? (
                    <img src={tgUser.photo_url} alt="Avatar" className="w-12 h-12 object-cover border-2 border-orange" />
                  ) : (
                    <div className="w-12 h-12 bg-orange/10 border-2 border-orange/20 flex items-center justify-center">
                      <User className="w-6 h-6 text-orange" />
                    </div>
                  )}
                  <div>
                    <p className="font-display text-2xl tracking-wider">
                      {tgUser.first_name} {tgUser.last_name || ""}
                    </p>
                    {tgUser.username && (
                      <p className="font-mono text-xs text-muted-foreground">@{tgUser.username}</p>
                    )}
                    {phone && (
                      <p className="font-mono text-xs text-orange flex items-center gap-1 mt-1">
                        <Phone className="w-3 h-3" /> {phone}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 font-mono text-xs border border-border px-3 py-2 hover:border-destructive hover:text-destructive transition-colors"
                >
                  <LogOut className="w-3 h-3" />
                  Выйти
                </button>
              </div>

              <div className="bg-surface border-2 border-orange/40 p-5 flex flex-col items-center justify-center gap-1">
                <Gift className="w-6 h-6 text-orange" />
                <span className="font-display text-4xl text-orange">{bonusPoints}</span>
                <span className="font-mono text-xs text-muted-foreground">бонусных баллов</span>
                {bonusPoints > 0 && (
                  <span className="font-mono text-xs text-muted-foreground text-center mt-1">
                    ≈ {formatPrice(bonusPoints)} скидки
                  </span>
                )}
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 text-orange animate-spin" />
              </div>
            ) : !phone ? (
              <PhoneLinkPrompt tgUser={tgUser} onLinked={(p) => { setPhone(p); loadClientData(tgUser); }} />
            ) : needsName ? (
              <NamePrompt phone={phone} currentName={clientName} onSaved={(name) => { setClientName(name); setNeedsName(false); }} />
            ) : appointments.length === 0 ? (
              <div className="text-center py-16 bg-surface border-2 border-dashed border-border">
                <Car className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-30" />
                <p className="font-mono text-sm text-muted-foreground">Заказов не найдено</p>
                <p className="font-mono text-xs text-muted-foreground mt-1">Запишитесь на сервис, чтобы увидеть историю</p>
              </div>
            ) : (
              <>
                {/* ===== ACTIVE ORDER CARD ===== */}
                {currentAppt && (
                  <div>
                    <span className="font-mono text-xs text-orange uppercase tracking-widest block mb-3">
                      // Текущий ремонт
                    </span>
                    <div className="bg-surface border-2 border-orange/50 p-6 shadow-brutal-sm">
                      {/* Header */}
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-orange/10 border border-orange/20 flex items-center justify-center flex-shrink-0">
                          <Car className="w-5 h-5 text-orange" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-display text-3xl tracking-wider">ВАШ АВТОМОБИЛЬ В РАБОТЕ</h3>
                        </div>
                      </div>

                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <p className="font-display text-xl tracking-wider">{currentAppt.car_make}</p>
                          {currentAppt.license_plate && (
                            <span className="font-mono text-sm text-muted-foreground">{currentAppt.license_plate}</span>
                          )}
                        </div>
                        {currentAppt.total_price != null && currentAppt.total_price > 0 && (
                          <div className="text-right">
                            <span className="font-mono text-xs text-muted-foreground block">Стоимость</span>
                            <span className="font-display text-2xl text-orange">
                              {formatPrice(currentAppt.total_price)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Progress Bar */}
                      <div className="mb-2">
                        <div className="flex items-center justify-between mb-1">
                          {(() => {
                            const cfg = STATUS_CONFIG[currentAppt.status];
                            const Icon = cfg?.icon || Clock;
                            return (
                              <span className={`font-mono text-sm font-bold flex items-center gap-1.5 ${cfg?.color || "text-orange"}`}>
                                <Icon className="w-4 h-4" />
                                {cfg?.label || currentAppt.status}
                              </span>
                            );
                          })()}
                          <span className="font-mono text-xs text-muted-foreground">{progressPct}%</span>
                        </div>
                        <Progress value={progressPct} className="h-2" />
                      </div>

                      {/* Timeline dots */}
                      <div className="relative mb-6 mt-4">
                        <div className="flex items-center justify-between relative">
                          <div className="absolute top-3 left-0 right-0 h-0.5 bg-border" />
                          {TIMELINE_STEPS.map((step) => {
                            const cfg = STATUS_CONFIG[step.key];
                            const currentStep = STATUS_CONFIG[currentAppt.status]?.step || 0;
                            const isDone = cfg.step <= currentStep && currentAppt.status !== "cancelled";
                            const isCurrent = step.key === currentAppt.status;
                            return (
                              <div key={step.key} className="relative flex flex-col items-center z-10">
                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                                  isCurrent
                                    ? "border-orange bg-orange"
                                    : isDone
                                    ? "border-green-400 bg-green-400/20"
                                    : "border-border bg-background"
                                }`}>
                                  {isDone && !isCurrent && <div className="w-2 h-2 rounded-full bg-green-400" />}
                                  {isCurrent && <div className="w-2 h-2 rounded-full bg-primary-foreground animate-pulse" />}
                                </div>
                                <span className="font-mono text-xs text-muted-foreground mt-2 hidden sm:block text-center" style={{ fontSize: "10px" }}>
                                  {step.label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Work items list */}
                      {currentAppt.work_items.length > 0 && (
                        <div className="border-t-2 border-border pt-4 mb-4">
                          <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-2">Работы и запчасти</p>
                          <div className="space-y-1">
                            {currentAppt.work_items.map((item, i) => (
                              <div key={i} className="flex justify-between font-mono text-sm">
                                <span className="flex items-center gap-2">
                                  {item.type === "part" ? (
                                    <Package className="w-3 h-3 text-muted-foreground" />
                                  ) : (
                                    <Wrench className="w-3 h-3 text-muted-foreground" />
                                  )}
                                  {item.name}
                                </span>
                                <span className="text-orange">{formatPrice(item.price)}</span>
                              </div>
                            ))}
                          </div>
                          {(currentAppt.parts_cost > 0 || currentAppt.services_cost > 0) && (
                            <div className="mt-3 pt-3 border-t border-border space-y-1 font-mono text-xs text-muted-foreground">
                              {currentAppt.parts_cost > 0 && (
                                <div className="flex justify-between">
                                  <span>Запчасти:</span>
                                  <span>{formatPrice(currentAppt.parts_cost)}</span>
                                </div>
                              )}
                              {currentAppt.services_cost > 0 && (
                                <div className="flex justify-between">
                                  <span>Работа:</span>
                                  <span>{formatPrice(currentAppt.services_cost)}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Services list (if no work_items yet) */}
                      {currentAppt.work_items.length === 0 && currentAppt.services && currentAppt.services.length > 0 && (
                        <div className="border-t-2 border-border pt-4 mb-4">
                          <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-2">Услуги</p>
                          <div className="space-y-1">
                            {currentAppt.services.map((s, i) => (
                              <div key={i} className="flex justify-between font-mono text-sm">
                                <span>{s.name}</span>
                                <span className="text-orange">от {formatPrice(s.price_from)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Bonus forecast */}
                      {bonusForecast > 0 && (
                        <div className="bg-green-400/5 border border-green-400/20 p-3 mb-4">
                          <div className="flex items-center gap-2 font-mono text-sm text-green-400">
                            <TrendingUp className="w-4 h-4" />
                            <span>За этот ремонт вам будет начислено <strong>{bonusForecast}</strong> бонусов ({bonusPct}%)</span>
                          </div>
                        </div>
                      )}

                      {/* Use bonuses toggle */}
                      {bonusPoints > 0 && currentAppt.total_price != null && currentAppt.total_price > 0 && (
                        <div className="border-t-2 border-border pt-4">
                          <label className="flex items-center gap-3 cursor-pointer select-none">
                            <div
                              onClick={() => setUseBonuses((v) => !v)}
                              className={`w-10 h-6 rounded-full border-2 flex items-center transition-colors ${useBonuses ? "bg-orange border-orange" : "bg-background border-border"}`}
                            >
                              <div className={`w-4 h-4 rounded-full bg-primary-foreground transition-transform mx-0.5 ${useBonuses ? "translate-x-4" : "translate-x-0"}`} />
                            </div>
                            <div>
                              <span className="font-mono text-sm font-bold">Использовать бонусы</span>
                              <span className="font-mono text-xs text-muted-foreground block">
                                {useBonuses
                                  ? `Скидка ${formatPrice(bonusDiscount)} (−${bonusDiscount} из ${bonusPoints})`
                                  : `Доступно ${bonusPoints} баллов · скидка до ${formatPrice(bonusDiscount)}`
                                }
                              </span>
                            </div>
                          </label>
                          {useBonuses && (
                            <div className="mt-3 bg-orange/5 border border-orange/20 p-3 font-mono text-sm">
                              <div className="flex justify-between">
                                <span>Стоимость работ</span>
                                <span>{formatPrice(currentAppt.total_price)}</span>
                              </div>
                              <div className="flex justify-between text-orange">
                                <span>Скидка бонусами</span>
                                <span>−{formatPrice(bonusDiscount)}</span>
                              </div>
                              <div className="flex justify-between font-bold border-t border-orange/20 pt-2 mt-2">
                                <span>Итого к оплате</span>
                                <span className="text-orange">{formatPrice(currentAppt.total_price - bonusDiscount)}</span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-2">Сообщите менеджеру об оплате бонусами при получении автомобиля.</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ===== HISTORY ===== */}
                {historyOrders.length > 0 && (
                  <div>
                    <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-3">
                      // История обслуживаний
                    </span>
                    <div className="space-y-3">
                      {historyOrders.map((appt) => {
                        const cfg = STATUS_CONFIG[appt.status];
                        const Icon = cfg?.icon || Clock;
                        const isOpen = expanded === appt.id;
                        return (
                          <div key={appt.id} className="bg-surface border-2 border-border hover:border-orange/30 transition-colors">
                            <button
                              onClick={() => setExpanded(isOpen ? null : appt.id)}
                              className="w-full p-5 flex items-center justify-between text-left"
                            >
                              <div className="flex items-center gap-4 flex-1 min-w-0">
                                <div className="w-10 h-10 bg-orange/10 border border-orange/20 flex items-center justify-center flex-shrink-0">
                                  <Car className="w-5 h-5 text-orange" />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-display text-xl tracking-wider">{appt.car_make}</p>
                                  <p className="font-mono text-xs text-muted-foreground">
                                    {new Date(appt.created_at).toLocaleDateString("ru-RU")}
                                    {appt.license_plate && ` · ${appt.license_plate}`}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                                {appt.total_price != null && appt.total_price > 0 && (
                                  <span className="font-mono text-sm text-orange hidden sm:block">{formatPrice(appt.total_price)}</span>
                                )}
                                <span className={`font-mono text-xs flex items-center gap-1 ${cfg?.color || "text-orange"}`}>
                                  <Icon className="w-3 h-3" />
                                  {cfg?.label}
                                </span>
                                <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`} />
                              </div>
                            </button>

                            {isOpen && (
                              <div className="border-t-2 border-border p-5 space-y-4">
                                {/* Work items */}
                                {appt.work_items.length > 0 && (
                                  <div>
                                    <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-2">Работы и запчасти</p>
                                    <div className="space-y-1">
                                      {appt.work_items.map((item, i) => (
                                        <div key={i} className="flex justify-between font-mono text-sm">
                                          <span>{item.name}</span>
                                          <span className="text-orange">{formatPrice(item.price)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Services */}
                                {appt.work_items.length === 0 && appt.services && appt.services.length > 0 && (
                                  <div>
                                    <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-2">Услуги</p>
                                    <div className="space-y-1">
                                      {appt.services.map((s, i) => (
                                        <div key={i} className="flex justify-between font-mono text-sm">
                                          <span>{s.name}</span>
                                          <span className="text-orange">от {formatPrice(s.price_from)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Documents */}
                                {appt.documents && appt.documents.length > 0 && (
                                  <div>
                                    <p className="font-mono text-xs text-orange uppercase tracking-widest mb-2">
                                      Документы ({appt.documents.length})
                                    </p>
                                    <div className="space-y-2">
                                      {appt.documents.map((doc) => (
                                        <a
                                          key={doc.id}
                                          href={doc.file_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center gap-3 p-3 border border-border hover:border-orange hover:text-orange transition-colors"
                                        >
                                          <FileText className="w-4 h-4 flex-shrink-0" />
                                          <div className="flex-1 min-w-0">
                                            <span className="font-mono text-sm block">
                                              {DOC_TYPE_LABELS[doc.doc_type] || doc.doc_type}
                                            </span>
                                            <span className="font-mono text-xs text-muted-foreground">
                                              {new Date(doc.created_at).toLocaleDateString("ru-RU")}
                                            </span>
                                          </div>
                                          <Download className="w-4 h-4 flex-shrink-0" />
                                        </a>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {appt.total_price != null && appt.total_price > 0 && (
                                  <div className="flex justify-between font-mono text-sm font-bold border-t border-border pt-3">
                                    <span>Итого</span>
                                    <span className="text-orange">{formatPrice(appt.total_price)}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Active orders beyond first (rare edge case) */}
                {activeOrders.length > 1 && (
                  <div>
                    <span className="font-mono text-xs text-orange uppercase tracking-widest block mb-3">
                      // Другие активные заказы
                    </span>
                    <div className="space-y-3">
                      {activeOrders.slice(1).map((appt) => {
                        const cfg = STATUS_CONFIG[appt.status];
                        const Icon = cfg?.icon || Clock;
                        return (
                          <div key={appt.id} className="bg-surface border-2 border-orange/30 p-5">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-display text-xl tracking-wider">{appt.car_make}</p>
                                <p className="font-mono text-xs text-muted-foreground">
                                  {new Date(appt.created_at).toLocaleDateString("ru-RU")}
                                </p>
                              </div>
                              <span className={`font-mono text-xs flex items-center gap-1 ${cfg?.color}`}>
                                <Icon className="w-3 h-3" />
                                {cfg?.label}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PhoneLinkPrompt({ tgUser, onLinked }: {
  tgUser: TelegramUser;
  onLinked: (phone: string) => void;
}) {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLink = async () => {
    if (!/^[\+\d\s\-\(\)]{7,20}$/.test(phone)) {
      setError("Некорректный номер телефона");
      return;
    }
    setLoading(true);
    try {
      await supabase.from("telegram_sessions").upsert({
        telegram_id: tgUser.id,
        first_name: tgUser.first_name,
        last_name: tgUser.last_name,
        username: tgUser.username,
        photo_url: tgUser.photo_url,
        phone: phone.trim(),
        auth_date: tgUser.auth_date,
        hash: tgUser.hash,
      }, { onConflict: "telegram_id" });

      await supabase.from("clients").upsert({
        phone: phone.trim(),
        telegram_chat_id: String(tgUser.id),
        telegram_username: tgUser.username,
        name: `${tgUser.first_name} ${tgUser.last_name || ""}`.trim(),
      }, { onConflict: "phone" });

      onLinked(phone.trim());
    } catch {
      setError("Ошибка привязки. Попробуйте ещё раз.");
    }
    setLoading(false);
  };

  return (
    <div className="bg-surface border-2 border-orange/50 p-8">
      <h3 className="font-display text-2xl tracking-wider mb-2">ПРИВЯЖИТЕ НОМЕР ТЕЛЕФОНА</h3>
      <p className="font-mono text-sm text-muted-foreground mb-6">
        Введите телефон, который использовался при записи в сервис — так мы найдём вашу историю заказов.
      </p>
      <div className="flex gap-3">
        <input
          type="tel"
          value={phone}
          onChange={(e) => { setPhone(e.target.value); setError(""); }}
          placeholder="+7 (812) 000-00-00"
          className="flex-1 bg-background border-2 border-border px-4 py-3 font-mono text-sm focus:outline-none focus:border-orange"
        />
        <button
          onClick={handleLink}
          disabled={loading || !phone}
          className="bg-orange text-primary-foreground px-6 py-3 font-mono text-sm hover:bg-orange-bright transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Привязать"}
        </button>
      </div>
      {error && <p className="font-mono text-xs text-destructive mt-2">{error}</p>}
    </div>
  );
}

function NamePrompt({ phone, currentName, onSaved }: {
  phone: string;
  currentName: string | null;
  onSaved: (name: string) => void;
}) {
  const [name, setName] = useState(currentName || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setError("Введите имя и фамилию"); return; }
    if (!/^\S+\s+\S+/.test(trimmed)) {
      setError("Пожалуйста, укажите фамилию для корректного оформления документов");
      return;
    }
    setSaving(true);
    await supabase.from("clients").update({ name: trimmed }).eq("phone", phone);
    setSaving(false);
    onSaved(trimmed);
  };

  return (
    <div className="bg-surface border-2 border-orange/50 p-8">
      <div className="w-14 h-14 bg-orange/10 border-2 border-orange/20 flex items-center justify-center mx-auto mb-5">
        <User className="w-7 h-7 text-orange" />
      </div>
      <h3 className="font-display text-2xl tracking-wider mb-2 text-center">УКАЖИТЕ ИМЯ И ФАМИЛИЮ</h3>
      <p className="font-mono text-sm text-muted-foreground mb-6 text-center">
        Для корректного оформления документов нам нужны ваши имя и фамилия.
      </p>
      <input
        type="text"
        value={name}
        onChange={(e) => { setName(e.target.value); setError(""); }}
        placeholder="Иван Иванов"
        className="w-full bg-background border-2 border-border px-4 py-3 font-mono text-sm focus:outline-none focus:border-orange mb-3"
      />
      {error && <p className="font-mono text-xs text-destructive mb-3">{error}</p>}
      <button
        onClick={handleSave}
        disabled={saving || !name.trim()}
        className="w-full bg-orange text-primary-foreground px-6 py-3 font-mono text-sm hover:bg-orange-bright transition-colors disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Сохранить и продолжить"}
      </button>
    </div>
  );
}
