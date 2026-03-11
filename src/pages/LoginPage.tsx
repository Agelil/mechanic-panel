import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, LogIn, Eye, EyeOff, Wrench } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/cabinet";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate(returnTo, { replace: true });
    });
  }, [navigate, returnTo]);

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
