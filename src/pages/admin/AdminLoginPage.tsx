import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, LogIn, Eye, EyeOff, Wrench, UserPlus, ArrowLeft, CheckCircle2, AlertTriangle } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

type Mode = "login" | "register";

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/admin";
  const isExpired = searchParams.get("expired") === "1";

  const [mode, setMode] = useState<Mode>("login");

  // Login fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(isExpired ? "Сессия истекла. Пожалуйста, войдите снова." : "");

  // Register fields
  const [regFullName, setRegFullName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPassword2, setRegPassword2] = useState("");
  const [showRegPass, setShowRegPass] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState("");
  const [regSuccess, setRegSuccess] = useState(false);

  const [allowRegistration, setAllowRegistration] = useState(false);
  const [checkingSettings, setCheckingSettings] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate(returnTo, { replace: true });
    });
    supabase
      .from("settings")
      .select("value")
      .eq("key", "allow_registration")
      .maybeSingle()
      .then(({ data }) => {
        setAllowRegistration(data?.value === "true");
        setCheckingSettings(false);
      });
  }, [navigate, returnTo]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("Неверный email или пароль");
    } else {
      navigate("/admin");
    }
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError("");

    if (!regFullName.trim()) {
      setRegError("Введите ваше имя");
      return;
    }
    if (!regEmail.trim()) {
      setRegError("Введите email");
      return;
    }
    if (regPassword.length < 6) {
      setRegError("Пароль должен быть не менее 6 символов");
      return;
    }
    if (regPassword !== regPassword2) {
      setRegError("Пароли не совпадают");
      return;
    }

    setRegLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: regEmail.trim(),
      password: regPassword,
      options: {
        emailRedirectTo: `${window.location.origin}/admin`,
        data: { full_name: regFullName.trim() },
      },
    });

    if (error) {
      if (error.message.includes("already registered") || error.message.includes("already exists")) {
        setRegError("Пользователь с этим email уже зарегистрирован");
      } else {
        setRegError(error.message);
      }
      setRegLoading(false);
      return;
    }

    if (data.user) {
      // Upsert profile with full_name
      await supabase.from("profiles").upsert(
        {
          user_id: data.user.id,
          email: data.user.email,
          full_name: regFullName.trim(),
          is_approved: false,
          is_blocked: false,
        },
        { onConflict: "user_id" }
      );

      // Notify admin via Telegram
      try {
        await supabase.functions.invoke("send-telegram-notification", {
          body: {
            type: "new_registration",
            email: data.user.email,
            full_name: regFullName.trim(),
            user_id: data.user.id,
          },
        });
      } catch {
        /* non-critical */
      }
    }

    setRegLoading(false);
    setRegSuccess(true);
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setError("");
    setRegError("");
    setRegSuccess(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center bg-grid">
      <div className="w-full max-w-sm px-4">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="w-12 h-12 bg-orange flex items-center justify-center mx-auto mb-4">
            <Wrench className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="font-display text-4xl tracking-widest">
            СЕРВИС<span className="text-orange">-</span>ТОЧКА
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-2 uppercase tracking-widest">
            Панель управления
          </p>
        </div>

        {/* ── LOGIN FORM ── */}
        {mode === "login" && (
          <form
            onSubmit={handleLogin}
            className="border-2 border-border bg-surface p-8 shadow-brutal"
          >
            <h2 className="font-display text-2xl tracking-wider mb-6">ВХОД</h2>

            <div className="space-y-5">
              <div>
                <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="admin@example.com"
                  className="w-full bg-background border-2 border-border px-4 py-3 font-mono text-sm focus:outline-none focus:border-orange transition-colors"
                />
              </div>

              <div>
                <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-2">
                  Пароль
                </label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
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

              {error && (
                <p className="font-mono text-xs text-destructive border border-destructive/20 bg-destructive/10 px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-orange text-primary-foreground px-6 py-3 font-display text-xl tracking-widest hover:bg-orange-bright transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <LogIn className="w-5 h-5" />
                )}
                {loading ? "Загрузка..." : "Войти"}
              </button>
            </div>
          </form>
        )}

        {/* ── REGISTER FORM ── */}
        {mode === "register" && !regSuccess && (
          <form
            onSubmit={handleRegister}
            className="border-2 border-border bg-surface p-8 shadow-brutal"
          >
            <div className="flex items-center gap-3 mb-6">
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="text-muted-foreground hover:text-orange transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <h2 className="font-display text-2xl tracking-wider">РЕГИСТРАЦИЯ</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-2">
                  Имя и фамилия
                </label>
                <input
                  type="text"
                  value={regFullName}
                  onChange={(e) => setRegFullName(e.target.value)}
                  required
                  placeholder="Иван Иванов"
                  className="w-full bg-background border-2 border-border px-4 py-3 font-mono text-sm focus:outline-none focus:border-orange transition-colors"
                />
              </div>

              <div>
                <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  required
                  placeholder="ivan@example.com"
                  className="w-full bg-background border-2 border-border px-4 py-3 font-mono text-sm focus:outline-none focus:border-orange transition-colors"
                />
              </div>

              <div>
                <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-2">
                  Пароль
                </label>
                <div className="relative">
                  <input
                    type={showRegPass ? "text" : "password"}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="Минимум 6 символов"
                    className="w-full bg-background border-2 border-border px-4 py-3 pr-12 font-mono text-sm focus:outline-none focus:border-orange transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPass(!showRegPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showRegPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-2">
                  Повторите пароль
                </label>
                <input
                  type={showRegPass ? "text" : "password"}
                  value={regPassword2}
                  onChange={(e) => setRegPassword2(e.target.value)}
                  required
                  placeholder="••••••••"
                  className={`w-full bg-background border-2 px-4 py-3 font-mono text-sm focus:outline-none transition-colors ${
                    regPassword2 && regPassword !== regPassword2
                      ? "border-destructive focus:border-destructive"
                      : "border-border focus:border-orange"
                  }`}
                />
                {regPassword2 && regPassword !== regPassword2 && (
                  <p className="font-mono text-xs text-destructive mt-1">Пароли не совпадают</p>
                )}
              </div>

              {regError && (
                <p className="font-mono text-xs text-destructive border border-destructive/20 bg-destructive/10 px-3 py-2">
                  {regError}
                </p>
              )}

              <div className="bg-orange/5 border border-orange/20 px-3 py-2">
                <p className="font-mono text-xs text-muted-foreground">
                  После регистрации аккаунт будет ожидать одобрения администратора
                </p>
              </div>

              <button
                type="submit"
                disabled={regLoading || (!!regPassword2 && regPassword !== regPassword2)}
                className="w-full bg-orange text-primary-foreground px-6 py-3 font-display text-xl tracking-widest hover:bg-orange-bright transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {regLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <UserPlus className="w-5 h-5" />
                )}
                {regLoading ? "Создаём аккаунт..." : "Зарегистрироваться"}
              </button>
            </div>
          </form>
        )}

        {/* ── REGISTER SUCCESS ── */}
        {mode === "register" && regSuccess && (
          <div className="border-2 border-border bg-surface p-8 shadow-brutal text-center">
            <div className="w-14 h-14 bg-orange/10 border-2 border-orange flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 className="w-7 h-7 text-orange" />
            </div>
            <h2 className="font-display text-2xl tracking-wider mb-3">ЗАЯВКА ОТПРАВЛЕНА</h2>
            <div className="w-full h-0.5 bg-orange/20 mb-5" />
            <p className="font-mono text-sm text-muted-foreground leading-relaxed mb-6">
              Аккаунт создан. Администратор рассмотрит вашу заявку и откроет доступ.
            </p>
            <p className="font-mono text-xs text-muted-foreground mb-6">
              Зарегистрированный email: <span className="text-foreground">{regEmail}</span>
            </p>
            <button
              onClick={() => switchMode("login")}
              className="w-full flex items-center justify-center gap-2 border-2 border-border px-6 py-3 font-mono text-sm hover:border-orange hover:text-orange transition-colors"
            >
              <LogIn className="w-4 h-4" />
              Перейти к входу
            </button>
          </div>
        )}

        {/* Toggle login/register */}
        {!checkingSettings && allowRegistration && !regSuccess && (
          <button
            onClick={() => switchMode(mode === "login" ? "register" : "login")}
            className="w-full mt-4 font-mono text-xs text-muted-foreground hover:text-orange transition-colors text-center"
          >
            {mode === "login"
              ? "Нет аккаунта? Зарегистрироваться"
              : "Уже есть аккаунт? Войти"}
          </button>
        )}
      </div>
    </div>
  );
}
