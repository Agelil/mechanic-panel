import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, Loader2, UserCheck, Shield, Clock, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/use-user-role";

interface Profile {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  is_approved: boolean;
  is_blocked: boolean;
  created_at: string;
}

type FilterType = "pending" | "approved" | "blocked" | "all";

export default function AdminAccessPage() {
  const { toast } = useToast();
  const { isAtLeast } = useUserRole();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("pending");
  const [search, setSearch] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setProfiles((data as Profile[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const approve = async (userId: string) => {
    setProcessing(userId);
    const { error } = await supabase
      .from("profiles")
      .update({ is_approved: true, is_blocked: false })
      .eq("user_id", userId);

    if (error) {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    } else {
      setProfiles((p) => p.map((pr) => pr.user_id === userId ? { ...pr, is_approved: true, is_blocked: false } : pr));
      toast({ title: "Одобрено", description: "Пользователь получил доступ к системе." });

      // Audit log
      const { data: { session } } = await supabase.auth.getSession();
      await supabase.from("security_audit_log").insert({
        user_id: session?.user?.id,
        user_email: session?.user?.email,
        action: "approve_user",
        target_table: "profiles",
        target_id: userId,
        details: { approved_user_id: userId },
      });
    }
    setProcessing(null);
  };

  const block = async (userId: string) => {
    setProcessing(userId);
    const { error } = await supabase
      .from("profiles")
      .update({ is_approved: false, is_blocked: true })
      .eq("user_id", userId);

    if (error) {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    } else {
      setProfiles((p) => p.map((pr) => pr.user_id === userId ? { ...pr, is_approved: false, is_blocked: true } : pr));
      toast({ title: "Заблокировано", description: "Пользователю закрыт доступ.", variant: "destructive" });

      // Audit log
      const { data: { session } } = await supabase.auth.getSession();
      await supabase.from("security_audit_log").insert({
        user_id: session?.user?.id,
        user_email: session?.user?.email,
        action: "block_user",
        target_table: "profiles",
        target_id: userId,
        details: { blocked_user_id: userId },
      });
    }
    setProcessing(null);
  };

  const counts = {
    all: profiles.length,
    pending: profiles.filter((p) => !p.is_approved && !p.is_blocked).length,
    approved: profiles.filter((p) => p.is_approved && !p.is_blocked).length,
    blocked: profiles.filter((p) => p.is_blocked).length,
  };

  const filtered = profiles
    .filter((p) => {
      if (filter === "pending") return !p.is_approved && !p.is_blocked;
      if (filter === "approved") return p.is_approved && !p.is_blocked;
      if (filter === "blocked") return p.is_blocked;
      return true;
    })
    .filter((p) => {
      if (!search) return true;
      const s = search.toLowerCase();
      return (p.email || "").toLowerCase().includes(s) || (p.full_name || "").toLowerCase().includes(s);
    });

  if (!isAtLeast("manager")) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-30" />
          <p className="font-mono text-sm text-muted-foreground">Недостаточно прав доступа</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-4xl tracking-wider">УПРАВЛЕНИЕ ДОСТУПОМ</h1>
        <p className="font-mono text-sm text-muted-foreground">Модерация регистраций пользователей</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border mb-6">
        {([
          { key: "pending", label: "Ожидают", icon: Clock, color: "text-orange" },
          { key: "approved", label: "Одобрены", icon: CheckCircle2, color: "text-green-400" },
          { key: "blocked", label: "Заблокированы", icon: XCircle, color: "text-destructive" },
          { key: "all", label: "Всего", icon: UserCheck, color: "text-muted-foreground" },
        ] as const).map(({ key, label, icon: Icon, color }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`bg-surface p-4 text-left transition-colors hover:bg-surface/80 ${filter === key ? "ring-1 ring-orange" : ""}`}
          >
            <Icon className={`w-5 h-5 ${color} mb-2`} />
            <div className={`font-display text-3xl ${color}`}>{counts[key]}</div>
            <div className="font-mono text-xs text-muted-foreground">{label}</div>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по email или имени..."
          className="w-full bg-surface border-2 border-border pl-9 pr-4 py-3 font-mono text-sm focus:outline-none focus:border-orange transition-colors"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 text-orange animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-border">
          <p className="font-mono text-sm text-muted-foreground">
            {filter === "pending" ? "Нет пользователей, ожидающих одобрения" : "Пользователей не найдено"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((profile) => (
            <div
              key={profile.id}
              className="bg-surface border-2 border-border p-4 flex flex-col sm:flex-row sm:items-center gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  {/* Status badge */}
                  {profile.is_blocked ? (
                    <span className="font-mono text-xs border px-2 py-0.5 text-destructive border-destructive/30 bg-destructive/10">
                      ЗАБЛОКИРОВАН
                    </span>
                  ) : profile.is_approved ? (
                    <span className="font-mono text-xs border px-2 py-0.5 text-green-400 border-green-400/30 bg-green-400/10">
                      ОДОБРЕН
                    </span>
                  ) : (
                    <span className="font-mono text-xs border px-2 py-0.5 text-orange border-orange/30 bg-orange/10">
                      НА РАССМОТРЕНИИ
                    </span>
                  )}
                </div>
                <p className="font-mono text-sm font-bold truncate">{profile.email || "—"}</p>
                {profile.full_name && (
                  <p className="font-mono text-xs text-muted-foreground">{profile.full_name}</p>
                )}
                <p className="font-mono text-xs text-muted-foreground mt-1">
                  Зарегистрирован: {new Date(profile.created_at).toLocaleString("ru-RU")}
                </p>
              </div>

              <div className="flex gap-2 flex-shrink-0">
                {!profile.is_approved && (
                  <button
                    onClick={() => approve(profile.user_id)}
                    disabled={processing === profile.user_id}
                    className="flex items-center gap-1.5 font-mono text-xs border-2 border-green-400/40 text-green-400 px-3 py-2 hover:bg-green-400/10 transition-colors disabled:opacity-50"
                  >
                    {processing === profile.user_id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3 h-3" />
                    )}
                    Одобрить
                  </button>
                )}
                {!profile.is_blocked && (
                  <button
                    onClick={() => block(profile.user_id)}
                    disabled={processing === profile.user_id}
                    className="flex items-center gap-1.5 font-mono text-xs border-2 border-destructive/40 text-destructive px-3 py-2 hover:bg-destructive/10 transition-colors disabled:opacity-50"
                  >
                    {processing === profile.user_id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <XCircle className="w-3 h-3" />
                    )}
                    Заблокировать
                  </button>
                )}
                {profile.is_blocked && (
                  <button
                    onClick={() => approve(profile.user_id)}
                    disabled={processing === profile.user_id}
                    className="flex items-center gap-1.5 font-mono text-xs border-2 border-orange/40 text-orange px-3 py-2 hover:bg-orange/10 transition-colors disabled:opacity-50"
                  >
                    {processing === profile.user_id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3 h-3" />
                    )}
                    Разблокировать
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
