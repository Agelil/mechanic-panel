import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, UserPlus, Eye, EyeOff, Wrench, ArrowLeft, CheckCircle2, Mail, Phone, User
} from "lucide-react";

const NAME_REGEX = /^\S+\s+\S+/;

export default function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/cabinet";

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    password2: "",
  });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // If already logged in, redirect
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate(returnTo, { replace: true });
    });
  }, [navigate, returnTo]);

  const handleChange = (field: string, value: string) => {
    setForm((p) => ({ ...p, [field]: value }));
    if (error) setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate
    if (!form.fullName.trim()) { setError("Введите имя и фамилию"); return; }
    if (!NAME_REGEX.test(form.fullName.trim())) {
      setError("Пожалуйста, укажите фамилию для корректного оформления документов");
      return;
    }
    if (!form.email.trim()) { setError("Введите email"); return; }
    if (!form.phone.trim()) { setError("Введите номер телефона"); return; }
    if (!/^[\+\d\s\-\(\)]{7,20}$/.test(form.phone.trim())) { setError("Некорректный номер телефона"); return; }
    if (form.password.length < 6) { setError("Пароль должен быть не менее 6 символов"); return; }
    if (form.password !== form.password2) { setError("Пароли не совпадают"); return; }

    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}${returnTo}`,
        data: { full_name: form.fullName.trim() },
      },
    });

    if (signUpError) {
      if (signUpError.message.includes("already registered") || signUpError.message.includes("already exists")) {
        setError("Пользователь с этим email уже зарегистрирован. Попробуйте войти.");
      } else {
        setError(signUpError.message);
      }
      setLoading(false);
      return;
    }

    if (data.user) {
      // Update profile with name and mark as approved (client)
      await supabase.from("profiles").upsert({
        user_id: data.user.id,
        email: data.user.email,
        full_name: form.fullName.trim(),
        is_approved: true,
        is_blocked: false,
      }, { onConflict: "user_id" });

      // Create/update client record linked by phone
      await supabase.from("clients").upsert({
        phone: form.phone.trim(),
        name: form.fullName.trim(),
      }, { onConflict: "phone" });

      // Update users_registry with client role
      await supabase.from("users_registry" as any).upsert({
        user_id: data.user.id,
        email: data.user.email,
        full_name: form.fullName.trim(),
        phone: form.phone.trim(),
        role: "client",
        is_approved: true,
        is_blocked: false,
        source: "auth",
      } as any, { onConflict: "user_id" });
    }

    setLoading(false);

    // Auto-confirm is enabled, so session should be available
    if (data.session) {
      navigate(returnTo, { replace: true });
    } else {
      setSuccess(true);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center bg-grid pt-16">
      <div className="w-full max-w-md px-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-orange flex items-center justify-center mx-auto mb-4">
            <Wrench className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="font-display text-4xl tracking-widest">
            СЕРВИС<span className="text-orange">-</span>ТОЧКА
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-2 uppercase tracking-widest">
            Регистрация клиента
          </p>
        </div>

        {!success ? (
          <form onSubmit={handleSubmit} className="border-2 border-border bg-surface p-8 shadow-brutal">
            <div className="flex items-center gap-3 mb-6">
              <Link to="/login" className="text-muted-foreground hover:text-orange transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <h2 className="font-display text-2xl tracking-wider">РЕГИСТРАЦИЯ</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground uppercase tracking-widest mb-2">
                  <User className="w-3 h-3 text-orange" /> Имя и фамилия *
                </label>
                <input
                  type="text"
                  value={form.fullName}
                  onChange={(e) => handleChange("fullName", e.target.value)}
                  required
                  placeholder="Иван Иванов"
                  className="w-full bg-background border-2 border-border px-4 py-3 font-mono text-sm focus:outline-none focus:border-orange transition-colors"
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground uppercase tracking-widest mb-2">
                  <Mail className="w-3 h-3 text-orange" /> Email *
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  required
                  placeholder="ivan@example.com"
                  className="w-full bg-background border-2 border-border px-4 py-3 font-mono text-sm focus:outline-none focus:border-orange transition-colors"
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground uppercase tracking-widest mb-2">
                  <Phone className="w-3 h-3 text-orange" /> Телефон *
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  required
                  placeholder="+7 (812) 000-00-00"
                  className="w-full bg-background border-2 border-border px-4 py-3 font-mono text-sm focus:outline-none focus:border-orange transition-colors"
                />
              </div>

              <div>
                <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-2">
                  Пароль *
                </label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => handleChange("password", e.target.value)}
                    required
                    minLength={6}
                    placeholder="Минимум 6 символов"
                    className="w-full bg-background border-2 border-border px-4 py-3 pr-12 font-mono text-sm focus:outline-none focus:border-orange transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-2">
                  Повторите пароль *
                </label>
                <input
                  type={showPass ? "text" : "password"}
                  value={form.password2}
                  onChange={(e) => handleChange("password2", e.target.value)}
                  required
                  placeholder="••••••••"
                  className={`w-full bg-background border-2 px-4 py-3 font-mono text-sm focus:outline-none transition-colors ${
                    form.password2 && form.password !== form.password2
                      ? "border-destructive focus:border-destructive"
                      : "border-border focus:border-orange"
                  }`}
                />
                {form.password2 && form.password !== form.password2 && (
                  <p className="font-mono text-xs text-destructive mt-1">Пароли не совпадают</p>
                )}
              </div>

              {error && (
                <p className="font-mono text-xs text-destructive border border-destructive/20 bg-destructive/10 px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || (!!form.password2 && form.password !== form.password2)}
                className="w-full bg-orange text-primary-foreground px-6 py-3 font-display text-xl tracking-widest hover:bg-orange-bright transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" />}
                {loading ? "Создаём аккаунт..." : "Зарегистрироваться"}
              </button>
            </div>

          </form>
        ) : (
          <div className="border-2 border-border bg-surface p-8 shadow-brutal text-center">
            <div className="w-14 h-14 bg-orange/10 border-2 border-orange flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 className="w-7 h-7 text-orange" />
            </div>
            <h2 className="font-display text-2xl tracking-wider mb-3">РЕГИСТРАЦИЯ ЗАВЕРШЕНА</h2>
            <p className="font-mono text-sm text-muted-foreground mb-6">
              Аккаунт успешно создан. Теперь вы можете войти.
            </p>
            <Link
              to={`/login?returnTo=${encodeURIComponent(returnTo)}`}
              className="inline-flex items-center gap-2 bg-orange text-primary-foreground px-6 py-3 font-display text-xl tracking-widest hover:bg-orange-bright transition-colors"
            >
              Войти
            </Link>
          </div>
        )}

        <div className="mt-4 text-center">
          <Link
            to={`/login?returnTo=${encodeURIComponent(returnTo)}`}
            className="font-mono text-xs text-muted-foreground hover:text-orange transition-colors"
          >
            Уже есть аккаунт? Войти
          </Link>
        </div>
      </div>
    </div>
  );
}
