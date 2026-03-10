import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, Save, X, Loader2, CheckCircle2 } from "lucide-react";
import { formatPriceRange } from "@/lib/utils";

interface Service {
  id: string;
  name: string;
  description: string | null;
  price_from: number;
  price_to: number | null;
  category: string | null;
  is_active: boolean;
  sort_order: number;
}

const EMPTY: Omit<Service, "id"> = {
  name: "",
  description: "",
  price_from: 0,
  price_to: null,
  category: "",
  is_active: true,
  sort_order: 0,
};

export default function AdminServices() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Omit<Service, "id">>(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("services").select("*").order("sort_order");
    setServices(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleEdit = (s: Service) => {
    setEditing(s.id);
    setCreating(false);
    setForm({ name: s.name, description: s.description, price_from: s.price_from, price_to: s.price_to, category: s.category, is_active: s.is_active, sort_order: s.sort_order });
  };

  const handleCreate = () => {
    setCreating(true);
    setEditing(null);
    setForm({ ...EMPTY, sort_order: services.length + 1 });
  };

  const handleSave = async () => {
    setSaving(true);
    if (creating) {
      await supabase.from("services").insert({ ...form });
    } else if (editing) {
      await supabase.from("services").update({ ...form }).eq("id", editing);
    }
    await load();
    setEditing(null);
    setCreating(false);
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить услугу?")) return;
    await supabase.from("services").delete().eq("id", id);
    setServices((prev) => prev.filter((s) => s.id !== id));
  };

  const isEditing = (id: string) => editing === id;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-4xl tracking-wider">УСЛУГИ</h1>
          <p className="font-mono text-sm text-muted-foreground">Управление прайс-листом</p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 bg-orange text-primary-foreground px-4 py-2.5 font-mono text-sm hover:bg-orange-bright transition-colors shadow-brutal-sm"
        >
          <Plus className="w-4 h-4" />
          Добавить услугу
        </button>
      </div>

      {/* Create form */}
      {creating && (
        <ServiceForm
          form={form}
          setForm={setForm}
          onSave={handleSave}
          onCancel={() => setCreating(false)}
          saving={saving}
          title="Новая услуга"
        />
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-orange animate-spin" /></div>
      ) : (
        <div className="space-y-px bg-border">
          {services.map((svc) => (
            <div key={svc.id} className="bg-background">
              {isEditing(svc.id) ? (
                <ServiceForm
                  form={form}
                  setForm={setForm}
                  onSave={handleSave}
                  onCancel={() => setEditing(null)}
                  saving={saving}
                  title="Редактировать"
                />
              ) : (
                <div className="p-5 flex items-start gap-4 hover:bg-surface transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      {svc.category && (
                        <span className="font-mono text-xs text-orange border border-orange/30 px-2 py-0.5">{svc.category}</span>
                      )}
                      <span className={`w-2 h-2 rounded-full ${svc.is_active ? "bg-green-500" : "bg-muted-foreground"}`} />
                    </div>
                    <h3 className="font-display text-xl tracking-wider">{svc.name}</h3>
                    {svc.description && (
                      <p className="font-mono text-xs text-muted-foreground mt-1 line-clamp-2">{svc.description}</p>
                    )}
                    <p className="font-display text-lg text-orange mt-2">{formatPriceRange(svc.price_from, svc.price_to)}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => handleEdit(svc)} className="p-2 text-muted-foreground hover:text-orange border border-border hover:border-orange transition-colors">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(svc.id)} className="p-2 text-muted-foreground hover:text-destructive border border-border hover:border-destructive transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ServiceForm({
  form, setForm, onSave, onCancel, saving, title
}: {
  form: Omit<Service, "id">;
  setForm: (f: Omit<Service, "id">) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  title: string;
}) {
  return (
    <div className="bg-surface border-2 border-orange p-6 mb-4">
      <h3 className="font-display text-xl tracking-wider mb-4 text-orange">{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-1">Название *</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full bg-background border-2 border-border px-3 py-2 font-mono text-sm focus:outline-none focus:border-orange" />
        </div>
        <div className="md:col-span-2">
          <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-1">Описание</label>
          <textarea value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2} className="w-full bg-background border-2 border-border px-3 py-2 font-mono text-sm focus:outline-none focus:border-orange resize-none" />
        </div>
        <div>
          <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-1">Цена от (руб.)</label>
          <input type="number" value={form.price_from} onChange={(e) => setForm({ ...form, price_from: +e.target.value })}
            className="w-full bg-background border-2 border-border px-3 py-2 font-mono text-sm focus:outline-none focus:border-orange" />
        </div>
        <div>
          <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-1">Цена до (руб., необязательно)</label>
          <input type="number" value={form.price_to || ""} onChange={(e) => setForm({ ...form, price_to: e.target.value ? +e.target.value : null })}
            className="w-full bg-background border-2 border-border px-3 py-2 font-mono text-sm focus:outline-none focus:border-orange" />
        </div>
        <div>
          <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-1">Категория</label>
          <input value={form.category || ""} onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full bg-background border-2 border-border px-3 py-2 font-mono text-sm focus:outline-none focus:border-orange" />
        </div>
        <div>
          <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-1">Порядок сортировки</label>
          <input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: +e.target.value })}
            className="w-full bg-background border-2 border-border px-3 py-2 font-mono text-sm focus:outline-none focus:border-orange" />
        </div>
        <div className="flex items-center gap-3">
          <input type="checkbox" id="is_active" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            className="accent-orange w-4 h-4" />
          <label htmlFor="is_active" className="font-mono text-sm">Активна (отображается на сайте)</label>
        </div>
      </div>
      <div className="flex gap-3 mt-5">
        <button onClick={onSave} disabled={saving || !form.name}
          className="flex items-center gap-2 bg-orange text-primary-foreground px-4 py-2 font-mono text-sm hover:bg-orange-bright transition-colors disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Сохранить
        </button>
        <button onClick={onCancel} className="flex items-center gap-2 border-2 border-border px-4 py-2 font-mono text-sm hover:border-foreground transition-colors">
          <X className="w-4 h-4" />
          Отмена
        </button>
      </div>
    </div>
  );
}
