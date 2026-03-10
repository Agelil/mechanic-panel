import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, UserCog, Shield, ChevronDown, Trash2, UserPlus } from "lucide-react";
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
}

const ROLE_LABELS: Record<AppRole, { label: string; color: string; desc: string }> = {
  admin: { label: "Администратор", color: "text-orange border-orange/30 bg-orange/10", desc: "Полный доступ ко всем разделам" },
  manager: { label: "Менеджер", color: "text-blue-400 border-blue-400/30 bg-blue-400/10", desc: "Услуги, портфолио, акции (без настроек)" },
  master: { label: "Мастер", color: "text-green-400 border-green-400/30 bg-green-400/10", desc: "Только просмотр и изменение статусов заявок" },
};

export default function AdminUsersPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("master");
  const [inviting, setInviting] = useState(false);

  const load = async () => {
    // Get current user's role assignments
    const { data: roles } = await supabase
      .from("user_roles")
      .select("id, user_id, role");

    // Get session to get current user
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Build user list from roles + current user
    const roleMap: Record<string, { role: AppRole; id: string }> = {};
    roles?.forEach((r: { id: string; user_id: string; role: AppRole }) => {
      roleMap[r.user_id] = { role: r.role, id: r.id };
    });

    // We can only list users we know about via their roles + current user
    const knownUserIds = new Set([session.user.id, ...Object.keys(roleMap)]);
    const userRows: UserRow[] = [];

    for (const uid of knownUserIds) {
      if (uid === session.user.id) {
        userRows.push({
          id: uid,
          email: session.user.email || uid,
          created_at: session.user.created_at || "",
          role: roleMap[uid]?.role || null,
          role_record_id: roleMap[uid]?.id || null,
        });
      } else if (roleMap[uid]) {
        userRows.push({
          id: uid,
          email: uid, // email not available via RLS for other users
          created_at: "",
          role: roleMap[uid].role,
          role_record_id: roleMap[uid].id,
        });
      }
    }

    setUsers(userRows);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleRoleChange = async (userId: string, newRole: AppRole, existingRecordId: string | null) => {
    setSaving(userId);
    try {
      if (existingRecordId) {
        await supabase.from("user_roles").update({ role: newRole }).eq("id", existingRecordId);
      } else {
        await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
      }
      toast({ title: "Роль обновлена" });
      await load();
    } catch {
      toast({ title: "Ошибка", variant: "destructive" });
    }
    setSaving(null);
  };

  const handleRemoveRole = async (recordId: string) => {
    if (!confirm("Убрать роль у пользователя?")) return;
    await supabase.from("user_roles").delete().eq("id", recordId);
    toast({ title: "Роль удалена" });
    await load();
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      // Use admin API via edge function or just create the role assignment — 
      // in practice admin invites via Supabase dashboard, but we can create a placeholder
      toast({
        title: "Функция приглашения",
        description: "Создайте пользователя через Cloud → Users, затем назначьте роль здесь.",
      });
    } finally {
      setInviting(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-4xl tracking-wider">ПОЛЬЗОВАТЕЛИ</h1>
        <p className="font-mono text-sm text-muted-foreground">Управление ролями и правами доступа</p>
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
            return (
              <div key={user.id} className="bg-background p-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:bg-surface transition-colors">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 bg-orange/10 border border-orange/20 flex items-center justify-center flex-shrink-0">
                    <UserCog className="w-4 h-4 text-orange" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-mono text-sm truncate">{user.email}</p>
                    {user.created_at && (
                      <p className="font-mono text-xs text-muted-foreground">
                        {new Date(user.created_at).toLocaleDateString("ru-RU")}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
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
                        <Loader2 className="w-3 h-3 animate-spin" />
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
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Guide */}
      <div className="bg-orange/5 border-2 border-orange/20 p-5">
        <h4 className="font-display text-lg tracking-wider text-orange mb-3">УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ</h4>
        <ol className="space-y-2">
          {[
            "Откройте Cloud → Users для создания нового пользователя",
            "После создания, пользователь появится здесь при следующем входе",
            "Назначьте роль через выпадающий список напротив пользователя",
            "Роли применяются немедленно без перезапуска сессии",
            "Для удаления пользователя используйте Cloud → Users",
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="font-mono text-xs text-orange border border-orange/30 w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
                {i + 1}
              </span>
              <span className="font-mono text-xs text-muted-foreground">{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
