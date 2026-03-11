import { useEffect, useState } from "react";
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
  email: string;
  created_at: string;
  role: AppRole | null;
  role_record_id: string | null;
  display_name: string | null;
  is_approved: boolean;
}

const ROLE_LABELS: Record<AppRole, { label: string; color: string; desc: string }> = {
  admin: { label: "Администратор", color: "text-orange border-orange/30 bg-orange/10", desc: "Полный доступ ко всем разделам" },
  manager: { label: "Менеджер", color: "text-blue-400 border-blue-400/30 bg-blue-400/10", desc: "Услуги, портфолио, акции (без системных настроек)" },
  master: { label: "Мастер", color: "text-green-400 border-green-400/30 bg-green-400/10", desc: "Только просмотр и изменение статусов заявок" },
};

export default function AdminUsersPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }
    setCurrentUserId(session.user.id);

    // Fetch all profiles (admins/managers can see all via RLS)
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, email, display_name, is_approved, created_at");

    // Fetch all role assignments
    const { data: roles } = await supabase
      .from("user_roles")
      .select("id, user_id, role");

    const roleMap: Record<string, { role: AppRole; id: string }> = {};
    roles?.forEach((r: { id: string; user_id: string; role: AppRole }) => {
      roleMap[r.user_id] = { role: r.role, id: r.id };
    });

    const rows: UserRow[] = [];

    if (profiles && profiles.length > 0) {
      profiles.forEach((p: { user_id: string; email: string | null; display_name: string | null; is_approved: boolean; created_at: string }) => {
        rows.push({
          id: p.user_id,
          email: p.email || p.user_id,
          created_at: p.created_at,
          role: roleMap[p.user_id]?.role || null,
          role_record_id: roleMap[p.user_id]?.id || null,
          display_name: p.display_name,
          is_approved: p.is_approved,
        });
      });
    } else {
      // Fallback: at minimum show current user
      rows.push({
        id: session.user.id,
        email: session.user.email || session.user.id,
        created_at: session.user.created_at || "",
        role: roleMap[session.user.id]?.role || null,
        role_record_id: roleMap[session.user.id]?.id || null,
        display_name: null,
        is_approved: true,
      });
      // Add other users known via roles
      Object.entries(roleMap).forEach(([uid, info]) => {
        if (uid !== session.user.id) {
          rows.push({
            id: uid,
            email: uid,
            created_at: "",
            role: info.role,
            role_record_id: info.id,
            display_name: null,
            is_approved: true,
          });
        }
      });
    }

    setUsers(rows);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleRoleChange = async (userId: string, newRole: AppRole, existingRecordId: string | null) => {
    setSaving(userId);
    try {
      let err;
      if (existingRecordId) {
        const res = await supabase.from("user_roles").update({ role: newRole }).eq("id", existingRecordId);
        err = res.error;
      } else {
        const res = await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
        err = res.error;
      }
      if (err) {
        console.error("Role change error:", err);
        toast({
          title: "Ошибка назначения роли",
          description: err.code === "42501"
            ? "Недостаточно прав. Убедитесь, что вы — администратор, или назначьте себе роль 'admin' первым (если это первый запуск)."
            : err.message,
          variant: "destructive",
        });
      } else {
        toast({ title: "Роль обновлена" });
        await load();
      }
    } catch (e) {
      toast({ title: "Ошибка", description: String(e), variant: "destructive" });
    }
    setSaving(null);
  };

  const handleRemoveRole = async (recordId: string) => {
    if (!confirm("Убрать роль у пользователя?")) return;
    const { error } = await supabase.from("user_roles").delete().eq("id", recordId);
    if (error) {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Роль удалена" });
      await load();
    }
  };

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="font-display text-4xl tracking-wider">ПОЛЬЗОВАТЕЛИ</h1>
          <p className="font-mono text-sm text-muted-foreground">Управление ролями и правами доступа</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 border-2 border-border px-4 py-2 font-mono text-xs hover:border-orange hover:text-orange transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
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

      {/* Users table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 text-orange animate-spin" />
        </div>
      ) : (
        <div className="space-y-px bg-border mb-8">
          {users.map((user) => {
            const roleInfo = user.role ? ROLE_LABELS[user.role] : null;
            const isCurrentUser = user.id === currentUserId;
            return (
              <div key={user.id} className={`bg-background p-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:bg-surface transition-colors ${isCurrentUser ? "border-l-2 border-orange" : ""}`}>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`w-9 h-9 flex items-center justify-center flex-shrink-0 ${isCurrentUser ? "bg-orange text-primary-foreground" : "bg-orange/10 border border-orange/20"}`}>
                    {isCurrentUser ? <Crown className="w-4 h-4" /> : <UserCog className="w-4 h-4 text-orange" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-mono text-sm truncate">{user.display_name || user.email}</p>
                      {isCurrentUser && <span className="font-mono text-xs text-orange">(вы)</span>}
                      {!user.is_approved && (
                        <span className="font-mono text-xs border border-yellow-500/30 bg-yellow-500/10 text-yellow-500 px-1.5 py-0.5">
                          ожидает
                        </span>
                      )}
                    </div>
                    {user.display_name && (
                      <p className="font-mono text-xs text-muted-foreground truncate">{user.email}</p>
                    )}
                    {user.created_at && (
                      <p className="font-mono text-xs text-muted-foreground">
                        {new Date(user.created_at).toLocaleDateString("ru-RU")}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  {roleInfo && (
                    <span className={`font-mono text-xs border px-2 py-0.5 ${roleInfo.color}`}>
                      {roleInfo.label}
                    </span>
                  )}

                  <Select
                    value={user.role || "none"}
                    onValueChange={(val) => {
                      if (val !== "none") handleRoleChange(user.id, val as AppRole, user.role_record_id);
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

                  {user.role_record_id && (
                    <button
                      onClick={() => handleRemoveRole(user.role_record_id!)}
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
              <p className="font-mono text-sm text-muted-foreground">Нет пользователей</p>
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
            <p className="font-mono text-xs text-muted-foreground mb-3">
              Если роль не назначается — вы первый пользователь и можете назначить себе <strong>Администратора</strong> напрямую из этой страницы. Система автоматически разрешает первичную настройку, когда в базе нет ни одного admin.
            </p>
            <ol className="space-y-1.5">
              {[
                "Найдите свой email в таблице выше",
                "В выпадающем списке выберите «Администратор»",
                "После сохранения обновите страницу — права применятся",
                "Теперь вы можете управлять ролями других пользователей",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="font-mono text-xs text-orange border border-orange/30 w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
