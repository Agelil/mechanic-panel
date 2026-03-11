import { useState, useEffect, useRef } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, LogIn, Eye, EyeOff, Wrench, Mail } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/cabinet";

  const [mode, setMode] = useState<"email" | "telegram">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const widgetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate(returnTo, { replace: true });
    });
  }, [navigate, returnTo]);

  // Telegram widget
  useEffect(() => {
    if (mode !== "telegram" || !widgetRef.current) return;
    // Clear previous widget
    widgetRef.current.innerHTML = "";

    (window as any).onTelegramAuth = (user: any) => {
      localStorage.setItem("tg_cabinet_user", JSON.stringify(user));
      navigate("/cabinet", { replace: true });
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
  }, [mode, navigate]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError("Неверный email или пароль");
    } else {
      navigate(returnTo, { replace: true });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center bg-grid pt-16">
      <div className="w-full max-w-sm px-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-orange flex items-center justify-center mx-auto mb-4">
            <Wrench className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="font-display text-4xl tracking-widest">
            СЕРВИС<span className="text-orange">-</span>ТОЧКА
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-2 uppercase tracking-widest">
            Личный кабинет
          </p>
        </div>

        <div className="border-2 border-border bg-surface p-8 shadow-brutal">
          <h2 className="font-display text-2xl tracking-wider mb-6">ВХОД</h2>

          {/* Mode tabs */}
          <div className="flex gap-px bg-border mb-6">
            <button
              onClick={() => setMode("email")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 font-mono text-xs transition-colors ${
                mode === "email" ? "bg-orange text-primary-foreground" : "bg-surface text-muted-foreground hover:text-foreground"
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              Email
            </button>
            <button
              onClick={() => setMode("telegram")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 font-mono text-xs transition-colors ${
                mode === "telegram" ? "bg-orange text-primary-foreground" : "bg-surface text-muted-foreground hover:text-foreground"
              }`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
              </svg>
              Telegram
            </button>
          </div>

          {mode === "email" ? (
            <form onSubmit={handleEmailLogin} className="space-y-5">
              <div>
                <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); }}
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
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(""); }}
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
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
                {loading ? "Загрузка..." : "Войти"}
              </button>
            </form>
          ) : (
            <div className="text-center py-6">
              <p className="font-mono text-sm text-muted-foreground mb-6">
                Нажмите кнопку ниже для входа через Telegram
              </p>
              <div ref={widgetRef} className="flex justify-center" />
            </div>
          )}
        </div>

        <div className="mt-4 text-center">
          <Link
            to={`/register?returnTo=${encodeURIComponent(returnTo)}`}
            className="font-mono text-xs text-muted-foreground hover:text-orange transition-colors"
          >
            Нет аккаунта? Зарегистрироваться
          </Link>
        </div>
      </div>
    </div>
  );
}
