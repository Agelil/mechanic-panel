import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import {
  Car, FileText, Star, Clock, CheckCircle2, Wrench,
  Package, XCircle, Download, LogOut, User, Phone,
  ChevronRight, Loader2, Shield, Gift, TrendingUp,
  Link2, Unlink, Plus, Trash2, Pencil, Save
} from "lucide-react";

interface CustomerCar {
  id: string;
  user_id: string;
  brand_model: string;
  vin: string | null;
  created_at: string;
}
import { formatPrice } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

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
  const [phone, setPhone] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [bonusPoints, setBonusPoints] = useState<number>(0);
  const [bonusPct, setBonusPct] = useState<number>(0);
  const [maxBonusPct, setMaxBonusPct] = useState<number>(30);
  const [useBonuses, setUseBonuses] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [clientName, setClientName] = useState<string | null>(null);
  const [needsName, setNeedsName] = useState(false);

  // Auth state
  const [emailUser, setEmailUser] = useState<{ id: string; email: string; fullName: string } | null>(null);

  // Telegram linking
  const [telegramChatId, setTelegramChatId] = useState<string | null>(null);
  const [botUsername, setBotUsername] = useState<string>("s_tochka_bot");
  const [linkingTg, setLinkingTg] = useState(false);

  // Phone editing
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);

  // Cars
  const [cars, setCars] = useState<CustomerCar[]>([]);
  const [showAddCar, setShowAddCar] = useState(false);
  const [newCarBrand, setNewCarBrand] = useState("");
  const [newCarVin, setNewCarVin] = useState("");
  const [addingCar, setAddingCar] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, telegram_chat_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      const fullName = profile?.full_name || session.user.user_metadata?.full_name || session.user.email || "";
      setEmailUser({ id: session.user.id, email: session.user.email || "", fullName });
      setTelegramChatId(profile?.telegram_chat_id || null);

      // Load bot username
      supabase.from("settings").select("value").eq("key", "telegram_bot_username").maybeSingle().then(({ data }) => {
        if (data?.value) setBotUsername(data.value);
      });

      // Find phone from registry
      const { data: reg } = await supabase
        .from("users_registry" as any)
        .select("phone, telegram_chat_id")
        .eq("user_id", session.user.id)
        .maybeSingle();
      let foundPhone = (reg as any)?.phone;

      // Also check telegram_chat_id from registry
      if (!telegramChatId && (reg as any)?.telegram_chat_id) {
        setTelegramChatId((reg as any).telegram_chat_id);
      }

      // Fallback: check clients table by name match
      if (!foundPhone && fullName) {
        const { data: clientByName } = await supabase
          .from("clients")
          .select("phone")
          .eq("name", fullName.trim())
          .maybeSingle();
        if (clientByName?.phone) foundPhone = clientByName.phone;
      }

      if (foundPhone) {
        setPhone(foundPhone);
        setPhoneInput(foundPhone);
        await loadClientDataByPhone(foundPhone, fullName);
      } else {
        setNeedsName(!fullName || !/^\S+\s+\S+/.test(fullName.trim()));
      }

      // Load user's cars
      const { data: userCars } = await supabase
        .from("customer_cars" as any)
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });
      if (userCars) setCars(userCars as any as CustomerCar[]);

      setLoading(false);
    });
  }, []);

  const loadAppointmentsByPhone = async (clientPhone: string) => {
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
      .select("bonus_points, name, telegram_chat_id")
      .eq("phone", clientPhone)
      .maybeSingle();
    if (client) {
      setBonusPoints(client.bonus_points || 0);
      setClientName(client.name || null);
      if (client.telegram_chat_id && !telegramChatId) {
        setTelegramChatId(client.telegram_chat_id);
      }
      const hasFullName = client.name && /^\S+\s+\S+/.test(client.name.trim());
      setNeedsName(!hasFullName);
    } else {
      setNeedsName(true);
    }
  };

  const loadClientDataByPhone = async (clientPhone: string, name: string) => {
    try {
      await loadAppointmentsByPhone(clientPhone);
      if (name && /^\S+\s+\S+/.test(name.trim())) {
        setNeedsName(false);
        setClientName(name);
      }
    } catch { /* ignore */ }
  };

  const handleLogout = async () => {
    setEmailUser(null);
    setAppointments([]);
    setPhone(null);
    setBonusPoints(0);
    await supabase.auth.signOut();
  };

  const handleUnlinkTelegram = async () => {
    if (!emailUser) return;
    setLinkingTg(true);
    // Clear telegram_chat_id from profiles and users_registry
    await supabase.from("profiles").update({ telegram_chat_id: null }).eq("user_id", emailUser.id);
    await supabase.from("users_registry" as any).update({ telegram_chat_id: null } as any).eq("user_id", emailUser.id);
    if (phone) {
      await supabase.from("clients").update({ telegram_chat_id: null }).eq("phone", phone);
    }
    setTelegramChatId(null);
    setLinkingTg(false);
  };

  // Phone editing
  const handleSavePhone = async () => {
    if (!emailUser || !phoneInput.trim()) return;
    setSavingPhone(true);
    const newPhone = phoneInput.trim();
    await supabase.from("users_registry" as any).update({ phone: newPhone } as any).eq("user_id", emailUser.id);
    await supabase.from("clients").upsert({ phone: newPhone, name: clientName || emailUser.fullName }, { onConflict: "phone" });
    setPhone(newPhone);
    setEditingPhone(false);
    setSavingPhone(false);
  };

  // Car management
  const handleAddCar = async () => {
    if (!emailUser || !newCarBrand.trim()) return;
    setAddingCar(true);
    const { data } = await supabase.from("customer_cars" as any).insert({
      user_id: emailUser.id,
      brand_model: newCarBrand.trim(),
      vin: newCarVin.trim().toUpperCase() || null,
    } as any).select().single();
    if (data) setCars(prev => [data as any as CustomerCar, ...prev]);
    setNewCarBrand("");
    setNewCarVin("");
    setShowAddCar(false);
    setAddingCar(false);
  };

  const handleDeleteCar = async (carId: string) => {
    await supabase.from("customer_cars" as any).delete().eq("id", carId);
    setCars(prev => prev.filter(c => c.id !== carId));
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

  const progressPct = (() => {
    if (!currentAppt) return 0;
    const cfg = STATUS_CONFIG[currentAppt.status];
    if (!cfg || cfg.step === 0) return 0;
    return Math.min(100, Math.round((cfg.step / 6) * 100));
  })();

  // Deep link for Telegram bot with user_id
  const telegramLinkUrl = emailUser
    ? `https://t.me/${botUsername}?start=link_${emailUser.id}`
    : "#";

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
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-orange animate-spin" />
          </div>
        ) : !emailUser ? (
          <div className="max-w-md mx-auto text-center">
            <div className="bg-surface border-2 border-border p-10 shadow-brutal">
              <div className="w-16 h-16 bg-orange/10 border-2 border-orange/20 flex items-center justify-center mx-auto mb-6">
                <Shield className="w-8 h-8 text-orange" />
              </div>
              <h2 className="font-display text-3xl tracking-wider mb-3">ВОЙДИТЕ В КАБИНЕТ</h2>
              <p className="font-mono text-sm text-muted-foreground mb-8 leading-relaxed">
                Для доступа к истории заказов, документам и бонусам.
              </p>
              
              <a
                href="/login?returnTo=/cabinet"
                className="w-full inline-flex items-center justify-center gap-2 bg-orange text-primary-foreground px-6 py-3 font-display text-xl tracking-widest hover:bg-orange-bright transition-colors mb-4"
              >
                Войти по Email
              </a>

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
              <div className="sm:col-span-2 bg-surface border-2 border-border p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-orange/10 border-2 border-orange/20 flex items-center justify-center">
                      <User className="w-6 h-6 text-orange" />
                    </div>
                    <div>
                      <p className="font-display text-2xl tracking-wider">{emailUser.fullName}</p>
                      <p className="font-mono text-xs text-muted-foreground">{emailUser.email}</p>
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

                {/* Telegram linking */}
                <div className="border-t border-border pt-4">
                  {telegramChatId ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span className="font-mono text-xs text-green-500">Telegram подключен ✅</span>
                      </div>
                      <button
                        onClick={handleUnlinkTelegram}
                        disabled={linkingTg}
                        className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-destructive transition-colors"
                      >
                        {linkingTg ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlink className="w-3 h-3" />}
                        Отключить
                      </button>
                    </div>
                  ) : (
                    <a
                      href={telegramLinkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 font-mono text-xs text-orange hover:text-orange-bright transition-colors"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      Привязать Telegram
                    </a>
                  )}
                </div>
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

            {needsName ? (
              <NamePrompt phone={phone} currentName={clientName} onSaved={(name) => { setClientName(name); setNeedsName(false); }} />
            ) : !phone ? (
              <div className="text-center py-16 bg-surface border-2 border-dashed border-border">
                <Phone className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-30" />
                <p className="font-mono text-sm text-muted-foreground">Телефон не привязан</p>
                <p className="font-mono text-xs text-muted-foreground mt-1">Обратитесь к администратору для привязки номера</p>
              </div>
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
                      <div className="flex items-center gap-1 mt-3">
                        {TIMELINE_STEPS.map((step, i) => {
                          const cfg = STATUS_CONFIG[currentAppt.status];
                          const currentStep = cfg?.step || 0;
                          const stepNum = STATUS_CONFIG[step.key]?.step || 0;
                          const isDone = currentStep >= stepNum;
                          return (
                            <div key={step.key} className="flex items-center gap-1 flex-1">
                              <div className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${
                                isDone ? "bg-orange border-orange" : "bg-transparent border-border"
                              }`} />
                              {i < TIMELINE_STEPS.length - 1 && (
                                <div className={`h-0.5 flex-1 ${isDone ? "bg-orange" : "bg-border"}`} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex justify-between mt-1">
                        {TIMELINE_STEPS.map((step) => (
                          <span key={step.key} className="font-mono text-[10px] text-muted-foreground">{step.label}</span>
                        ))}
                      </div>

                      {/* Services */}
                      {currentAppt.services && currentAppt.services.length > 0 && (
                        <div className="mt-5 pt-4 border-t border-border">
                          <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-2">Услуги</p>
                          <div className="space-y-1">
                            {currentAppt.services.map((s, i) => (
                              <div key={i} className="flex justify-between font-mono text-sm">
                                <span>{s.name}</span>
                                <span className="text-orange">{formatPrice(s.price_from)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Work items */}
                      {currentAppt.work_items.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-border">
                          <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-2">Работы и запчасти</p>
                          <div className="space-y-1">
                            {currentAppt.work_items.map((w, i) => (
                              <div key={i} className="flex justify-between font-mono text-sm">
                                <span className="flex items-center gap-1.5">
                                  {w.type === "part" ? <Package className="w-3 h-3 text-muted-foreground" /> : <Wrench className="w-3 h-3 text-muted-foreground" />}
                                  {w.name}
                                </span>
                                <span className="text-orange">{formatPrice(w.price)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Bonus block */}
                      {bonusPoints > 0 && currentAppt.total_price != null && currentAppt.total_price > 0 && (
                        <div className="mt-4 pt-4 border-t border-border">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Бонусная скидка</p>
                              <p className="font-display text-xl text-orange mt-1">
                                до {formatPrice(bonusDiscount)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-mono text-xs text-muted-foreground">Начисление</p>
                              <p className="font-mono text-sm text-green-500">+{bonusForecast} б.</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Documents */}
                      {currentAppt.documents && currentAppt.documents.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-border">
                          <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-2">Документы</p>
                          <div className="space-y-2">
                            {currentAppt.documents.map((doc) => (
                              <a
                                key={doc.id}
                                href={doc.file_url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-2 font-mono text-xs text-orange hover:text-orange-bright transition-colors"
                              >
                                <Download className="w-3 h-3" />
                                {DOC_TYPE_LABELS[doc.doc_type] || doc.file_name}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* History */}
                {historyOrders.length > 0 && (
                  <div>
                    <span className="font-mono text-xs text-orange uppercase tracking-widest block mb-3">
                      // История ремонтов
                    </span>
                    <div className="space-y-3">
                      {historyOrders.map((appt) => {
                        const cfg = STATUS_CONFIG[appt.status];
                        const Icon = cfg?.icon || Clock;
                        const isOpen = expanded === appt.id;

                        return (
                          <div key={appt.id} className="bg-surface border-2 border-border">
                            <button
                              onClick={() => setExpanded(isOpen ? null : appt.id)}
                              className="w-full p-5 flex items-center justify-between text-left hover:bg-background/50 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <Car className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                                <div>
                                  <p className="font-display text-xl tracking-wider">{appt.car_make}</p>
                                  <p className="font-mono text-xs text-muted-foreground">
                                    {new Date(appt.created_at).toLocaleDateString("ru-RU")}
                                    {appt.license_plate && ` · ${appt.license_plate}`}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                {appt.total_price != null && appt.total_price > 0 && (
                                  <span className="font-mono text-sm text-orange">{formatPrice(appt.total_price)}</span>
                                )}
                                <span className={`font-mono text-xs flex items-center gap-1 ${cfg?.color}`}>
                                  <Icon className="w-3 h-3" />
                                  {cfg?.label}
                                </span>
                                <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`} />
                              </div>
                            </button>

                            {isOpen && (
                              <div className="px-5 pb-5 pt-0 border-t border-border space-y-3">
                                {appt.services && appt.services.length > 0 && (
                                  <div>
                                    <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-1">Услуги</p>
                                    {appt.services.map((s, i) => (
                                      <div key={i} className="flex justify-between font-mono text-sm">
                                        <span>{s.name}</span>
                                        <span className="text-orange">{formatPrice(s.price_from)}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {appt.work_items.length > 0 && (
                                  <div>
                                    <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-1">Работы и запчасти</p>
                                    {appt.work_items.map((w, i) => (
                                      <div key={i} className="flex justify-between font-mono text-sm">
                                        <span>{w.name}</span>
                                        <span className="text-orange">{formatPrice(w.price)}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {appt.documents && appt.documents.length > 0 && (
                                  <div>
                                    <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-1">Документы</p>
                                    {appt.documents.map((doc) => (
                                      <a
                                        key={doc.id}
                                        href={doc.file_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex items-center gap-2 font-mono text-xs text-orange hover:text-orange-bright"
                                      >
                                        <Download className="w-3 h-3" />
                                        {DOC_TYPE_LABELS[doc.doc_type] || doc.file_name}
                                      </a>
                                    ))}
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

                {/* Active orders beyond first */}
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

function NamePrompt({ phone, currentName, onSaved }: {
  phone: string | null;
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
    if (phone) {
      await supabase.from("clients").update({ name: trimmed }).eq("phone", phone);
    }
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
