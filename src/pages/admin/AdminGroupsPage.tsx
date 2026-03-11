import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, Plus, Trash2, Save, Users, ChevronDown, ChevronUp,
  Bell, DollarSign, UserCog, ShieldCheck, Hash
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/use-user-role";

interface GroupPermissions {
  notify_new_appointments: boolean;
  notify_status_changes: boolean;
  notify_supply_orders: boolean;
  view_prices: boolean;
  edit_prices: boolean;
  manage_users: boolean;
}

interface UserGroup {
  id: string;
  name: string;
  description: string | null;
  telegram_chat_id: string | null;
  permissions: GroupPermissions;
  created_at: string;
  member_count?: number;
}

interface GroupMember {
  id: string;
  user_id: string;
  group_id: string;
  email?: string;
}

const DEFAULT_PERMISSIONS: GroupPermissions = {
  notify_new_appointments: false,
  notify_status_changes: false,
  notify_supply_orders: false,
  view_prices: false,
  edit_prices: false,
  manage_users: false,
};

const PERMISSION_DEFS = [
  {
    section: "Уведомления Telegram",
    icon: Bell,
    items: [
      { key: "notify_new_appointments", label: "Уведомления о новых заявках" },
      { key: "notify_status_changes", label: "Уведомления о смене статусов" },
      { key: "notify_supply_orders", label: "Уведомления о заявках на снабжение" },
    ],
  },
  {
    section: "Финансы",
    icon: DollarSign,
    items: [
      { key: "view_prices", label: "Просмотр стоимости работ" },
      { key: "edit_prices", label: "Редактирование цен" },
    ],
  },
  {
    section: "Администрирование",
    icon: UserCog,
    items: [
      { key: "manage_users", label: "Управление пользователями" },
    ],
  },
] as const;

export default function AdminGroupsPage() {
  const { toast } = useToast();
  const { isAtLeast } = useUserRole();
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: "", description: "", telegram_chat_id: "" });

  const load = async () => {
    const [{ data: grps }, { data: mems }] = await Promise.all([
      supabase.from("user_groups").select("*").order("created_at"),
      supabase.from("user_group_members").select("id, user_id, group_id"),
    ]);
    const groupsWithCount = (grps || []).map((g: Record<string, unknown>) => ({
      id: g.id as string,
      name: g.name as string,
      description: g.description as string | null,
      telegram_chat_id: g.telegram_chat_id as string | null,
      created_at: g.created_at as string,
      permissions: { ...DEFAULT_PERMISSIONS, ...(g.permissions as object) } as GroupPermissions,
      member_count: (mems || []).filter((m: GroupMember) => m.group_id === g.id).length,
    }));
    setGroups(groupsWithCount);
    setMembers(mems || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const saveGroup = async (group: UserGroup) => {
    setSaving(group.id);
    const { error } = await supabase.from("user_groups").update({
      name: group.name,
      description: group.description,
      telegram_chat_id: group.telegram_chat_id,
      permissions: group.permissions as unknown as Record<string, boolean>,
    }).eq("id", group.id);

    if (error) {
      toast({ title: "Ошибка сохранения", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Группа сохранена" });
    }
    setSaving(null);
  };

  const deleteGroup = async (id: string) => {
    if (!confirm("Удалить группу? Все участники будут исключены.")) return;
    await supabase.from("user_groups").delete().eq("id", id);
    setGroups((p) => p.filter((g) => g.id !== id));
    toast({ title: "Группа удалена" });
  };

  const createGroup = async () => {
    if (!newGroup.name.trim()) return;
    setCreating(true);
    const { data, error } = await supabase.from("user_groups").insert([{
      name: newGroup.name.trim(),
      description: newGroup.description.trim() || null,
      telegram_chat_id: newGroup.telegram_chat_id.trim() || null,
      permissions: DEFAULT_PERMISSIONS as unknown as Record<string, boolean>,
    }]).select().single();

    if (error) {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    } else if (data) {
      const d = data as Record<string, unknown>;
      setGroups((p) => [...p, {
        id: d.id as string,
        name: d.name as string,
        description: d.description as string | null,
        telegram_chat_id: d.telegram_chat_id as string | null,
        created_at: d.created_at as string,
        permissions: { ...DEFAULT_PERMISSIONS, ...(d.permissions as object) } as GroupPermissions,
        member_count: 0,
      }]);
      setNewGroup({ name: "", description: "", telegram_chat_id: "" });
      setExpanded(data.id as string);
      toast({ title: "Группа создана" });
    }
    setCreating(false);
  };

  const updatePermission = (groupId: string, key: keyof GroupPermissions, value: boolean) => {
    setGroups((p) => p.map((g) =>
      g.id === groupId
        ? { ...g, permissions: { ...g.permissions, [key]: value } }
        : g
    ));
  };

  const updateGroupField = (groupId: string, field: string, value: string) => {
    setGroups((p) => p.map((g) =>
      g.id === groupId ? { ...g, [field]: value } : g
    ));
  };

  if (!isAtLeast("admin")) {
    return (
      <div className="flex items-center justify-center py-20">
        <ShieldCheck className="w-12 h-12 text-muted-foreground opacity-30 mx-auto" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-4xl tracking-wider">ГРУППЫ И ПРАВА</h1>
        <p className="font-mono text-sm text-muted-foreground">RBAC 2.0 — настраиваемые права для каждой группы</p>
      </div>

      {/* Create new group */}
      <div className="bg-surface border-2 border-border p-6 mb-6">
        <h3 className="font-display text-2xl tracking-wider mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5 text-orange" /> НОВАЯ ГРУППА
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-1">Название *</label>
            <input
              type="text"
              value={newGroup.name}
              onChange={(e) => setNewGroup((p) => ({ ...p, name: e.target.value }))}
              placeholder="Например: Кузовщики"
              className="w-full bg-background border-2 border-border px-3 py-2 font-mono text-sm focus:outline-none focus:border-orange transition-colors"
            />
          </div>
          <div>
            <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-1">Описание</label>
            <input
              type="text"
              value={newGroup.description}
              onChange={(e) => setNewGroup((p) => ({ ...p, description: e.target.value }))}
              placeholder="Краткое описание группы"
              className="w-full bg-background border-2 border-border px-3 py-2 font-mono text-sm focus:outline-none focus:border-orange transition-colors"
            />
          </div>
          <div>
            <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-1">
              <Hash className="w-3 h-3 inline mr-1" />Telegram Chat ID
            </label>
            <input
              type="text"
              value={newGroup.telegram_chat_id}
              onChange={(e) => setNewGroup((p) => ({ ...p, telegram_chat_id: e.target.value }))}
              placeholder="-100123456789"
              className="w-full bg-background border-2 border-border px-3 py-2 font-mono text-sm focus:outline-none focus:border-orange transition-colors"
            />
          </div>
        </div>
        <button
          onClick={createGroup}
          disabled={creating || !newGroup.name.trim()}
          className="mt-4 flex items-center gap-2 bg-orange text-primary-foreground px-5 py-2.5 font-mono text-sm hover:bg-orange-bright transition-colors disabled:opacity-50"
        >
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Создать группу
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-orange animate-spin" /></div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const isExpanded = expanded === group.id;
            return (
              <div key={group.id} className={`bg-surface border-2 transition-colors ${isExpanded ? "border-orange/50" : "border-border"}`}>
                {/* Header */}
                <div className="p-5 flex items-center gap-4">
                  <div className="w-10 h-10 bg-orange/10 border border-orange/20 flex items-center justify-center flex-shrink-0">
                    <Users className="w-5 h-5 text-orange" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display text-2xl tracking-wider">{group.name}</h3>
                    <p className="font-mono text-xs text-muted-foreground">
                      {group.description || "—"}
                      {group.telegram_chat_id && (
                        <span className="ml-3 text-orange">Telegram: {group.telegram_chat_id}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-muted-foreground border border-border px-2 py-1">
                      {group.member_count} участн.
                    </span>
                    <button
                      onClick={() => setExpanded(isExpanded ? null : group.id)}
                      className="p-2 border border-border hover:border-orange hover:text-orange transition-colors"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => deleteGroup(group.id)}
                      className="p-2 border border-border text-muted-foreground hover:border-destructive hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Expanded: settings */}
                {isExpanded && (
                  <div className="border-t-2 border-border p-5 space-y-6">
                    {/* Basic info */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-1">Название группы</label>
                        <input
                          type="text"
                          value={group.name}
                          onChange={(e) => updateGroupField(group.id, "name", e.target.value)}
                          className="w-full bg-background border-2 border-border px-3 py-2 font-mono text-sm focus:outline-none focus:border-orange transition-colors"
                        />
                      </div>
                      <div>
                        <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-1">Описание</label>
                        <input
                          type="text"
                          value={group.description || ""}
                          onChange={(e) => updateGroupField(group.id, "description", e.target.value)}
                          className="w-full bg-background border-2 border-border px-3 py-2 font-mono text-sm focus:outline-none focus:border-orange transition-colors"
                        />
                      </div>
                      <div>
                        <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-1">
                          <Hash className="w-3 h-3 inline mr-1" />Telegram Chat ID
                        </label>
                        <input
                          type="text"
                          value={group.telegram_chat_id || ""}
                          onChange={(e) => updateGroupField(group.id, "telegram_chat_id", e.target.value)}
                          placeholder="-100123456789"
                          className="w-full bg-background border-2 border-border px-3 py-2 font-mono text-sm focus:outline-none focus:border-orange transition-colors"
                        />
                        <p className="font-mono text-xs text-muted-foreground mt-1">
                          Chat ID группы или пользователя для Telegram-уведомлений
                        </p>
                      </div>
                    </div>

                    {/* Permissions matrix */}
                    <div>
                      <h4 className="font-display text-xl tracking-wider mb-4 text-orange">ПРАВА ДОСТУПА</h4>
                      <div className="space-y-4">
                        {PERMISSION_DEFS.map(({ section, icon: Icon, items }) => (
                          <div key={section} className="bg-background border border-border">
                            <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
                              <Icon className="w-4 h-4 text-orange" />
                              <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">{section}</span>
                            </div>
                            <div className="divide-y divide-border">
                              {items.map(({ key, label }) => (
                                <div
                                  key={key}
                                  onClick={() => updatePermission(group.id, key as keyof GroupPermissions, !group.permissions[key as keyof GroupPermissions])}
                                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-surface transition-colors select-none"
                                >
                                  <span className="font-mono text-sm">{label}</span>
                                  <div className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
                                    group.permissions[key as keyof GroupPermissions] ? "bg-orange" : "bg-border"
                                  }`}>
                                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-foreground transition-transform ${
                                      group.permissions[key as keyof GroupPermissions] ? "translate-x-5" : "translate-x-0.5"
                                    }`} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => saveGroup(group)}
                      disabled={saving === group.id}
                      className="flex items-center gap-2 bg-orange text-primary-foreground px-5 py-2.5 font-mono text-sm hover:bg-orange-bright transition-colors disabled:opacity-50 shadow-brutal"
                    >
                      {saving === group.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Сохранить группу
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
