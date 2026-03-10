import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Loader2, Phone, User, Car, Wrench, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SERVICE_OPTIONS = [
  "Компьютерная диагностика",
  "Замена масла и фильтра",
  "Ремонт тормозной системы",
  "Замена ремня/цепи ГРМ",
  "Ремонт подвески и ходовой",
  "Шиномонтаж и балансировка",
  "Ремонт электрики",
  "Кузовные и сварочные работы",
  "Замена охлаждающей жидкости",
  "Ремонт КПП",
  "Другое",
];

export default function BookingPage() {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    car_make: "",
    service_type: "",
    message: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Введите ваше имя";
    if (!form.phone.trim()) errs.phone = "Введите номер телефона";
    else if (!/^[\+\d\s\-\(\)]{7,20}$/.test(form.phone)) errs.phone = "Некорректный номер";
    if (!form.car_make.trim()) errs.car_make = "Укажите марку автомобиля";
    if (!form.service_type) errs.service_type = "Выберите вид услуги";
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);

    try {
      const { error } = await supabase.from("appointments").insert({
        name: form.name.trim(),
        phone: form.phone.trim(),
        car_make: form.car_make.trim(),
        service_type: form.service_type,
        message: form.message.trim() || null,
        status: "new",
      });

      if (error) throw error;

      // Send Telegram notification via edge function
      try {
        await supabase.functions.invoke("send-telegram-notification", {
          body: {
            name: form.name.trim(),
            phone: form.phone.trim(),
            car_make: form.car_make.trim(),
            service_type: form.service_type,
            message: form.message.trim(),
          },
        });
      } catch {
        // Telegram notification failure is non-critical
      }

      setSubmitted(true);
    } catch (err) {
      toast({
        title: "Ошибка",
        description: "Не удалось отправить заявку. Попробуйте ещё раз или позвоните нам.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => { const e = { ...prev }; delete e[field]; return e; });
  };

  if (submitted) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <div className="text-center px-4 animate-slide-up">
          <div className="w-20 h-20 bg-orange/10 border-2 border-orange flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-orange" />
          </div>
          <h2 className="font-display text-5xl tracking-wider mb-4">ЗАЯВКА ПРИНЯТА</h2>
          <p className="font-mono text-muted-foreground mb-2">
            Спасибо, <span className="text-foreground font-bold">{form.name}</span>!
          </p>
          <p className="font-mono text-sm text-muted-foreground mb-8">
            Мы перезвоним вам в течение 15 минут на номер <span className="text-foreground">{form.phone}</span>.
          </p>
          <button
            onClick={() => { setSubmitted(false); setForm({ name: "", phone: "", car_make: "", service_type: "", message: "" }); }}
            className="font-mono text-sm text-orange border border-orange px-6 py-3 hover:bg-orange hover:text-primary-foreground transition-colors"
          >
            Оставить ещё одну заявку
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-16">
      {/* Header */}
      <section className="relative bg-surface border-b-2 border-border py-16 bg-grid">
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-orange" />
        <div className="container mx-auto px-4">
          <span className="font-mono text-xs text-orange uppercase tracking-widest">// Онлайн-запись</span>
          <h1 className="font-display text-6xl md:text-8xl tracking-wider mt-2">
            ЗАПИСАТЬСЯ <span className="text-orange">НА СЕРВИС</span>
          </h1>
          <p className="font-mono text-sm text-muted-foreground mt-4 max-w-xl">
            Заполните форму — мы перезвоним в течение 15 минут и согласуем удобное время.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Name */}
              <div>
                <label className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
                  <User className="w-3.5 h-3.5 text-orange" />
                  Ваше имя *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="Иван Иванов"
                  className={`w-full bg-surface border-2 px-4 py-3 font-mono text-sm focus:outline-none focus:border-orange transition-colors ${
                    errors.name ? "border-destructive" : "border-border"
                  }`}
                />
                {errors.name && <p className="font-mono text-xs text-destructive mt-1">{errors.name}</p>}
              </div>

              {/* Phone */}
              <div>
                <label className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
                  <Phone className="w-3.5 h-3.5 text-orange" />
                  Телефон *
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  placeholder="+7 (812) 000-00-00"
                  className={`w-full bg-surface border-2 px-4 py-3 font-mono text-sm focus:outline-none focus:border-orange transition-colors ${
                    errors.phone ? "border-destructive" : "border-border"
                  }`}
                />
                {errors.phone && <p className="font-mono text-xs text-destructive mt-1">{errors.phone}</p>}
              </div>

              {/* Car Make */}
              <div>
                <label className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
                  <Car className="w-3.5 h-3.5 text-orange" />
                  Марка и модель автомобиля *
                </label>
                <input
                  type="text"
                  value={form.car_make}
                  onChange={(e) => handleChange("car_make", e.target.value)}
                  placeholder="Toyota Camry 2020"
                  className={`w-full bg-surface border-2 px-4 py-3 font-mono text-sm focus:outline-none focus:border-orange transition-colors ${
                    errors.car_make ? "border-destructive" : "border-border"
                  }`}
                />
                {errors.car_make && <p className="font-mono text-xs text-destructive mt-1">{errors.car_make}</p>}
              </div>

              {/* Service */}
              <div>
                <label className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
                  <Wrench className="w-3.5 h-3.5 text-orange" />
                  Вид услуги *
                </label>
                <select
                  value={form.service_type}
                  onChange={(e) => handleChange("service_type", e.target.value)}
                  className={`w-full bg-surface border-2 px-4 py-3 font-mono text-sm focus:outline-none focus:border-orange transition-colors ${
                    errors.service_type ? "border-destructive" : "border-border"
                  } ${!form.service_type ? "text-muted-foreground" : ""}`}
                >
                  <option value="">Выберите услугу...</option>
                  {SERVICE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                {errors.service_type && <p className="font-mono text-xs text-destructive mt-1">{errors.service_type}</p>}
              </div>

              {/* Message */}
              <div>
                <label className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
                  <MessageSquare className="w-3.5 h-3.5 text-orange" />
                  Комментарий (необязательно)
                </label>
                <textarea
                  value={form.message}
                  onChange={(e) => handleChange("message", e.target.value)}
                  placeholder="Опишите проблему или укажите удобное время..."
                  rows={4}
                  className="w-full bg-surface border-2 border-border px-4 py-3 font-mono text-sm focus:outline-none focus:border-orange transition-colors resize-none"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-orange text-primary-foreground px-8 py-4 font-display text-2xl tracking-widest hover:bg-orange-bright transition-colors shadow-brutal-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Отправляем...
                  </>
                ) : (
                  "Отправить заявку →"
                )}
              </button>

              <p className="font-mono text-xs text-muted-foreground text-center">
                Нажимая кнопку, вы соглашаетесь на обработку персональных данных
              </p>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
