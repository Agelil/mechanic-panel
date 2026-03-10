import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, Save, X, Loader2, CheckCircle2, FolderOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Category {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

const EMPTY = { name: "", sort_order: 0 };

export default function AdminCategoriesPage() {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("service_categories").select("*").order("sort_order");
    setCategories(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleEdit = (c: Category) => {
    setEditing(c.id);
    setCreating(false);
    setForm({ name: c.name, sort_order: c.sort_order });
  };

  const handleCreate = () => {
    setCreating(true);
    setEditing(null);
    setForm({ name: "", sort_order: categories.length + 1 });
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (creating) {
        await supabase.from("service_categories").insert({ ...form });
        toast({ title: "Категория создана" });
      } else if (editing) {
        await supabase.from("service_categories").update({ ...form }).eq("id", editing);
        toast({ title: "Категория обновлена" });
      }
      await load();
      setEditing(null);
      setCreating(false);
    } catch {
      toast({ title: "Ошибка", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить категорию? Услуги с этой категорией не будут удалены.")) return;
    await supabase.from("service_categories").delete().eq("id", id);
    setCategories((prev) => prev.filter((c) => c.id !== id));
    toast({ title: "Категория удалена" });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-4xl tracking-wider">КАТЕГОРИИ УСЛУГ</h1>
          <p className="font-mono text-sm text-muted-foreground">Управление группировкой прайс-листа</p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 bg-orange text-primary-foreground px-4 py-2.5 font-mono text-sm hover:bg-orange-bright transition-colors shadow-brutal-sm"
        >
          <Plus className="w-4 h-4" />
          Добавить категорию
        </button>
      </div>

      {/* Create form */}
      {creating && (
        <CategoryForm
          form={form}
          setForm={setForm}
          onSave={handleSave}
          onCancel={() => setCreating(false)}
          saving={saving}
          title="Новая категория"
        />
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 text-orange animate-spin" />
        </div>
      ) : categories.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-border">
          <FolderOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="font-mono text-sm text-muted-foreground">Категории не добавлены</p>
          <p className="font-mono text-xs text-muted-foreground mt-1">Создайте первую категорию для организации услуг</p>
        </div>
      ) : (
        <div className="space-y-px bg-border">
          {categories.map((cat) => (
            <div key={cat.id} className="bg-background">
              {editing === cat.id ? (
                <CategoryForm
                  form={form}
                  setForm={setForm}
                  onSave={handleSave}
                  onCancel={() => setEditing(null)}
                  saving={saving}
                  title="Редактировать"
                />
              ) : (
                <div className="p-5 flex items-center gap-4 hover:bg-surface transition-colors">
                  <div className="w-8 h-8 bg-orange/10 border border-orange/20 flex items-center justify-center flex-shrink-0">
                    <FolderOpen className="w-4 h-4 text-orange" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display text-xl tracking-wider">{cat.name}</h3>
                    <p className="font-mono text-xs text-muted-foreground">Порядок: {cat.sort_order}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleEdit(cat)}
                      className="p-2 text-muted-foreground hover:text-orange border border-border hover:border-orange transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(cat.id)}
                      className="p-2 text-muted-foreground hover:text-destructive border border-border hover:border-destructive transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Info box */}
      <div className="mt-8 bg-orange/5 border border-orange/20 p-4">
        <p className="font-mono text-xs text-muted-foreground leading-relaxed">
          <span className="text-orange font-bold">Как использовать категории:</span><br />
          При создании или редактировании услуги выберите категорию из выпадающего списка.
          Категории также используются на форме записи — клиент сначала выбирает категорию, затем конкретную услугу.
        </p>
      </div>
    </div>
  );
}

function CategoryForm({
  form, setForm, onSave, onCancel, saving, title
}: {
  form: { name: string; sort_order: number };
  setForm: (f: { name: string; sort_order: number }) => void;
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
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Например: Двигатель, Кузов, ТО"
            className="w-full bg-background border-2 border-border px-3 py-2 font-mono text-sm focus:outline-none focus:border-orange"
          />
        </div>
        <div>
          <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-1">Порядок сортировки</label>
          <input
            type="number"
            value={form.sort_order}
            onChange={(e) => setForm({ ...form, sort_order: +e.target.value })}
            className="w-full bg-background border-2 border-border px-3 py-2 font-mono text-sm focus:outline-none focus:border-orange"
          />
        </div>
      </div>
      <div className="flex gap-3 mt-5">
        <button
          onClick={onSave}
          disabled={saving || !form.name.trim()}
          className="flex items-center gap-2 bg-orange text-primary-foreground px-4 py-2 font-mono text-sm hover:bg-orange-bright transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Сохранить
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-2 border-2 border-border px-4 py-2 font-mono text-sm hover:border-foreground transition-colors"
        >
          <X className="w-4 h-4" />
          Отмена
        </button>
      </div>
    </div>
  );
}
