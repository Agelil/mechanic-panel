import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, UserCog, Trash2, AlertCircle, RefreshCw, Crown, Pencil, X, AlertTriangle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
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
  admin:   { label: "Администратор", color: "text-orange border-orange/30 bg-orange/10", desc: "Полный доступ ко всем разделам" },
  manager: { label: "Менеджер",      color: "text-blue-400 border-blue-400/30 bg-blue-400/10", desc: "Услуги, портфолио, акции" },
  master:  { label: "Мастер",        color: "text-green-400 border-green-400/30 bg-green-400/10", desc: "Просмотр и изменение статусов заявок" },
};

const NAME_REGEX = /^\S+\s+\S+/;

export default function AdminUsersPage() {
  const { toast } = useToast();
  const { user: currentUser, isOwner } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // Edit modal state
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRole, setEditRole] = useState<AppRole>("master");
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
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
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    }
    setSaving(null);
  };

  const openEdit = (user: UserRow) => {
    setEditUser(user);
    setEditName(user.full_name || user.display_name || "");
    setEditPhone(user.phone || "");
    setEditRole((user.role as AppRole) || "master");
    setEditError("");
  };

  const handleEditSave = async () => {
    if (!editUser) return;
    if (!editName.trim()) { setEditError("Введите имя и фамилию"); return; }
    if (!NAME_REGEX.test(editName.trim())) {
      setEditError("Укажите минимум два слова (Имя и Фамилия)");
      return;
    }
    setEditSaving(true);
    setEditError("");

    try {
      // Update registry
      const { error: regErr } = await supabase
        .from("users_registry" as any)
        .update({
          full_name: editName.trim(),
          phone: editPhone.trim() || null,
          role: editRole,
        } as any)
        .eq("id", editUser.id);
      if (regErr) throw regErr;

      // Update profiles + user_roles if linked
      if (editUser.user_id) {
        await supabase.from("profiles")
          .update({ full_name: editName.trim() })
          .eq("user_id", editUser.user_id);
        await supabase
          .from("user_roles")
          .upsert({ user_id: editUser.user_id, role: editRole } as any, { onConflict: "user_id" });
      }

      // Phone change warning handled in UI
      toast({ title: "Сотрудник обновлён" });
      setEditUser(null);
      await load();
    } catch (e: any) {
      setEditError(e.message || String(e));
    }
    setEditSaving(false);
  };

  const handleDelete = async (user: UserRow) => {
    if (!isOwner) {
      toast({ title: "Только владелец может удалять сотрудников", variant: "destructive" });
      return;
    }
    if (!confirm(`Удалить сотрудника ${user.full_name || user.email}? Это действие необратимо.`)) return;

    setSaving(user.id);
    try {
      // Remove role
      if (user.user_id) {
        await supabase.from("user_roles").delete().eq("user_id", user.user_id);
        await supabase.from("profiles").update({ is_approved: false, is_blocked: true }).eq("user_id", user.user_id);
      }
      // Remove from registry
      await supabase.from("users_registry" as any).delete().eq("id", user.id);

      // Audit
      const { data: { session } } = await supabase.auth.getSession();
      await supabase.from("security_audit_log").insert({
        user_id: session?.user?.id,
        user_email: session?.user?.email,
        action: "delete_staff",
        target_table: "users_registry",
        target_id: user.id,
        details: { deleted_email: user.email, deleted_name: user.full_name },
      });

      toast({ title: "Сотрудник удалён" });
      await load();
    } catch (e: any) {
      toast({ title: "Ошибка удаления", description: e.message, variant: "destructive" });
    }
    setSaving(null);
  };

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="font-display text-4xl tracking-wider">СОТРУДНИКИ</h1>
          <p className="font-mono text-sm text-muted-foreground">Управление ролями и данными сотрудников</p>
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
            const isCurrentUser = user.user_id === currentUser?.id;
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

                <div className="flex items-center gap-2 flex-wrap">
                  {roleInfo && (
                    <span className={`font-mono text-xs border px-2 py-0.5 ${roleInfo.color}`}>{roleInfo.label}</span>
                  )}

                  {isOwner && (
                    <Select
                      value={user.role || "none"}
                      onValueChange={(val) => {
                        if (val !== "none") handleRoleChange(user, val as AppRole);
                      }}
                      disabled={saving === user.id}
                    >
                      <SelectTrigger className="w-40 bg-background border-2 border-border font-mono text-xs rounded-none h-9">
                        {saving === user.id ? (
                          <div className="flex items-center gap-1.5">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>...</span>
                          </div>
                        ) : (
                          <SelectValue placeholder="Роль" />
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" className="font-mono text-xs">— Без роли</SelectItem>
                        <SelectItem value="admin" className="font-mono text-xs">Администратор</SelectItem>
                        <SelectItem value="manager" className="font-mono text-xs">Менеджер</SelectItem>
                        <SelectItem value="master" className="font-mono text-xs">Мастер</SelectItem>
                      </SelectContent>
                    </Select>
                  )}

                  {/* Edit button */}
                  <button
                    onClick={() => openEdit(user)}
                    className="p-2 text-muted-foreground hover:text-orange border border-border hover:border-orange transition-colors"
                    title="Редактировать"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>

                  {/* Delete — owner only, not self */}
                  {isOwner && !isCurrentUser && (
                    <button
                      onClick={() => handleDelete(user)}
                      disabled={saving === user.id}
                      className="p-2 text-muted-foreground hover:text-destructive border border-border hover:border-destructive transition-colors disabled:opacity-50"
                      title="Удалить сотрудника"
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

      {/* ── Edit Modal ── */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-surface border-2 border-border shadow-brutal w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display text-xl tracking-wider">РЕДАКТИРОВАНИЕ</h3>
              <button onClick={() => setEditUser(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-1">Имя и Фамилия</label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Иван Иванов"
                  className="w-full bg-background border-2 border-border px-4 py-3 font-mono text-sm focus:outline-none focus:border-orange transition-colors"
                />
              </div>
              <div>
                <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-1">Телефон</label>
                <input
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="+7 (999) 000-00-00"
                  className="w-full bg-background border-2 border-border px-4 py-3 font-mono text-sm focus:outline-none focus:border-orange transition-colors"
                />
                {editPhone !== (editUser.phone || "") && editPhone.trim() && (
                  <div className="flex items-center gap-1.5 mt-1 text-orange">
                    <AlertTriangle className="w-3 h-3" />
                    <span className="font-mono text-xs">Смена телефона может потребовать повторной привязки Telegram</span>
                  </div>
                )}
              </div>
              {isOwner && (
                <div>
                  <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-1">Роль</label>
                  <Select value={editRole} onValueChange={(v) => setEditRole(v as AppRole)}>
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
              )}

              {editError && (
                <p className="font-mono text-xs text-destructive border border-destructive/20 bg-destructive/10 px-3 py-2">{editError}</p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setEditUser(null)}
                  className="flex-1 font-mono text-sm border-2 border-border py-2.5 hover:border-muted-foreground transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={handleEditSave}
                  disabled={editSaving}
                  className="flex-1 bg-orange text-primary-foreground font-mono text-sm py-2.5 flex items-center justify-center gap-2 hover:bg-orange-bright transition-colors disabled:opacity-50"
                >
                  {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
