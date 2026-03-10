import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, Save, X, Loader2, Upload, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PortfolioItem {
  id: string;
  title: string;
  description: string | null;
  car_make: string | null;
  car_model: string | null;
  car_year: number | null;
  image_before_url: string | null;
  image_after_url: string | null;
  service_type: string | null;
  is_published: boolean;
  created_at: string;
}

const EMPTY: Omit<PortfolioItem, "id" | "created_at"> = {
  title: "",
  description: "",
  car_make: "",
  car_model: "",
  car_year: null,
  image_before_url: "",
  image_after_url: "",
  service_type: "",
  is_published: false,
};

export default function AdminPortfolioPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [uploadingBefore, setUploadingBefore] = useState(false);
  const [uploadingAfter, setUploadingAfter] = useState(false);
  const beforeInputRef = useRef<HTMLInputElement>(null);
  const afterInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data } = await supabase.from("portfolio").select("*").order("created_at", { ascending: false });
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const uploadImage = async (file: File, type: "before" | "after") => {
    const setter = type === "before" ? setUploadingBefore : setUploadingAfter;
    setter(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${Date.now()}-${type}.${ext}`;
      const { error } = await supabase.storage.from("portfolio").upload(path, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("portfolio").getPublicUrl(path);
      const field = type === "before" ? "image_before_url" : "image_after_url";
      setForm((prev) => ({ ...prev, [field]: publicUrl }));
    } catch (err) {
      toast({ title: "Ошибка загрузки", description: "Не удалось загрузить изображение.", variant: "destructive" });
    }
    setter(false);
  };

  const handleSave = async () => {
    if (!form.title) return;
    setSaving(true);
    if (creating) {
      await supabase.from("portfolio").insert({ ...form });
    } else if (editing) {
      await supabase.from("portfolio").update({ ...form }).eq("id", editing);
    }
    await load();
    setEditing(null);
    setCreating(false);
    setSaving(false);
  };

  const togglePublish = async (id: string, current: boolean) => {
    await supabase.from("portfolio").update({ is_published: !current }).eq("id", id);
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, is_published: !current } : i));
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить работу из портфолио?")) return;
    await supabase.from("portfolio").delete().eq("id", id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const startEdit = (item: PortfolioItem) => {
    setEditing(item.id);
    setCreating(false);
    setForm({
      title: item.title, description: item.description, car_make: item.car_make,
      car_model: item.car_model, car_year: item.car_year, image_before_url: item.image_before_url,
      image_after_url: item.image_after_url, service_type: item.service_type, is_published: item.is_published,
    });
  };

  const FormUI = () => (
    <div className="bg-surface border-2 border-orange p-6 mb-4">
      <h3 className="font-display text-xl tracking-wider mb-5 text-orange">
        {creating ? "Добавить работу" : "Редактировать"}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-1">Заголовок *</label>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full bg-background border-2 border-border px-3 py-2 font-mono text-sm focus:outline-none focus:border-orange" />
        </div>
        <div className="md:col-span-2">
          <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-1">Описание</label>
          <textarea value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2} className="w-full bg-background border-2 border-border px-3 py-2 font-mono text-sm focus:outline-none focus:border-orange resize-none" />
        </div>
        <div>
          <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-1">Марка авто</label>
          <input value={form.car_make || ""} onChange={(e) => setForm({ ...form, car_make: e.target.value })}
            placeholder="Toyota" className="w-full bg-background border-2 border-border px-3 py-2 font-mono text-sm focus:outline-none focus:border-orange" />
        </div>
        <div>
          <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-1">Модель</label>
          <input value={form.car_model || ""} onChange={(e) => setForm({ ...form, car_model: e.target.value })}
            placeholder="Camry 2020" className="w-full bg-background border-2 border-border px-3 py-2 font-mono text-sm focus:outline-none focus:border-orange" />
        </div>
        <div>
          <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-1">Вид услуги</label>
          <input value={form.service_type || ""} onChange={(e) => setForm({ ...form, service_type: e.target.value })}
            placeholder="Ходовая" className="w-full bg-background border-2 border-border px-3 py-2 font-mono text-sm focus:outline-none focus:border-orange" />
        </div>
        <div>
          <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-1">Год</label>
          <input type="number" value={form.car_year || ""} onChange={(e) => setForm({ ...form, car_year: e.target.value ? +e.target.value : null })}
            placeholder="2020" className="w-full bg-background border-2 border-border px-3 py-2 font-mono text-sm focus:outline-none focus:border-orange" />
        </div>

        {/* Image upload: before */}
        <div>
          <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-1">Фото «До»</label>
          <div className="flex gap-2">
            <input value={form.image_before_url || ""} onChange={(e) => setForm({ ...form, image_before_url: e.target.value })}
              placeholder="URL или загрузите файл" className="flex-1 bg-background border-2 border-border px-3 py-2 font-mono text-sm focus:outline-none focus:border-orange" />
            <input type="file" ref={beforeInputRef} accept="image/*" className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], "before")} />
            <button type="button" onClick={() => beforeInputRef.current?.click()}
              disabled={uploadingBefore}
              className="px-3 border-2 border-border hover:border-orange transition-colors">
              {uploadingBefore ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            </button>
          </div>
          {form.image_before_url && <img src={form.image_before_url} alt="До" className="mt-2 h-16 w-auto object-cover border border-border" />}
        </div>

        {/* Image upload: after */}
        <div>
          <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-1">Фото «После»</label>
          <div className="flex gap-2">
            <input value={form.image_after_url || ""} onChange={(e) => setForm({ ...form, image_after_url: e.target.value })}
              placeholder="URL или загрузите файл" className="flex-1 bg-background border-2 border-border px-3 py-2 font-mono text-sm focus:outline-none focus:border-orange" />
            <input type="file" ref={afterInputRef} accept="image/*" className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], "after")} />
            <button type="button" onClick={() => afterInputRef.current?.click()}
              disabled={uploadingAfter}
              className="px-3 border-2 border-border hover:border-orange transition-colors">
              {uploadingAfter ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            </button>
          </div>
          {form.image_after_url && <img src={form.image_after_url} alt="После" className="mt-2 h-16 w-auto object-cover border border-border" />}
        </div>

        <div className="flex items-center gap-3">
          <input type="checkbox" id="is_pub" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
            className="accent-orange w-4 h-4" />
          <label htmlFor="is_pub" className="font-mono text-sm">Опубликовать на сайте</label>
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
          <h1 className="font-display text-4xl tracking-wider">ПОРТФОЛИО</h1>
          <p className="font-mono text-sm text-muted-foreground">Управление галереей работ</p>
        </div>
        <button onClick={() => { setCreating(true); setEditing(null); setForm(EMPTY); }}
          className="flex items-center gap-2 bg-orange text-primary-foreground px-4 py-2.5 font-mono text-sm hover:bg-orange-bright transition-colors shadow-brutal-sm">
          <Plus className="w-4 h-4" /> Добавить работу
        </button>
      </div>

      {creating && <FormUI />}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-orange animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((item) => (
            <div key={item.id}>
              {editing === item.id ? <FormUI /> : (
                <div className="bg-surface border-2 border-border hover:border-orange/30 transition-colors overflow-hidden">
                  {(item.image_after_url || item.image_before_url) && (
                    <div className="flex">
                      {item.image_before_url && <img src={item.image_before_url} alt="До" className="w-1/2 h-32 object-cover" />}
                      {item.image_after_url && <img src={item.image_after_url} alt="После" className="w-1/2 h-32 object-cover" />}
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <h3 className="font-display text-lg tracking-wider">{item.title}</h3>
                        {item.car_make && <p className="font-mono text-xs text-muted-foreground">{item.car_make} {item.car_model}</p>}
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => togglePublish(item.id, item.is_published)}
                          title={item.is_published ? "Снять с публикации" : "Опубликовать"}
                          className={`p-2 border transition-colors ${item.is_published ? "border-green-500/50 text-green-400 hover:border-green-500" : "border-border text-muted-foreground hover:border-orange hover:text-orange"}`}>
                          {item.is_published ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
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
