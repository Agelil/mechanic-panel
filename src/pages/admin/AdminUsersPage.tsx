import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, UserCog, Trash2, AlertCircle, RefreshCw, Crown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type AppRole = "admin" | "master" | "manager";

interface UserRow {
  id: string;
  user_id: string | null;
  email: string | null;
  full_name: string | null;
  display_name: string | null;
  phone: string | null;
  role: string | null;
  is_approved: boolean;
  source: string;
  created_at: string;
}

const ROLE_LABELS: Record<AppRole, { label: string; color: string; desc: string }> = {
  admin: { label: "Администратор", color: "text-orange border-orange/30 bg-orange/10", desc: "Полный доступ ко всем разделам" },
  manager: { label: "Менеджер", color: "text-blue-400 border-blue-400/30 bg-blue-400/10", desc: "Услуги, портфолио, акции" },
  master: { label: "Мастер", color: "text-green-400 border-green-400/30 bg-green-400/10", desc: "Просмотр и изменение статусов заявок" },
};

export default function AdminUsersPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (session) setCurrentUserId(session.user.id);

    // Only show staff users (those with a role assigned or approved as staff)
    const { data, error } = await supabase
      .from("users_registry" as any)
      .select("*")
      .eq("is_approved", true)
      .not("role", "is", null)
      .in("role", ["admin", "manager", "master"])
      .order("created_at", { ascending: false });

    if (!error && data) {
      setUsers(data as unknown as UserRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRoleChange = async (user: UserRow, newRole: AppRole) => {
    setSaving(user.id);
    try {
      const { error: regErr } = await supabase
        .from("users_registry" as any)
        .update({ role: newRole } as any)
        .eq("id", user.id);
      if (regErr) throw regErr;

      if (user.user_id) {
        await supabase
          .from("user_roles")
          .upsert({ user_id: user.user_id, role: newRole } as any, { onConflict: "user_id" });
      }

      toast({ title: "Роль обновлена" });
      await load();
    } catch (e: any) {
      toast({ title: "Ошибка назначения роли", description: e.message || String(e), variant: "destructive" });
    }
    setSaving(null);
  };

  const handleRemoveRole = async (user: UserRow) => {
    if (!confirm("Убрать роль у сотрудника?")) return;
    await supabase.from("users_registry" as any).update({ role: null } as any).eq("id", user.id);
    if (user.user_id) {
      await supabase.from("user_roles").delete().eq("user_id", user.user_id);
    }
    toast({ title: "Роль удалена" });
    await load();
  };

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="font-display text-4xl tracking-wider">СОТРУДНИКИ</h1>
          <p className="font-mono text-sm text-muted-foreground">Управление ролями сотрудников</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 border-2 border-border px-4 py-2 font-mono text-xs hover:border-orange hover:text-orange transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          Обновить
        </button>
      </div>

      {/* Role legend */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
        {(Object.entries(ROLE_LABELS) as [AppRole, typeof ROLE_LABELS[AppRole]][]).map(([role, info]) => (
          <div key={role} className="bg-surface border-2 border-border p-4">
            <span className={`font-mono text-xs border px-2 py-0.5 ${info.color}`}>{info.label}</span>
            <p className="font-mono text-xs text-muted-foreground mt-2">{info.desc}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 text-orange animate-spin" />
        </div>
      ) : (
        <div className="space-y-px bg-border mb-8">
          {users.map((user) => {
            const roleInfo = user.role ? ROLE_LABELS[user.role as AppRole] : null;
            const isCurrentUser = user.user_id === currentUserId;
            return (
              <div key={user.id} className={`bg-background p-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:bg-surface transition-colors ${isCurrentUser ? "border-l-2 border-orange" : ""}`}>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`w-9 h-9 flex items-center justify-center flex-shrink-0 ${isCurrentUser ? "bg-orange text-primary-foreground" : "bg-orange/10 border border-orange/20"}`}>
                    {isCurrentUser ? <Crown className="w-4 h-4" /> : <UserCog className="w-4 h-4 text-orange" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-mono text-sm truncate">{user.display_name || user.full_name || user.email || "—"}</p>
                      {isCurrentUser && <span className="font-mono text-xs text-orange">(вы)</span>}
                    </div>
                    {user.email && <p className="font-mono text-xs text-muted-foreground truncate">{user.email}</p>}
                    {user.phone && <p className="font-mono text-xs text-muted-foreground">📞 {user.phone}</p>}
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  {roleInfo && (
                    <span className={`font-mono text-xs border px-2 py-0.5 ${roleInfo.color}`}>{roleInfo.label}</span>
                  )}

                  <Select
                    value={user.role || "none"}
                    onValueChange={(val) => {
                      if (val !== "none") handleRoleChange(user, val as AppRole);
                    }}
                    disabled={saving === user.id}
                  >
                    <SelectTrigger className="w-44 bg-background border-2 border-border font-mono text-xs rounded-none h-9">
                      {saving === user.id ? (
                        <div className="flex items-center gap-1.5">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Сохраняем...</span>
                        </div>
                      ) : (
                        <SelectValue placeholder="Назначить роль" />
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="font-mono text-xs">— Без роли</SelectItem>
                      <SelectItem value="admin" className="font-mono text-xs">Администратор</SelectItem>
                      <SelectItem value="manager" className="font-mono text-xs">Менеджер</SelectItem>
                      <SelectItem value="master" className="font-mono text-xs">Мастер</SelectItem>
                    </SelectContent>
                  </Select>

                  {user.role && !isCurrentUser && (
                    <button
                      onClick={() => handleRemoveRole(user)}
                      className="p-2 text-muted-foreground hover:text-destructive border border-border hover:border-destructive transition-colors"
                      title="Убрать роль"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {users.length === 0 && (
            <div className="bg-background p-8 text-center">
              <p className="font-mono text-sm text-muted-foreground">Нет одобренных сотрудников</p>
            </div>
          )}
        </div>
      )}

      {/* Bootstrap tip */}
      <div className="bg-orange/5 border-2 border-orange/20 p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-orange flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-display text-lg tracking-wider text-orange mb-2">ПЕРВЫЙ ЗАПУСК</h4>
            <p className="font-mono text-xs text-muted-foreground">
              Если роль не назначается — вы первый пользователь и можете назначить себе <strong>Администратора</strong> напрямую.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
