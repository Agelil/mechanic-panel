import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, UserCog, Trash2, AlertCircle, RefreshCw, Crown, Pencil, X, AlertTriangle, Users, Shield
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
  position: string | null;
  is_approved: boolean;
  source: string;
  created_at: string;
}

interface UserGroup {
  id: string;
  name: string;
}

interface GroupMembership {
  id: string;
  user_id: string;
  group_id: string;
}

const POSITIONS = [
  "Администратор",
  "Менеджер",
  "Мастер",
  "Снабженец",
  "Кузовщик",
  "Электрик",
  "Диагност",
];

const POSITION_COLORS: Record<string, string> = {
  "Администратор": "text-orange border-orange/30 bg-orange/10",
  "Менеджер": "text-blue-400 border-blue-400/30 bg-blue-400/10",
  "Мастер": "text-green-400 border-green-400/30 bg-green-400/10",
  "Снабженец": "text-purple-400 border-purple-400/30 bg-purple-400/10",
  "Кузовщик": "text-cyan-400 border-cyan-400/30 bg-cyan-400/10",
  "Электрик": "text-yellow-400 border-yellow-400/30 bg-yellow-400/10",
  "Диагност": "text-teal-400 border-teal-400/30 bg-teal-400/10",
};

const GROUP_COLORS = [
  "text-indigo-400 border-indigo-400/30 bg-indigo-400/10",
  "text-pink-400 border-pink-400/30 bg-pink-400/10",
  "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
  "text-amber-400 border-amber-400/30 bg-amber-400/10",
  "text-violet-400 border-violet-400/30 bg-violet-400/10",
  "text-rose-400 border-rose-400/30 bg-rose-400/10",
];

const NAME_REGEX = /^\S+\s+\S+/;

export default function AdminUsersPage() {
  const { toast } = useToast();
  const { user: currentUser, isOwner } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [memberships, setMemberships] = useState<GroupMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // Edit modal state
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editPosition, setEditPosition] = useState("Мастер");
  const [editGroupId, setEditGroupId] = useState<string>("none");
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [usersRes, groupsRes, membersRes] = await Promise.all([
      supabase
        .from("users_registry" as any)
        .select("*")
        .eq("is_approved", true)
        .not("role", "is", null)
        .in("role", ["admin", "manager", "master"])
        .order("created_at", { ascending: false }),
      supabase
        .from("user_groups")
        .select("id, name")
        .order("name"),
      supabase
        .from("user_group_members")
        .select("id, user_id, group_id"),
    ]);

    if (usersRes.data) setUsers(usersRes.data as unknown as UserRow[]);
    if (groupsRes.data) setGroups(groupsRes.data);
    if (membersRes.data) setMemberships(membersRes.data as GroupMembership[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const getUserGroup = useCallback((userId: string | null): UserGroup | null => {
    if (!userId) return null;
    const membership = memberships.find((m) => m.user_id === userId);
    if (!membership) return null;
    return groups.find((g) => g.id === membership.group_id) || null;
  }, [memberships, groups]);

  const groupColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    groups.forEach((g, i) => { map[g.id] = GROUP_COLORS[i % GROUP_COLORS.length]; });
    return map;
  }, [groups]);

  const handleGroupChange = async (user: UserRow, groupId: string) => {
    if (!user.user_id) return;
    setSaving(user.id);
    try {
      await supabase.from("user_group_members").delete().eq("user_id", user.user_id);
      if (groupId !== "none") {
        const { error } = await supabase.from("user_group_members").insert({
          user_id: user.user_id,
          group_id: groupId,
        });
        if (error) throw error;
      }
      toast({ title: "Группа прав обновлена" });
      await load();
    } catch (e: any) {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    }
    setSaving(null);
  };

  const handlePositionChange = async (user: UserRow, position: string) => {
    setSaving(user.id);
    try {
      const { error } = await supabase
        .from("users_registry" as any)
        .update({ position } as any)
        .eq("id", user.id);
      if (error) throw error;
      toast({ title: "Должность обновлена" });
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
    setEditPosition(user.position || "Мастер");
    const userGroup = getUserGroup(user.user_id);
    setEditGroupId(userGroup?.id || "none");
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
      const { error: regErr } = await supabase
        .from("users_registry" as any)
        .update({
          full_name: editName.trim(),
          phone: editPhone.trim() || null,
          position: editPosition,
        } as any)
        .eq("id", editUser.id);
      if (regErr) throw regErr;

      if (editUser.user_id) {
        await supabase.from("profiles")
          .update({ full_name: editName.trim() })
          .eq("user_id", editUser.user_id);

        // Update group membership
        await supabase.from("user_group_members").delete().eq("user_id", editUser.user_id);
        if (editGroupId !== "none") {
          await supabase.from("user_group_members").insert({
            user_id: editUser.user_id,
            group_id: editGroupId,
          });
        }
      }

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
      if (user.user_id) {
        await supabase.from("user_group_members").delete().eq("user_id", user.user_id);
        await supabase.from("user_roles").delete().eq("user_id", user.user_id);
        await supabase.from("profiles").update({ is_approved: false, is_blocked: true }).eq("user_id", user.user_id);
      }
      await supabase.from("users_registry" as any).delete().eq("id", user.id);

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
          <p className="font-mono text-sm text-muted-foreground">Управление должностями, группами прав и данными сотрудников</p>
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

      {/* Groups legend */}
      {groups.length > 0 && (
        <div className="bg-surface border-2 border-border p-4 mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-orange" />
            <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Группы прав (определяют доступ)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {groups.map((g) => {
              const color = groupColorMap[g.id];
              const count = memberships.filter((m) => m.group_id === g.id).length;
              return (
                <span key={g.id} className={`font-mono text-xs border px-2 py-0.5 ${color}`}>
                  {g.name} ({count})
                </span>
              );
            })}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 text-orange animate-spin" />
        </div>
      ) : (
        <div className="space-y-px bg-border mb-8">
          {users.map((user) => {
            const position = user.position;
            const posColor = position ? (POSITION_COLORS[position] || "text-muted-foreground border-border bg-muted/10") : null;
            const userGroup = getUserGroup(user.user_id);
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
                  {/* Position badge */}
                  {position && posColor && (
                    <span className={`font-mono text-xs border px-2 py-0.5 ${posColor}`}>{position}</span>
                  )}

                  {/* Group badge */}
                  {userGroup && (
                    <span className={`font-mono text-xs border px-2 py-0.5 flex items-center gap-1 ${groupColorMap[userGroup.id]}`}>
                      <Shield className="w-3 h-3" />
                      {userGroup.name}
                    </span>
                  )}

                  {isOwner && (
                    <>
                      {/* Position select */}
                      <Select
                        value={user.position || "none"}
                        onValueChange={(val) => handlePositionChange(user, val === "none" ? "" : val)}
                        disabled={saving === user.id}
                      >
                        <SelectTrigger className="w-32 bg-background border-2 border-border font-mono text-xs rounded-none h-9">
                          {saving === user.id ? (
                            <div className="flex items-center gap-1.5">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span>...</span>
                            </div>
                          ) : (
                            <SelectValue placeholder="Должность" />
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none" className="font-mono text-xs">— Должность</SelectItem>
                          {POSITIONS.map((p) => (
                            <SelectItem key={p} value={p} className="font-mono text-xs">{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* Group select */}
                      <Select
                        value={getUserGroup(user.user_id)?.id || "none"}
                        onValueChange={(val) => handleGroupChange(user, val)}
                        disabled={saving === user.id || !user.user_id}
                      >
                        <SelectTrigger className="w-40 bg-background border-2 border-border font-mono text-xs rounded-none h-9">
                          <SelectValue placeholder="Группа прав" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none" className="font-mono text-xs">— Без группы</SelectItem>
                          {groups.map((g) => (
                            <SelectItem key={g.id} value={g.id} className="font-mono text-xs">{g.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </>
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
                <>
                  <div>
                    <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-1">Должность</label>
                    <Select value={editPosition} onValueChange={setEditPosition}>
                      <SelectTrigger className="w-full bg-background border-2 border-border font-mono text-sm rounded-none h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {POSITIONS.map((p) => (
                          <SelectItem key={p} value={p} className="font-mono text-sm">{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="font-mono text-xs text-muted-foreground mt-1">Отображается в списке сотрудников</p>
                  </div>
                  <div>
                    <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-1">Группа прав</label>
                    <Select value={editGroupId} onValueChange={setEditGroupId}>
                      <SelectTrigger className="w-full bg-background border-2 border-border font-mono text-sm rounded-none h-11">
                        <SelectValue placeholder="Без группы" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" className="font-mono text-sm">— Без группы</SelectItem>
                        {groups.map((g) => (
                          <SelectItem key={g.id} value={g.id} className="font-mono text-sm">{g.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="font-mono text-xs text-muted-foreground mt-1">Определяет доступ к разделам и функциям</p>
                  </div>
                </>
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
