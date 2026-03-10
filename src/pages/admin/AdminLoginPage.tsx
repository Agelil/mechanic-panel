import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, LogIn, Eye, EyeOff, Wrench, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [allowRegistration, setAllowRegistration] = useState(false);
  const [checkingSettings, setCheckingSettings] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/admin");
    });
    // Check if registration is enabled
    supabase.from("settings").select("value").eq("key", "allow_registration").maybeSingle().then(({ data }) => {
      setAllowRegistration(data?.value === "true");
      setCheckingSettings(false);
    });
  }, [navigate]);

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
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/admin` },
    });
    if (error) {
      setError(error.message);
    } else {
      setError("");
      setMode("login");
      // Show success - display a temporary message
      alert("Аккаунт создан! Проверьте email для подтверждения.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center bg-grid">
      <div className="w-full max-w-sm px-4">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="w-12 h-12 bg-orange flex items-center justify-center mx-auto mb-4">
            <Wrench className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="font-display text-4xl tracking-widest">СЕРВИС<span className="text-orange">-</span>ТОЧКА</h1>
          <p className="font-mono text-xs text-muted-foreground mt-2 uppercase tracking-widest">Панель управления</p>
        </div>

        {/* Form */}
        <form
          onSubmit={mode === "login" ? handleLogin : handleRegister}
          className="border-2 border-border bg-surface p-8 shadow-brutal"
        >
          <h2 className="font-display text-2xl tracking-wider mb-6">
            {mode === "login" ? "ВХОД" : "РЕГИСТРАЦИЯ"}
          </h2>

          <div className="space-y-5">
            <div>
              <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-2">Email</label>
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
              <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-2">Пароль</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={mode === "register" ? 6 : undefined}
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
              {mode === "register" && (
                <p className="font-mono text-xs text-muted-foreground mt-1">Минимум 6 символов</p>
              )}
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
              {loading
                ? <Loader2 className="w-5 h-5 animate-spin" />
                : mode === "login"
                  ? <LogIn className="w-5 h-5" />
                  : <UserPlus className="w-5 h-5" />
              }
              {loading ? "Загрузка..." : mode === "login" ? "Войти" : "Создать аккаунт"}
            </button>
          </div>
        </form>

        {/* Toggle login/register */}
        {!checkingSettings && allowRegistration && (
          <button
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
            className="w-full mt-4 font-mono text-xs text-muted-foreground hover:text-orange transition-colors text-center"
          >
            {mode === "login" ? "Нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
          </button>
        )}
      </div>
    </div>
  );
}
