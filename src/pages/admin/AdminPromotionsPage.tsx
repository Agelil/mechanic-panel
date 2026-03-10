import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, Save, X, Loader2, Eye, EyeOff, Percent, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Promotion {
  id: string;
  title: string;
  description: string | null;
  discount_value: string | null;
  is_active: boolean;
  image_url: string | null;
  created_at: string;
}

const EMPTY: Omit<Promotion, "id" | "created_at"> = {
  title: "",
  description: "",
  discount_value: "",
  is_active: true,
  image_url: null,
};

export default function AdminPromotionsPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("promotions").select("*").order("created_at", { ascending: false });
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!form.title) return;
    setSaving(true);
    if (creating) {
      await supabase.from("promotions").insert({ ...form });
    } else if (editing) {
      await supabase.from("promotions").update({ ...form }).eq("id", editing);
    }
    await load();
    setEditing(null);
    setCreating(false);
    setSaving(false);
  };

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from("promotions").update({ is_active: !current }).eq("id", id);
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, is_active: !current } : i));
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить акцию?")) return;
    await supabase.from("promotions").delete().eq("id", id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    try {
      const path = `promotions/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("portfolio").upload(path, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("portfolio").getPublicUrl(path);
      setForm((p) => ({ ...p, image_url: publicUrl }));
    } catch {
      toast({ title: "Ошибка загрузки", variant: "destructive" });
    }
    setUploading(false);
  };

  const startEdit = (item: Promotion) => {
    setEditing(item.id);
    setCreating(false);
    setForm({ title: item.title, description: item.description, discount_value: item.discount_value, is_active: item.is_active, image_url: item.image_url });
  };

  const FormUI = () => (
    <div className="bg-surface border-2 border-orange p-6 mb-4">
      <h3 className="font-display text-xl tracking-wider mb-5 text-orange">
        {creating ? "Новая акция" : "Редактировать акцию"}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-1">Заголовок *</label>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="ТО со скидкой 20%"
            className="w-full bg-background border-2 border-border px-3 py-2 font-mono text-sm focus:outline-none focus:border-orange" />
        </div>
        <div className="md:col-span-2">
          <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-1">Описание</label>
          <textarea value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3} placeholder="Подробное описание акции..."
            className="w-full bg-background border-2 border-border px-3 py-2 font-mono text-sm focus:outline-none focus:border-orange resize-none" />
        </div>
        <div>
          <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-1">Метка скидки (напр. «20%» или «Бесплатно»)</label>
          <input value={form.discount_value || ""} onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
            placeholder="20%"
            className="w-full bg-background border-2 border-border px-3 py-2 font-mono text-sm focus:outline-none focus:border-orange" />
        </div>
        <div>
          <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-1">Изображение</label>
          <div className="flex gap-2">
            <input value={form.image_url || ""} onChange={(e) => setForm({ ...form, image_url: e.target.value || null })}
              placeholder="URL или загрузите файл"
              className="flex-1 bg-background border-2 border-border px-3 py-2 font-mono text-sm focus:outline-none focus:border-orange" />
            <label className="px-3 border-2 border-border hover:border-orange transition-colors cursor-pointer flex items-center">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              <input type="file" accept="image/*" className="hidden"
                onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])} />
            </label>
          </div>
          {form.image_url && <img src={form.image_url} alt="preview" className="mt-2 h-16 w-auto object-cover border border-border" />}
        </div>
        <div className="flex items-center gap-3">
          <input type="checkbox" id="promo_active" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            className="accent-orange w-4 h-4" />
          <label htmlFor="promo_active" className="font-mono text-sm">Активна (отображается на сайте)</label>
        </div>
      </div>
      <div className="flex gap-3 mt-5">
        <button onClick={handleSave} disabled={saving || !form.title}
          className="flex items-center gap-2 bg-orange text-primary-foreground px-4 py-2 font-mono text-sm hover:bg-orange-bright transition-colors disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Сохранить
        </button>
        <button onClick={() => { setEditing(null); setCreating(false); }}
          className="flex items-center gap-2 border-2 border-border px-4 py-2 font-mono text-sm hover:border-foreground transition-colors">
          <X className="w-4 h-4" /> Отмена
        </button>
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-4xl tracking-wider">АКЦИИ</h1>
          <p className="font-mono text-sm text-muted-foreground">Управление акциями и спецпредложениями</p>
        </div>
        <button onClick={() => { setCreating(true); setEditing(null); setForm(EMPTY); }}
          className="flex items-center gap-2 bg-orange text-primary-foreground px-4 py-2.5 font-mono text-sm hover:bg-orange-bright transition-colors shadow-brutal-sm">
          <Plus className="w-4 h-4" /> Добавить акцию
        </button>
      </div>

      {creating && <FormUI />}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-orange animate-spin" /></div>
      ) : items.length === 0 && !creating ? (
        <div className="text-center py-16 border-2 border-dashed border-border">
          <Percent className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="font-mono text-sm text-muted-foreground">Акций пока нет. Создайте первую!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((item) => (
            <div key={item.id}>
              {editing === item.id ? <FormUI /> : (
                <div className={`bg-surface border-2 transition-colors overflow-hidden ${item.is_active ? "border-border hover:border-orange/30" : "border-border/50 opacity-60"}`}>
                  {item.image_url && (
                    <img src={item.image_url} alt={item.title} className="w-full h-32 object-cover" />
                  )}
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {item.discount_value && (
                            <span className="bg-orange text-primary-foreground font-mono text-xs px-2 py-0.5">{item.discount_value}</span>
                          )}
                          <span className={`w-2 h-2 rounded-full ${item.is_active ? "bg-green-500" : "bg-muted-foreground"}`} />
                          <span className="font-mono text-xs text-muted-foreground">{item.is_active ? "Активна" : "Скрыта"}</span>
                        </div>
                        <h3 className="font-display text-xl tracking-wider">{item.title}</h3>
                        {item.description && <p className="font-mono text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>}
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => toggleActive(item.id, item.is_active)}
                          title={item.is_active ? "Скрыть" : "Показать"}
                          className={`p-2 border transition-colors ${item.is_active ? "border-green-500/50 text-green-400 hover:border-green-500" : "border-border text-muted-foreground hover:border-orange hover:text-orange"}`}>
                          {item.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                        <button onClick={() => startEdit(item)} className="p-2 border border-border text-muted-foreground hover:border-orange hover:text-orange transition-colors">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="p-2 border border-border text-muted-foreground hover:border-destructive hover:text-destructive transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
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
