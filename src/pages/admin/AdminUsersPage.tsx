import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, UserCog, Trash2, AlertCircle, RefreshCw, Crown, Pencil, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/use-permission";
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
  const canEdit = usePermission("edit_client_accounts");
  const canDelete = usePermission("delete_client_accounts");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Edit modal state
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState({ full_name: "", phone: "", car_make: "", car_vin: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [phoneWarning, setPhoneWarning] = useState(false);

  // Delete confirm
  const [deleteUser, setDeleteUser] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (session) setCurrentUserId(session.user.id);

    const { data, error } = await supabase
      .from("users_registry" as any)
      .select("*")
      .eq("is_approved", true)
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
    if (!confirm("Убрать роль у пользователя?")) return;
    await supabase.from("users_registry" as any).update({ role: null } as any).eq("id", user.id);
    if (user.user_id) {
      await supabase.from("user_roles").delete().eq("user_id", user.user_id);
    }
    toast({ title: "Роль удалена" });
    await load();
  };

  // Edit handlers
  const openEdit = async (user: UserRow) => {
    setEditUser(user);
    setPhoneWarning(false);
    // Try to get car info from last appointment
    let carMake = "", carVin = "";
    if (user.phone) {
      const { data } = await supabase
        .from("appointments")
        .select("car_make, car_vin")
        .eq("phone", user.phone)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      carMake = data?.car_make || "";
      carVin = data?.car_vin || "";
    }
    setEditForm({
      full_name: user.full_name || user.display_name || "",
      phone: user.phone || "",
      car_make: carMake,
      car_vin: carVin,
    });
  };

  const saveEdit = async () => {
    if (!editUser) return;
    setEditSaving(true);
    const originalPhone = editUser.phone;
    const phoneChanged = editForm.phone !== originalPhone;

    // Update registry
    await supabase
      .from("users_registry" as any)
      .update({
        full_name: editForm.full_name.trim(),
        phone: editForm.phone.trim() || null,
      } as any)
      .eq("id", editUser.id);

    // Update profile if linked
    if (editUser.user_id) {
      await supabase
        .from("profiles")
        .update({ full_name: editForm.full_name.trim() })
        .eq("user_id", editUser.user_id);
    }

    setEditSaving(false);
    setEditUser(null);

    if (phoneChanged) {
      toast({
        title: "Данные обновлены",
        description: "⚠️ Номер телефона изменён — клиенту может потребоваться повторная привязка Telegram.",
      });
    } else {
      toast({ title: "Данные обновлены" });
    }
    await load();
  };

  // Delete handler
  const confirmDelete = async () => {
    if (!deleteUser) return;
    setDeleting(true);

    // Delete from registry
    await supabase.from("users_registry" as any).delete().eq("id", deleteUser.id);

    // Delete profile + role if linked
    if (deleteUser.user_id) {
      await supabase.from("profiles").delete().eq("user_id", deleteUser.user_id);
      await supabase.from("user_roles").delete().eq("user_id", deleteUser.user_id);
    }

    // Audit
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.from("security_audit_log").insert({
      user_id: session?.user?.id,
      user_email: session?.user?.email,
      action: "delete_client_account",
      target_table: "users_registry",
      target_id: deleteUser.id,
      details: { deleted_email: deleteUser.email, deleted_name: deleteUser.full_name },
    });

    setDeleting(false);
    setDeleteUser(null);
    toast({ title: "Кабинет удалён", description: "Клиент может зарегистрироваться заново." });
    await load();
  };

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="font-display text-4xl tracking-wider">ПОЛЬЗОВАТЕЛИ</h1>
          <p className="font-mono text-sm text-muted-foreground">Управление ролями и клиентскими кабинетами</p>
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
            const isSystemUser = !!user.role && ["admin", "manager", "master"].includes(user.role);
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
                      {user.source === "manual" && (
                        <span className="font-mono text-xs border border-blue-400/30 bg-blue-400/10 text-blue-400 px-1.5 py-0.5">вручную</span>
                      )}
                    </div>
                    {user.email && <p className="font-mono text-xs text-muted-foreground truncate">{user.email}</p>}
                    {user.phone && <p className="font-mono text-xs text-muted-foreground">📞 {user.phone}</p>}
                    {user.created_at && (
                      <p className="font-mono text-xs text-muted-foreground">{new Date(user.created_at).toLocaleDateString("ru-RU")}</p>
                    )}
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

                  {user.role && (
                    <button
                      onClick={() => handleRemoveRole(user)}
                      className="p-2 text-muted-foreground hover:text-destructive border border-border hover:border-destructive transition-colors"
                      title="Убрать роль"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}

                  {/* Edit client button */}
                  {canEdit && !isSystemUser && (
                    <button
                      onClick={() => openEdit(user)}
                      className="p-2 text-muted-foreground hover:text-orange border border-border hover:border-orange transition-colors"
                      title="Редактировать кабинет"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}

                  {/* Delete client button */}
                  {canDelete && !isSystemUser && !isCurrentUser && (
                    <button
                      onClick={() => setDeleteUser(user)}
                      className="p-2 text-muted-foreground hover:text-destructive border border-border hover:border-destructive transition-colors"
                      title="Удалить кабинет"
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
              <p className="font-mono text-sm text-muted-foreground">Нет одобренных пользователей</p>
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

      {/* Edit Modal */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-surface border-2 border-border shadow-brutal w-full max-w-md p-6">
            <h3 className="font-display text-xl tracking-wider mb-5">РЕДАКТИРОВАНИЕ КАБИНЕТА</h3>
            <p className="font-mono text-xs text-muted-foreground mb-4">{editUser.email || editUser.display_name}</p>

            <div className="space-y-4">
              <div>
                <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-1">Имя и Фамилия</label>
                <input
                  type="text"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm(p => ({ ...p, full_name: e.target.value }))}
                  className="w-full bg-background border-2 border-border px-4 py-3 font-mono text-sm focus:outline-none focus:border-orange transition-colors"
                />
              </div>
              <div>
                <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-1">Телефон</label>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => {
                    setEditForm(p => ({ ...p, phone: e.target.value }));
                    if (e.target.value !== editUser.phone) setPhoneWarning(true);
                    else setPhoneWarning(false);
                  }}
                  className="w-full bg-background border-2 border-border px-4 py-3 font-mono text-sm focus:outline-none focus:border-orange transition-colors"
                />
                {phoneWarning && (
                  <div className="flex items-center gap-1.5 mt-1.5 text-orange">
                    <AlertTriangle className="w-3 h-3" />
                    <span className="font-mono text-xs">При смене номера потребуется повторная привязка Telegram</span>
                  </div>
                )}
              </div>
              <div>
                <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-1">Автомобиль</label>
                <input
                  type="text"
                  value={editForm.car_make}
                  onChange={(e) => setEditForm(p => ({ ...p, car_make: e.target.value }))}
                  placeholder="Toyota Camry 2020"
                  className="w-full bg-background border-2 border-border px-4 py-3 font-mono text-sm focus:outline-none focus:border-orange transition-colors"
                />
              </div>
              <div>
                <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-1">VIN</label>
                <input
                  type="text"
                  value={editForm.car_vin}
                  onChange={(e) => setEditForm(p => ({ ...p, car_vin: e.target.value.toUpperCase() }))}
                  maxLength={17}
                  className="w-full bg-background border-2 border-border px-4 py-3 font-mono text-sm focus:outline-none focus:border-orange transition-colors uppercase"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setEditUser(null)}
                className="flex-1 font-mono text-sm border-2 border-border py-2.5 hover:border-muted-foreground transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={saveEdit}
                disabled={editSaving}
                className="flex-1 bg-orange text-primary-foreground font-mono text-sm py-2.5 flex items-center justify-center gap-2 hover:bg-orange-bright transition-colors disabled:opacity-50"
              >
                {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-surface border-2 border-destructive shadow-brutal w-full max-w-sm p-6">
            <h3 className="font-display text-xl tracking-wider text-destructive mb-3">УДАЛИТЬ КАБИНЕТ?</h3>
            <p className="font-mono text-sm text-muted-foreground mb-2">
              {deleteUser.display_name || deleteUser.full_name || deleteUser.email}
            </p>
            <p className="font-mono text-xs text-muted-foreground mb-5">
              Данные будут полностью удалены из реестра и профиля. Клиент сможет зарегистрироваться заново.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteUser(null)}
                className="flex-1 font-mono text-sm border-2 border-border py-2.5 hover:border-muted-foreground transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 bg-destructive text-destructive-foreground font-mono text-sm py-2.5 flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
