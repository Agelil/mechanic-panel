import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, Plus, Trash2, Save, Users, ChevronDown, ChevronUp,
  ShieldCheck, Hash, Search, RotateCcw, CheckCircle2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { PERMISSION_SECTIONS } from "@/lib/permissions";

import { Bell, DollarSign, ClipboardList, Package, Image, Tag, UserCog, Star, Grid3x3, Settings, ServerCog, Wrench } from "lucide-react";

const SECTION_ICONS: Record<string, React.ElementType> = {
  appointments: Wrench,
  finance:      DollarSign,
  supply:       Package,
  clients_crm:  UserCog,
  system_cfg:   Settings,
  // legacy keys kept for safety
  dashboard:    DollarSign,
  services:     Tag,
  portfolio:    Image,
  promotions:   Tag,
  clients:      UserCog,
  reviews:      Star,
  users:        UserCog,
  permissions:  Grid3x3,
  settings:     Settings,
  system:       ServerCog,
};

// Full flat set of all permission keys from the registry
const ALL_PERM_KEYS = PERMISSION_SECTIONS.flatMap((s) => s.permissions.map((p) => p.key));

type GroupPermissions = Record<string, boolean>;

interface UserGroup {
  id: string;
  name: string;
  description: string | null;
  telegram_chat_id: string | null;
  permissions: GroupPermissions;
  created_at: string;
  member_count?: number;
}

function buildDefaultPerms(): GroupPermissions {
  return Object.fromEntries(ALL_PERM_KEYS.map((k) => [k, false]));
}

function mergePerms(stored: Record<string, unknown>): GroupPermissions {
  const defaults = buildDefaultPerms();
  for (const key of ALL_PERM_KEYS) {
    if (key in stored) defaults[key] = Boolean(stored[key]);
  }
  return defaults;
}

export default function AdminGroupsPage() {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: "", description: "", telegram_chat_id: "" });
  const [search, setSearch] = useState("");

  // Track original permissions for dirty detection
  const [originals, setOriginals] = useState<Record<string, GroupPermissions>>({});

  const load = async () => {
    const [{ data: grps, error: grpsErr }, { data: mems }] = await Promise.all([
      supabase.from("user_groups").select("*").order("created_at"),
      supabase.from("user_group_members").select("id, user_id, group_id"),
    ]);

    if (grpsErr) {
      toast({ title: "Ошибка загрузки групп", description: grpsErr.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    const parsed: UserGroup[] = (grps || []).map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      telegram_chat_id: g.telegram_chat_id,
      created_at: g.created_at,
      permissions: mergePerms((g.permissions as Record<string, unknown>) || {}),
      member_count: (mems || []).filter((m) => m.group_id === g.id).length,
    }));

    setGroups(parsed);
    const orig: Record<string, GroupPermissions> = {};
    parsed.forEach((g) => { orig[g.id] = { ...g.permissions }; });
    setOriginals(orig);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const saveGroup = async (group: UserGroup) => {
    setSaving(group.id);
    const { error } = await supabase.from("user_groups").update({
      name: group.name,
      description: group.description,
      telegram_chat_id: group.telegram_chat_id,
      permissions: group.permissions,
    }).eq("id", group.id);

    if (error) {
      toast({ title: "Ошибка сохранения", description: error.message, variant: "destructive" });
    } else {
      setOriginals((prev) => ({ ...prev, [group.id]: { ...group.permissions } }));
      toast({ title: "✓ Права группы успешно обновлены" });
    }
    setSaving(null);
  };

  const deleteGroup = async (id: string) => {
    if (!confirm("Удалить группу? Все участники будут исключены.")) return;
    const { error } = await supabase.from("user_groups").delete().eq("id", id);
    if (error) {
      toast({ title: "Ошибка удаления", description: error.message, variant: "destructive" });
      return;
    }
    setGroups((p) => p.filter((g) => g.id !== id));
    if (expanded === id) setExpanded(null);
    toast({ title: "Группа удалена" });
  };

  const createGroup = async () => {
    if (!newGroup.name.trim()) return;
    setCreating(true);
    const defaultPerms = buildDefaultPerms();
    const { data, error } = await supabase.from("user_groups").insert([{
      name: newGroup.name.trim(),
      description: newGroup.description.trim() || null,
      telegram_chat_id: newGroup.telegram_chat_id.trim() || null,
      permissions: defaultPerms,
    }]).select().single();

    if (error) {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    } else if (data) {
      const newG: UserGroup = {
        id: data.id,
        name: data.name,
        description: data.description,
        telegram_chat_id: data.telegram_chat_id,
        created_at: data.created_at,
        permissions: mergePerms((data.permissions as Record<string, unknown>) || {}),
        member_count: 0,
      };
      setGroups((p) => [...p, newG]);
      setOriginals((prev) => ({ ...prev, [data.id]: { ...newG.permissions } }));
      setNewGroup({ name: "", description: "", telegram_chat_id: "" });
      setExpanded(data.id);
      toast({ title: "✓ Группа создана" });
    }
    setCreating(false);
  };

  const togglePerm = (groupId: string, key: string) => {
    setGroups((p) => p.map((g) =>
      g.id === groupId
        ? { ...g, permissions: { ...g.permissions, [key]: !g.permissions[key] } }
        : g
    ));
  };

  const resetGroup = (groupId: string) => {
    const orig = originals[groupId];
    if (!orig) return;
    setGroups((p) => p.map((g) => g.id === groupId ? { ...g, permissions: { ...orig } } : g));
  };

  const updateGroupField = (groupId: string, field: string, value: string) => {
    setGroups((p) => p.map((g) => g.id === groupId ? { ...g, [field]: value } : g));
  };

  const isDirty = (group: UserGroup) => {
    const orig = originals[group.id];
    if (!orig) return false;
    return ALL_PERM_KEYS.some((k) => group.permissions[k] !== orig[k]);
  };

  const countChanges = (group: UserGroup) => {
    const orig = originals[group.id];
    if (!orig) return 0;
    return ALL_PERM_KEYS.filter((k) => group.permissions[k] !== orig[k]).length;
  };

  // Filter sections by search
  const filteredSections = useMemo(() => {
    if (!search.trim()) return PERMISSION_SECTIONS;
    const q = search.toLowerCase();
    return PERMISSION_SECTIONS
      .map((s) => ({
        ...s,
        permissions: s.permissions.filter(
          (p) => p.label.toLowerCase().includes(q) || p.key.includes(q) || (p.description || "").toLowerCase().includes(q)
        ),
      }))
      .filter((s) => s.permissions.length > 0);
  }, [search]);

  if (!hasPermission("view_groups")) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <ShieldCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-30" />
          <p className="font-mono text-sm text-muted-foreground">Только администратор может управлять группами</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-4xl tracking-wider">ГРУППЫ И ПРАВА</h1>
        <p className="font-mono text-sm text-muted-foreground">
          Настраиваемые гранулярные права для каждой группы — {ALL_PERM_KEYS.length} функций
        </p>
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
              onKeyDown={(e) => e.key === "Enter" && createGroup()}
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
          className="mt-4 flex items-center gap-2 bg-orange text-primary-foreground px-5 py-2.5 font-mono text-sm hover:bg-orange-bright transition-colors disabled:opacity-50 shadow-brutal-sm"
        >
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Создать группу
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-orange animate-spin" /></div>
      ) : groups.length === 0 ? (
        <div className="bg-surface border-2 border-border p-12 text-center">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-30" />
          <p className="font-mono text-sm text-muted-foreground">Группы ещё не созданы</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const isExpanded = expanded === group.id;
            const dirty = isDirty(group);
            const changes = countChanges(group);
            return (
              <div
                key={group.id}
                className={`bg-surface border-2 transition-colors ${isExpanded ? "border-orange/50" : "border-border"}`}
              >
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
                    {dirty && (
                      <span className="font-mono text-xs text-orange border border-orange/30 bg-orange/10 px-2 py-0.5">
                        {changes} изм.
                      </span>
                    )}
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

                {/* Expanded editor */}
                {isExpanded && (
                  <div className="border-t-2 border-border p-5 space-y-6">
                    {/* Basic info */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-1">Название</label>
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
                      </div>
                    </div>

                    {/* Permissions matrix */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-display text-xl tracking-wider text-orange">ПРАВА ДОСТУПА</h4>
                        <span className="font-mono text-xs text-muted-foreground">
                          {ALL_PERM_KEYS.filter((k) => group.permissions[k]).length} / {ALL_PERM_KEYS.length} активно
                        </span>
                      </div>

                      {/* Search */}
                      <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder="Поиск по функциям..."
                          className="w-full bg-background border-2 border-border pl-9 pr-4 py-2.5 font-mono text-sm focus:outline-none focus:border-orange transition-colors"
                        />
                      </div>

                      <div className="space-y-3">
                        {filteredSections.map((section) => {
                          const Icon = SECTION_ICONS[section.id] || ShieldCheck;
                          const activeCount = section.permissions.filter((p) => group.permissions[p.key]).length;
                          return (
                            <div key={section.id} className="bg-background border border-border overflow-hidden">
                              {/* Section header */}
                              <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface/50">
                                <div className="flex items-center gap-2">
                                  <Icon className="w-4 h-4 text-orange" />
                                  <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">{section.label}</span>
                                </div>
                                <span className="font-mono text-xs text-muted-foreground">
                                  {activeCount}/{section.permissions.length}
                                </span>
                              </div>

                              {/* Permission rows */}
                              <div className="divide-y divide-border/50">
                                {section.permissions.map((perm, i) => {
                                  const enabled = !!group.permissions[perm.key];
                                  const wasEnabled = !!(originals[group.id]?.[perm.key]);
                                  const changed = enabled !== wasEnabled;
                                  return (
                                    <div
                                      key={perm.key}
                                      onClick={() => togglePerm(group.id, perm.key)}
                                      className={`flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-surface/60 transition-colors select-none ${
                                        i % 2 === 0 ? "" : "bg-surface/20"
                                      } ${changed ? "bg-orange/5" : ""}`}
                                    >
                                      <div>
                                        <div className="font-mono text-sm flex items-center gap-2">
                                          {perm.label}
                                          {changed && (
                                            <span className={`text-[10px] font-mono px-1 border ${
                                              enabled
                                                ? "text-green-400 border-green-400/30 bg-green-400/10"
                                                : "text-destructive border-destructive/30 bg-destructive/10"
                                            }`}>
                                              {enabled ? "+ВКЛ" : "−ВЫКЛ"}
                                            </span>
                                          )}
                                        </div>
                                        {perm.description && (
                                          <div className="font-mono text-xs text-muted-foreground">{perm.description}</div>
                                        )}
                                        <code className="font-mono text-xs text-orange/50">{perm.key}</code>
                                      </div>
                                      {/* Toggle */}
                                      <div className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ml-4 ${
                                        enabled ? "bg-orange" : "bg-border"
                                      }`}>
                                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-foreground transition-transform ${
                                          enabled ? "translate-x-5" : "translate-x-0.5"
                                        }`} />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Dirty warning */}
                    {dirty && (
                      <div className="flex items-center gap-2 bg-orange/10 border border-orange/30 px-4 py-2">
                        <CheckCircle2 className="w-4 h-4 text-orange flex-shrink-0" />
                        <span className="font-mono text-xs text-orange">
                          Есть несохранённые изменения ({changes} функций). Нажмите «Сохранить» чтобы применить.
                        </span>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-3">
                      {dirty && (
                        <button
                          onClick={() => resetGroup(group.id)}
                          className="flex items-center gap-2 border-2 border-border px-4 py-2.5 font-mono text-sm hover:border-muted-foreground transition-colors"
                        >
                          <RotateCcw className="w-4 h-4" /> Сбросить
                        </button>
                      )}
                      <button
                        onClick={() => saveGroup(group)}
                        disabled={saving === group.id}
                        className="flex items-center gap-2 bg-orange text-primary-foreground px-5 py-2.5 font-mono text-sm hover:bg-orange-bright transition-colors disabled:opacity-50 shadow-brutal-sm"
                      >
                        {saving === group.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {dirty ? `Сохранить (${changes} изм.)` : "Сохранить группу"}
                      </button>
                    </div>
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
