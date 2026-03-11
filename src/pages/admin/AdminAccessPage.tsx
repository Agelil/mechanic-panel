import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  CheckCircle2, XCircle, Loader2, UserCheck, Shield, Clock, Search, UserCog, RefreshCw, UserPlus
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/use-user-role";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface RegistryUser {
  id: string;
  user_id: string | null;
  email: string | null;
  full_name: string | null;
  display_name: string | null;
  phone: string | null;
  is_approved: boolean;
  is_blocked: boolean;
  role: string | null;
  source: string;
  notes: string | null;
  created_at: string;
}

type AppRole = "admin" | "master" | "manager";
type FilterType = "pending" | "approved" | "blocked" | "all";

const ROLE_LABELS: Record<AppRole, { label: string; color: string }> = {
  admin:   { label: "Администратор", color: "text-orange border-orange/30 bg-orange/10" },
  manager: { label: "Менеджер",      color: "text-blue-400 border-blue-400/30 bg-blue-400/10" },
  master:  { label: "Мастер",        color: "text-green-400 border-green-400/30 bg-green-400/10" },
};

export default function AdminAccessPage() {
  const { toast } = useToast();
  const { isAtLeast } = useUserRole();
  const [users, setUsers] = useState<RegistryUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("pending");
  const [search, setSearch] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);
  const [approveDialogUserId, setApproveDialogUserId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<AppRole>("master");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("users_registry" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setUsers(data as unknown as RegistryUser[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openApproveDialog = (id: string) => {
    setSelectedRole("master");
    setApproveDialogUserId(id);
  };

  const confirmApprove = async () => {
    if (!approveDialogUserId) return;
    const user = users.find((u) => u.id === approveDialogUserId);
    if (!user) return;
    setApproveDialogUserId(null);
    setProcessing(user.id);

    // 1. Update registry
    const { error: regError } = await supabase
      .from("users_registry" as any)
      .update({ is_approved: true, is_blocked: false, role: selectedRole } as any)
      .eq("id", user.id);

    if (regError) {
      toast({ title: "Ошибка", description: regError.message, variant: "destructive" });
      setProcessing(null);
      return;
    }

    // 2. If linked to auth user, also update profiles + user_roles
    if (user.user_id) {
      await supabase.from("profiles").update({ is_approved: true, is_blocked: false }).eq("user_id", user.user_id);
      await supabase.from("user_roles").upsert(
        { user_id: user.user_id, role: selectedRole } as any,
        { onConflict: "user_id" }
      );
    }

    // 3. Audit log
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.from("security_audit_log").insert({
      user_id: session?.user?.id,
      user_email: session?.user?.email,
      action: "approve_user",
      target_table: "users_registry",
      target_id: user.id,
      details: { approved_user_id: user.user_id || user.id, assigned_role: selectedRole },
    });

    toast({
      title: "Пользователь одобрен",
      description: `Роль «${ROLE_LABELS[selectedRole].label}» назначена.`,
    });

    setProcessing(null);
    await load(); // Auto-refresh
  };

  const block = async (user: RegistryUser) => {
    setProcessing(user.id);
    const { error } = await supabase
      .from("users_registry" as any)
      .update({ is_approved: false, is_blocked: true } as any)
      .eq("id", user.id);

    if (error) {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    } else {
      if (user.user_id) {
        await supabase.from("profiles").update({ is_approved: false, is_blocked: true }).eq("user_id", user.user_id);
      }
      toast({ title: "Заблокировано", description: "Пользователю закрыт доступ.", variant: "destructive" });
      const { data: { session } } = await supabase.auth.getSession();
      await supabase.from("security_audit_log").insert({
        user_id: session?.user?.id,
        user_email: session?.user?.email,
        action: "block_user",
        target_table: "users_registry",
        target_id: user.id,
        details: { blocked_user_id: user.user_id || user.id },
      });
      await load(); // Auto-refresh
    }
    setProcessing(null);
  };

  const counts = {
    all:     users.length,
    pending: users.filter((p) => !p.is_approved && !p.is_blocked).length,
    approved:users.filter((p) => p.is_approved && !p.is_blocked).length,
    blocked: users.filter((p) => p.is_blocked).length,
  };

  const filtered = users
    .filter((p) => {
      if (filter === "pending")  return !p.is_approved && !p.is_blocked;
      if (filter === "approved") return p.is_approved && !p.is_blocked;
      if (filter === "blocked")  return p.is_blocked;
      return true;
    })
    .filter((p) => {
      if (!search) return true;
      const s = search.toLowerCase();
      return (p.email || "").toLowerCase().includes(s) 
        || (p.full_name || "").toLowerCase().includes(s)
        || (p.phone || "").toLowerCase().includes(s);
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

  const STAT_ITEMS = [
    { key: "pending"  as const, label: "Ожидают",      icon: Clock,       activeClass: "text-orange border-orange" },
    { key: "approved" as const, label: "Одобрены",     icon: CheckCircle2,activeClass: "text-green-400 border-green-400" },
    { key: "blocked"  as const, label: "Заблокированы",icon: XCircle,     activeClass: "text-destructive border-destructive" },
    { key: "all"      as const, label: "Всего",         icon: UserCheck,   activeClass: "text-muted-foreground border-muted-foreground" },
  ];

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="font-display text-4xl tracking-wider">УПРАВЛЕНИЕ ДОСТУПОМ</h1>
          <p className="font-mono text-sm text-muted-foreground">Модерация регистраций из таблицы users_registry</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 border-2 border-border px-4 py-2 font-mono text-xs hover:border-orange hover:text-orange transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          Обновить данные
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border mb-6">
        {STAT_ITEMS.map(({ key, label, icon: Icon, activeClass }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`bg-surface p-4 text-left transition-colors hover:bg-surface/80 ${filter === key ? `border-2 ${activeClass}` : "border-2 border-transparent"}`}
          >
            <Icon className={`w-5 h-5 mb-2 ${filter === key ? activeClass.split(" ")[0] : "text-muted-foreground"}`} />
            <div className={`font-display text-3xl ${filter === key ? activeClass.split(" ")[0] : "text-foreground"}`}>{counts[key]}</div>
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
          placeholder="Поиск по email, имени или телефону..."
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
          {filtered.map((user) => (
            <div
              key={user.id}
              className="bg-surface border-2 border-border p-4 flex flex-col sm:flex-row sm:items-center gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  {user.is_blocked ? (
                    <span className="font-mono text-xs border px-2 py-0.5 text-destructive border-destructive/30 bg-destructive/10">
                      ЗАБЛОКИРОВАН
                    </span>
                  ) : user.is_approved ? (
                    <span className="font-mono text-xs border px-2 py-0.5 border-border text-muted-foreground">
                      ОДОБРЕН
                    </span>
                  ) : (
                    <span className="font-mono text-xs border px-2 py-0.5 text-orange border-orange/30 bg-orange/10">
                      НА РАССМОТРЕНИИ
                    </span>
                  )}
                  {user.role && ROLE_LABELS[user.role as AppRole] && (
                    <span className={`font-mono text-xs border px-2 py-0.5 ${ROLE_LABELS[user.role as AppRole].color}`}>
                      {ROLE_LABELS[user.role as AppRole].label}
                    </span>
                  )}
                  {user.source === "manual" && (
                    <span className="font-mono text-xs border px-2 py-0.5 border-blue-400/30 bg-blue-400/10 text-blue-400">
                      ВРУЧНУЮ
                    </span>
                  )}
                </div>
                <p className="font-mono text-sm font-bold truncate">{user.display_name || user.full_name || user.email || "—"}</p>
                {user.email && <p className="font-mono text-xs text-muted-foreground">{user.email}</p>}
                {user.phone && <p className="font-mono text-xs text-muted-foreground">📞 {user.phone}</p>}
                <p className="font-mono text-xs text-muted-foreground mt-1">
                  Зарегистрирован: {new Date(user.created_at).toLocaleString("ru-RU")}
                </p>
              </div>

              <div className="flex gap-2 flex-shrink-0">
                {!user.is_approved && (
                  <button
                    onClick={() => openApproveDialog(user.id)}
                    disabled={processing === user.id}
                    className="flex items-center gap-1.5 font-mono text-xs border-2 border-border px-3 py-2 hover:border-orange hover:text-orange transition-colors disabled:opacity-50"
                  >
                    {processing === user.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                    Одобрить
                  </button>
                )}
                {!user.is_blocked && (
                  <button
                    onClick={() => block(user)}
                    disabled={processing === user.id}
                    className="flex items-center gap-1.5 font-mono text-xs border-2 border-destructive/40 text-destructive px-3 py-2 hover:bg-destructive/10 transition-colors disabled:opacity-50"
                  >
                    {processing === user.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                    Заблокировать
                  </button>
                )}
                {user.is_blocked && (
                  <button
                    onClick={() => openApproveDialog(user.id)}
                    disabled={processing === user.id}
                    className="flex items-center gap-1.5 font-mono text-xs border-2 border-orange/40 text-orange px-3 py-2 hover:bg-orange/10 transition-colors disabled:opacity-50"
                  >
                    {processing === user.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                    Разблокировать
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Approve Dialog */}
      {approveDialogUserId && (() => {
        const user = users.find((u) => u.id === approveDialogUserId);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <div className="bg-surface border-2 border-border shadow-brutal w-full max-w-sm p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 bg-orange/10 border border-orange/20 flex items-center justify-center flex-shrink-0">
                  <UserCog className="w-4 h-4 text-orange" />
                </div>
                <div>
                  <h3 className="font-display text-xl tracking-wider">ОДОБРИТЬ ДОСТУП</h3>
                  <p className="font-mono text-xs text-muted-foreground">{user?.email || user?.full_name}</p>
                </div>
              </div>

              <div className="mb-5">
                <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-2">
                  Назначить роль
                </label>
                <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
                  <SelectTrigger className="w-full bg-background border-2 border-border font-mono text-sm rounded-none h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="master" className="font-mono text-sm">Мастер</SelectItem>
                    <SelectItem value="manager" className="font-mono text-sm">Менеджер</SelectItem>
                    <SelectItem value="admin" className="font-mono text-sm">Администратор</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setApproveDialogUserId(null)}
                  className="flex-1 font-mono text-sm border-2 border-border py-2.5 hover:border-muted-foreground transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={confirmApprove}
                  className="flex-1 bg-orange text-primary-foreground font-mono text-sm py-2.5 flex items-center justify-center gap-2 hover:bg-orange-bright transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Одобрить
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
