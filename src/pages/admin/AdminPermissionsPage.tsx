import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search, Shield, Save, CheckCircle2, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/use-user-role";
import { PERMISSION_SECTIONS } from "@/lib/permissions";

type AppRole = "admin" | "master" | "manager";

const ROLES: { key: AppRole; label: string; color: string }[] = [
  { key: "admin",   label: "Администратор", color: "text-orange" },
  { key: "manager", label: "Менеджер",      color: "text-blue-400" },
  { key: "master",  label: "Мастер",        color: "text-green-400" },
];

// Permission matrix state: role → Set<permission>
type Matrix = Record<AppRole, Set<string>>;

export default function AdminPermissionsPage() {
  const { toast } = useToast();
  const { isAtLeast } = useUserRole();
  const [matrix, setMatrix] = useState<Matrix>({ admin: new Set(), manager: new Set(), master: new Set() });
  const [original, setOriginal] = useState<Matrix>({ admin: new Set(), manager: new Set(), master: new Set() });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [dirty, setDirty] = useState(false);

  // Load current role_permissions
  const load = async () => {
    const { data, error } = await supabase
      .from("role_permissions")
      .select("role, permission");

    if (error) {
      toast({ title: "Ошибка загрузки", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    const m: Matrix = { admin: new Set(), manager: new Set(), master: new Set() };
    (data || []).forEach(({ role, permission }: { role: string; permission: string }) => {
      if (role in m) (m[role as AppRole]).add(permission);
    });
    setMatrix(m);
    setOriginal({ admin: new Set(m.admin), manager: new Set(m.manager), master: new Set(m.master) });
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggle = (role: AppRole, permission: string) => {
    if (role === "admin") return; // Admin always has all permissions
    setMatrix((prev) => {
      const next = { ...prev, [role]: new Set(prev[role]) };
      if (next[role].has(permission)) {
        next[role].delete(permission);
      } else {
        next[role].add(permission);
      }
      return next;
    });
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // For each non-admin role: delete all + re-insert
      for (const role of ["manager", "master"] as AppRole[]) {
        await supabase.from("role_permissions").delete().eq("role", role);
        const perms = Array.from(matrix[role]);
        if (perms.length > 0) {
          await supabase.from("role_permissions").insert(
            perms.map((permission) => ({ role, permission }))
          );
        }
      }
      setOriginal({ admin: new Set(matrix.admin), manager: new Set(matrix.manager), master: new Set(matrix.master) });
      setDirty(false);
      toast({ title: "✓ Матрица прав сохранена" });
    } catch (e) {
      toast({ title: "Ошибка сохранения", description: String(e), variant: "destructive" });
    }
    setSaving(false);
  };

  const handleReset = () => {
    setMatrix({ admin: new Set(original.admin), manager: new Set(original.manager), master: new Set(original.master) });
    setDirty(false);
  };

  // Filter sections/permissions by search
  const filteredSections = useMemo(() => {
    if (!search.trim()) return PERMISSION_SECTIONS;
    const q = search.toLowerCase();
    return PERMISSION_SECTIONS
      .map((section) => ({
        ...section,
        permissions: section.permissions.filter(
          (p) => p.label.toLowerCase().includes(q) || p.key.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q)
        ),
      }))
      .filter((s) => s.permissions.length > 0);
  }, [search]);

  // Count changes
  const changesCount = useMemo(() => {
    let n = 0;
    for (const role of ["manager", "master"] as AppRole[]) {
      const orig = original[role];
      const curr = matrix[role];
      orig.forEach((p) => { if (!curr.has(p)) n++; });
      curr.forEach((p) => { if (!orig.has(p)) n++; });
    }
    return n;
  }, [matrix, original]);

  if (!isAtLeast("admin")) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-30" />
          <p className="font-mono text-sm text-muted-foreground">Только администратор может управлять правами</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-4xl tracking-wider">МАТРИЦА ПРАВ</h1>
          <p className="font-mono text-sm text-muted-foreground">
            Гранулярное управление действиями по ролям — {PERMISSION_SECTIONS.reduce((n, s) => n + s.permissions.length, 0)} разрешений
          </p>
        </div>
        <div className="flex items-center gap-3">
          {dirty && (
            <button
              onClick={handleReset}
              className="flex items-center gap-2 border-2 border-border px-4 py-2.5 font-mono text-sm hover:border-muted-foreground transition-colors"
            >
              <RotateCcw className="w-4 h-4" /> Сбросить
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="flex items-center gap-2 bg-orange text-primary-foreground px-5 py-2.5 font-mono text-sm hover:bg-orange-bright transition-colors disabled:opacity-40 shadow-brutal-sm"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {dirty ? `Сохранить (${changesCount} изм.)` : "Сохранено"}
          </button>
        </div>
      </div>

      {dirty && (
        <div className="mb-4 flex items-center gap-2 bg-orange/10 border border-orange/30 px-4 py-2">
          <CheckCircle2 className="w-4 h-4 text-orange" />
          <span className="font-mono text-xs text-orange">
            Есть несохранённые изменения. Нажмите «Сохранить» чтобы применить.
          </span>
        </div>
      )}

      {/* Legend */}
      <div className="bg-surface border-2 border-border p-4 mb-4 flex flex-wrap gap-6">
        {ROLES.map(({ key, label, color }) => (
          <div key={key} className="flex items-center gap-2">
            <div className={`w-4 h-4 border-2 ${key === "admin" ? "bg-orange border-orange" : "border-border"} flex items-center justify-center`}>
              {key === "admin" && <span className="text-primary-foreground text-[8px]">✓</span>}
            </div>
            <span className={`font-mono text-xs ${color}`}>{label}</span>
            {key === "admin" && <span className="font-mono text-xs text-muted-foreground">(всегда полный доступ)</span>}
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по функциям..."
          className="w-full bg-surface border-2 border-border pl-9 pr-4 py-3 font-mono text-sm focus:outline-none focus:border-orange transition-colors"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 text-orange animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSections.map((section) => (
            <div key={section.id} className="bg-surface border-2 border-border overflow-hidden">
              {/* Section header */}
              <div className="bg-background border-b-2 border-border px-4 py-3 flex items-center gap-3">
                <span className="font-mono text-xs text-orange uppercase tracking-widest">{section.label}</span>
                <span className="font-mono text-xs text-muted-foreground border border-border px-2 py-0.5">
                  {section.permissions.length} действий
                </span>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-4 py-2 font-mono text-xs text-muted-foreground uppercase tracking-widest w-auto">
                        Действие
                      </th>
                      {ROLES.map(({ key, label, color }) => (
                        <th key={key} className={`text-center px-4 py-2 font-mono text-xs ${color} uppercase tracking-widest w-28`}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {section.permissions.map((perm, i) => (
                      <tr
                        key={perm.key}
                        className={`border-b border-border/50 ${i % 2 === 0 ? "bg-background/30" : ""}`}
                      >
                        <td className="px-4 py-3">
                          <div className="font-mono text-sm">{perm.label}</div>
                          {perm.description && (
                            <div className="font-mono text-xs text-muted-foreground mt-0.5">{perm.description}</div>
                          )}
                          <code className="font-mono text-xs text-orange/60">{perm.key}</code>
                        </td>
                        {ROLES.map(({ key: role }) => {
                          const isAdmin = role === "admin";
                          const checked = isAdmin || matrix[role].has(perm.key);
                          const wasChecked = isAdmin || original[role].has(perm.key);
                          const changed = !isAdmin && checked !== wasChecked;

                          return (
                            <td key={role} className="text-center px-4 py-3">
                              <button
                                onClick={() => toggle(role, perm.key)}
                                disabled={isAdmin}
                                title={isAdmin ? "Администратор всегда имеет все права" : undefined}
                                className={`w-6 h-6 border-2 transition-colors mx-auto flex items-center justify-center
                                  ${isAdmin
                                    ? "bg-orange/30 border-orange/50 cursor-not-allowed"
                                    : checked
                                      ? `bg-orange border-orange ${changed ? "ring-2 ring-orange/50 ring-offset-1" : ""}`
                                      : `border-border hover:border-orange/50 ${changed ? "ring-2 ring-destructive/40 ring-offset-1" : ""}`
                                  }`}
                              >
                                {checked && (
                                  <svg className="w-3 h-3 text-primary-foreground" viewBox="0 0 12 12" fill="none">
                                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                )}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
