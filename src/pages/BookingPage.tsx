import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Loader2, Phone, User, Car, MessageSquare, Calculator, ChevronRight, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatPrice } from "@/lib/utils";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Category {
  id: string;
  name: string;
  sort_order: number;
}

interface ServiceOption {
  id: string;
  name: string;
  price_from: number;
  price_to: number | null;
  category: string | null;
  category_id: string | null;
}

export default function BookingPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedServices, setSelectedServices] = useState<ServiceOption[]>([]);
  const [form, setForm] = useState({ name: "", phone: "", car_make: "", car_vin: "", message: "" });
  const [consentGiven, setConsentGiven] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [autoFilled, setAutoFilled] = useState(false);

  // Load services + categories
  useEffect(() => {
    Promise.all([
      supabase
        .from("services")
        .select("id, name, price_from, price_to, category, category_id")
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("service_categories")
        .select("*")
        .order("sort_order"),
    ]).then(([{ data: svcData }, { data: catData }]) => {
      setServices(svcData || []);
      setCategories(catData || []);
    });
  }, []);

  // Auto-fill from TG session's last appointment
  useEffect(() => {
    if (autoFilled) return;
    const saved = localStorage.getItem("tg_cabinet_user");
    if (!saved) return;

    try {
      const tgUser = JSON.parse(saved);
      const now = Math.floor(Date.now() / 1000);
      if (now - tgUser.auth_date >= 86400) return;

      // Get phone from telegram_sessions
      supabase
        .from("telegram_sessions")
        .select("phone")
        .eq("telegram_id", tgUser.id)
        .maybeSingle()
        .then(({ data: session }) => {
          const clientPhone = session?.phone;
          if (!clientPhone) return;

          // Pre-fill name from TG
          const tgName = `${tgUser.first_name || ""} ${tgUser.last_name || ""}`.trim();

          // Find last appointment for this phone
          supabase
            .from("appointments")
            .select("name, phone, car_make, car_vin")
            .eq("phone", clientPhone)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()
            .then(({ data: lastAppt }) => {
              setForm((prev) => ({
                ...prev,
                name: lastAppt?.name || tgName || prev.name,
                phone: clientPhone || prev.phone,
                car_make: lastAppt?.car_make || prev.car_make,
                car_vin: lastAppt?.car_vin || prev.car_vin,
              }));
              setAutoFilled(true);
            });
        });
    } catch { /* ignore */ }
  }, [autoFilled]);

  const filteredServices = selectedCategory === "all"
    ? services
    : services.filter((s) => s.category_id === selectedCategory || s.category === selectedCategory);

  // Fallback: group by category text if no category_id system
  const hasCategories = categories.length > 0;

  const totalMin = selectedServices.reduce((sum, s) => sum + s.price_from, 0);
  const totalMax = selectedServices.reduce((sum, s) => sum + (s.price_to || s.price_from), 0);

  const toggleService = (svc: ServiceOption) => {
    setSelectedServices((prev) =>
      prev.find((s) => s.id === svc.id)
        ? prev.filter((s) => s.id !== svc.id)
        : [...prev, svc]
    );
    if (errors.services) setErrors((p) => { const e = { ...p }; delete e.services; return e; });
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Введите ваше имя";
    else if (!/^[А-Яа-яЁёA-Za-z\-]+\s+[А-Яа-яЁёA-Za-z\-]+/.test(form.name.trim())) errs.name = "Введите Имя и Фамилию";
    if (!form.phone.trim()) errs.phone = "Введите номер телефона";
    else if (!/^[\+\d\s\-\(\)]{7,20}$/.test(form.phone)) errs.phone = "Некорректный номер";
    if (!form.car_make.trim()) errs.car_make = "Укажите марку автомобиля";
    if (selectedServices.length === 0) errs.services = "Выберите хотя бы одну услугу";
    if (!consentGiven) errs.consent = "Необходимо согласие на обработку персональных данных";
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);

    try {
      const serviceNames = selectedServices.map((s) => s.name).join(", ");
      const { error } = await supabase.from("appointments").insert({
        name: form.name.trim(),
        phone: form.phone.trim(),
        car_make: form.car_make.trim(),
        car_vin: form.car_vin.trim() || null,
        service_type: serviceNames,
        services: selectedServices.map((s) => ({ id: s.id, name: s.name, price_from: s.price_from, price_to: s.price_to })),
        total_price: totalMin,
        message: form.message.trim() || null,
        status: "new",
      });
      if (error) throw error;

      try {
        await supabase.functions.invoke("send-telegram-notification", {
          body: {
            type: "new_appointment",
            name: form.name.trim(),
            phone: form.phone.trim(),
            car_make: form.car_make.trim(),
            service_type: serviceNames,
            services: selectedServices,
            total_price: totalMin,
            message: form.message.trim(),
          },
        });
        // Sync to Google Sheets
        await supabase.functions.invoke("sync-google-sheets", {
          body: {
            type: "created",
            appointment: {
              id: "pending",
              created_at: new Date().toISOString(),
              name: form.name.trim(),
              phone: form.phone.trim(),
              car_make: form.car_make.trim(),
              car_vin: form.car_vin.trim() || null,
              services: selectedServices,
              service_type: serviceNames,
              total_price: totalMin,
              message: form.message.trim(),
              status: "new",
            },
          },
        });
      } catch { /* non-critical */ }

      navigate("/booking-success");
    } catch {
      toast({ title: "Ошибка", description: "Не удалось отправить заявку. Попробуйте ещё раз.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setForm((p) => ({ ...p, [field]: value }));
    if (errors[field]) setErrors((p) => { const e = { ...p }; delete e[field]; return e; });
  };

  // Text-based category grouping (fallback)
  const textCategories = Array.from(new Set(services.map((s) => s.category || "Прочее")));

  // removed inline success screen — now redirects to /booking-success

  // Check if user is logged in via TG
  const isGuest = !localStorage.getItem("tg_cabinet_user");

  return (
    <div className="min-h-screen pt-16">
      <section className="relative bg-surface border-b-2 border-border py-16 bg-grid">
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-orange" />
        <div className="container mx-auto px-4">
          <span className="font-mono text-xs text-orange uppercase tracking-widest">// Онлайн-запись</span>
          <h1 className="font-display text-6xl md:text-8xl tracking-wider mt-2">
            ЗАПИСАТЬСЯ <span className="text-orange">НА СЕРВИС</span>
          </h1>
          <p className="font-mono text-sm text-muted-foreground mt-4 max-w-xl">
            Выберите услуги и заполните форму — мы перезвоним в течение 15 минут.
          </p>
        </div>
      </section>

      {/* Guest upsell banner */}
      {isGuest && (
        <section className="py-0">
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="bg-surface border-2 border-orange/30 p-6 mt-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-orange" />
              <h3 className="font-display text-2xl tracking-wider mb-4 pl-4">
                ЗАРЕГИСТРИРУЙТЕСЬ, ЧТОБЫ ПОЛУЧИТЬ <span className="text-orange">МАКСИМУМ</span> ОТ СЕРВИСА
              </h3>
              <div className="space-y-3 pl-4 mb-5">
                <div className="flex items-start gap-3">
                  <span className="text-lg flex-shrink-0">🎁</span>
                  <div>
                    <p className="font-mono text-sm font-bold">Бонусы с каждой оплаты</p>
                    <p className="font-mono text-xs text-muted-foreground">Копите баллы и оплачивайте ими ремонт.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-lg flex-shrink-0">📱</span>
                  <div>
                    <p className="font-mono text-sm font-bold">Telegram-уведомления</p>
                    <p className="font-mono text-xs text-muted-foreground">Следите за статусом ремонта в реальном времени.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-lg flex-shrink-0">📜</span>
                  <div>
                    <p className="font-mono text-sm font-bold">История обслуживания</p>
                    <p className="font-mono text-xs text-muted-foreground">Все наряды-допуски и запчасти всегда под рукой.</p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => navigate("/cabinet")}
                className="ml-4 bg-orange text-primary-foreground px-6 py-3 font-display text-lg tracking-widest hover:bg-orange-bright transition-colors"
              >
                СОЗДАТЬ ЛИЧНЫЙ КАБИНЕТ
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="py-16">
        <div className="container mx-auto px-4">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Left column: contact info */}
            <div className="space-y-5">
              <h2 className="font-display text-3xl tracking-wider mb-6">КОНТАКТНЫЕ ДАННЫЕ</h2>

              <div>
                <label className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
                  <User className="w-3.5 h-3.5 text-orange" /> Ваше имя *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="Иван Иванов"
                  className={`w-full bg-surface border-2 px-4 py-3 font-mono text-sm focus:outline-none focus:border-orange transition-colors ${errors.name ? "border-destructive" : "border-border"}`}
                />
                {errors.name && <p className="font-mono text-xs text-destructive mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
                  <Phone className="w-3.5 h-3.5 text-orange" /> Телефон *
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  placeholder="+7 (812) 000-00-00"
                  className={`w-full bg-surface border-2 px-4 py-3 font-mono text-sm focus:outline-none focus:border-orange transition-colors ${errors.phone ? "border-destructive" : "border-border"}`}
                />
                {errors.phone && <p className="font-mono text-xs text-destructive mt-1">{errors.phone}</p>}
              </div>

              <div>
                <label className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
                  <Car className="w-3.5 h-3.5 text-orange" /> Марка и модель *
                </label>
                <input
                  type="text"
                  value={form.car_make}
                  onChange={(e) => handleChange("car_make", e.target.value)}
                  placeholder="Toyota Camry 2020"
                  className={`w-full bg-surface border-2 px-4 py-3 font-mono text-sm focus:outline-none focus:border-orange transition-colors ${errors.car_make ? "border-destructive" : "border-border"}`}
                />
                {errors.car_make && <p className="font-mono text-xs text-destructive mt-1">{errors.car_make}</p>}
              </div>

              <div>
                <label className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
                  <Car className="w-3.5 h-3.5 text-muted-foreground" /> VIN номер (необязательно)
                </label>
                <input
                  type="text"
                  value={form.car_vin}
                  onChange={(e) => handleChange("car_vin", e.target.value)}
                  placeholder="WAUZZZ8K9BA012345"
                  maxLength={17}
                  className="w-full bg-surface border-2 border-border px-4 py-3 font-mono text-sm focus:outline-none focus:border-orange transition-colors uppercase"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
                  <MessageSquare className="w-3.5 h-3.5 text-orange" /> Комментарий
                </label>
                <textarea
                  value={form.message}
                  onChange={(e) => handleChange("message", e.target.value)}
                  placeholder="Опишите проблему или укажите удобное время..."
                  rows={4}
                  className="w-full bg-surface border-2 border-border px-4 py-3 font-mono text-sm focus:outline-none focus:border-orange transition-colors resize-none"
                />
              </div>
            </div>

            {/* Right column: two-level service selection */}
            <div>
              <h2 className="font-display text-3xl tracking-wider mb-6">ВЫБЕРИТЕ УСЛУГИ</h2>
              {errors.services && (
                <p className="font-mono text-xs text-destructive mb-3 border border-destructive/20 bg-destructive/10 px-3 py-2">
                  {errors.services}
                </p>
              )}

              {/* Step 1: Category selector (only if categories exist) */}
              {hasCategories && (
                <div className="mb-4">
                  <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-2">
                    <span className="text-orange">01</span> / Категория услуг
                  </label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-full bg-surface border-2 border-border font-mono text-sm rounded-none h-12 focus:border-orange">
                      <SelectValue placeholder="Все категории" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="font-mono text-sm">Все категории</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id} className="font-mono text-sm">
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedCategory !== "all" && (
                    <div className="flex items-center gap-1 mt-2">
                      <ChevronRight className="w-3 h-3 text-orange" />
                      <span className="font-mono text-xs text-orange">
                        {categories.find((c) => c.id === selectedCategory)?.name} — выберите услуги ниже
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Services */}
              {hasCategories && (
                <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-2">
                  <span className="text-orange">02</span> / Услуги {selectedCategory !== "all" && <span className="text-orange">({filteredServices.length})</span>}
                </label>
              )}

              <div className="space-y-1 max-h-[380px] overflow-y-auto pr-1">
                {/* Show grouped if no category system or "all" selected */}
                {!hasCategories ? (
                  textCategories.map((cat) => (
                    <div key={cat} className="mb-3">
                      <p className="font-mono text-xs text-orange uppercase tracking-widest mb-2 border-b border-border pb-1">{cat}</p>
                      <div className="space-y-1">
                        {services.filter((s) => (s.category || "Прочее") === cat).map((svc) => (
                          <ServiceCheckbox key={svc.id} svc={svc} checked={!!selectedServices.find((s) => s.id === svc.id)} onToggle={() => toggleService(svc)} />
                        ))}
                      </div>
                    </div>
                  ))
                ) : filteredServices.length === 0 ? (
                  <div className="py-8 text-center border-2 border-dashed border-border">
                    <p className="font-mono text-sm text-muted-foreground">В этой категории нет услуг</p>
                  </div>
                ) : (
                  filteredServices.map((svc) => (
                    <ServiceCheckbox
                      key={svc.id}
                      svc={svc}
                      checked={!!selectedServices.find((s) => s.id === svc.id)}
                      onToggle={() => toggleService(svc)}
                    />
                  ))
                )}
              </div>

              {/* Price summary */}
              {selectedServices.length > 0 && (
                <div className="mt-5 bg-orange/10 border-2 border-orange/30 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Calculator className="w-4 h-4 text-orange" />
                    <span className="font-mono text-xs text-orange uppercase tracking-widest">Предварительный расчёт</span>
                  </div>
                  <div className="space-y-1 mb-3">
                    {selectedServices.map((s) => (
                      <div key={s.id} className="flex justify-between font-mono text-xs">
                        <span className="text-muted-foreground truncate mr-2">{s.name}</span>
                        <span>от {formatPrice(s.price_from)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-orange/30 pt-2 flex justify-between">
                    <span className="font-display text-lg tracking-wider">ИТОГО</span>
                    <span className="font-display text-lg text-orange">
                      от {formatPrice(totalMin)}{totalMax > totalMin ? ` до ${formatPrice(totalMax)}` : ""}
                    </span>
                  </div>
                  <p className="font-mono text-xs text-muted-foreground mt-2">
                    * Финальная стоимость определяется после диагностики
                  </p>
                </div>
              )}
            </div>

            {/* Submit */}
            <div className="lg:col-span-2">
              <button
                type="submit"
                disabled={loading}
              className="w-full bg-orange text-primary-foreground px-8 py-4 font-display text-2xl tracking-widest hover:bg-orange-bright transition-colors shadow-brutal-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {loading ? (
                <><Loader2 className="w-5 h-5 animate-spin" />Отправляем...</>
              ) : (
                "Отправить заявку →"
              )}
            </button>

            {/* Consent checkbox (ФЗ-152) */}
            <div className="mt-4">
              <label className={`flex items-start gap-3 cursor-pointer ${errors.consent ? "text-destructive" : ""}`}>
                <input
                  type="checkbox"
                  checked={consentGiven}
                  onChange={(e) => {
                    setConsentGiven(e.target.checked);
                    if (errors.consent) setErrors((p) => { const er = { ...p }; delete er.consent; return er; });
                  }}
                  className="mt-1 w-4 h-4 accent-orange flex-shrink-0"
                />
                <span className="font-mono text-xs text-muted-foreground leading-relaxed">
                  Я даю согласие на{" "}
                  <a href="/privacy" target="_blank" className="text-orange hover:underline">
                    обработку персональных данных
                  </a>{" "}
                  в соответствии с ФЗ-152 «О персональных данных».
                </span>
              </label>
              {errors.consent && (
                <p className="font-mono text-xs text-destructive mt-1 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />{errors.consent}
                </p>
              )}
            </div>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}

function ServiceCheckbox({ svc, checked, onToggle }: {
  svc: ServiceOption;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={`flex items-start gap-3 p-3 cursor-pointer transition-colors border-2 ${
        checked ? "border-orange bg-orange/5" : "border-transparent hover:bg-surface"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-0.5 accent-orange w-4 h-4 flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <span className="font-mono text-sm block">{svc.name}</span>
        <span className="font-mono text-xs text-orange">
          от {formatPrice(svc.price_from)}{svc.price_to ? ` до ${formatPrice(svc.price_to)}` : ""}
        </span>
      </div>
    </label>
  );
}
