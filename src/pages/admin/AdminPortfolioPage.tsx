import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, Save, X, Loader2, Upload, Eye, EyeOff, ChevronDown, ChevronUp } from "lucide-react";
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
  mileage: number | null;
  work_duration: string | null;
  work_list: string[] | null;
  car_details: Record<string, string> | null;
  parts_list: Array<{ name: string; qty?: number; price?: number }> | null;
  final_price: number | null;
}

type FormData = Omit<PortfolioItem, "id" | "created_at">;

const EMPTY: FormData = {
  title: "", description: "", car_make: "", car_model: "", car_year: null,
  image_before_url: "", image_after_url: "", service_type: "", is_published: false,
  mileage: null, work_duration: "", work_list: [], car_details: {}, parts_list: [], final_price: null,
};

// ── Small helpers ─────────────────────────────────────────────────────────────
function TagsInput({ value, onChange, placeholder }: {
  value: string[]; onChange: (v: string[]) => void; placeholder?: string
}) {
  const [input, setInput] = useState("");
  const add = () => {
    const t = input.trim();
    if (t) { onChange([...(value ?? []), t]); setInput(""); }
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="flex-1 bg-background border-2 border-border px-3 py-2 font-mono text-sm focus:outline-none focus:border-orange" />
        <button type="button" onClick={add}
          className="px-3 border-2 border-border hover:border-orange transition-colors font-mono text-sm">+</button>
      </div>
      <div className="flex flex-wrap gap-2">
        {(value ?? []).map((item, i) => (
          <span key={i} className="flex items-center gap-1 bg-surface border border-border px-2 py-0.5 font-mono text-xs">
            {item}
            <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive ml-1">×</button>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function AdminPortfolioPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormData>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [uploadingBefore, setUploadingBefore] = useState(false);
  const [uploadingAfter, setUploadingAfter] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  // parts editing
  const [partName, setPartName] = useState("");
  const [partQty, setPartQty] = useState<number>(1);
  const [partPrice, setPartPrice] = useState<number | "">("");
  const beforeInputRef = useRef<HTMLInputElement>(null);
  const afterInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data } = await supabase.from("portfolio").select("*").order("created_at", { ascending: false });
    setItems((data as unknown as PortfolioItem[]) || []);
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
    } catch {
      toast({ title: "Ошибка загрузки", description: "Не удалось загрузить изображение.", variant: "destructive" });
    }
    setter(false);
  };

  const handleSave = async () => {
    if (!form.title) return;
    setSaving(true);
    const payload = {
      ...form,
      car_year: form.car_year || null,
      mileage: form.mileage || null,
      final_price: form.final_price || null,
      work_list: form.work_list ?? [],
      parts_list: form.parts_list ?? [],
      car_details: form.car_details ?? {},
    };
    if (creating) {
      const { error } = await supabase.from("portfolio").insert(payload as never);
      if (error) toast({ title: "Ошибка сохранения", description: error.message, variant: "destructive" });
    } else if (editing) {
      const { error } = await supabase.from("portfolio").update(payload as never).eq("id", editing);
      if (error) toast({ title: "Ошибка сохранения", description: error.message, variant: "destructive" });
    }
    await load();
    setEditing(null); setCreating(false); setSaving(false);
    toast({ title: "Сохранено!" });
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
    setEditing(item.id); setCreating(false);
    setForm({
      title: item.title, description: item.description, car_make: item.car_make,
      car_model: item.car_model, car_year: item.car_year, image_before_url: item.image_before_url,
      image_after_url: item.image_after_url, service_type: item.service_type, is_published: item.is_published,
      mileage: item.mileage, work_duration: item.work_duration,
      work_list: item.work_list ?? [], car_details: item.car_details ?? {},
      parts_list: item.parts_list ?? [], final_price: item.final_price,
    });
    setShowAdvanced(false);
  };

  const addPart = () => {
    if (!partName.trim()) return;
    setForm((prev) => ({
      ...prev,
      parts_list: [...(prev.parts_list ?? []), { name: partName.trim(), qty: partQty, price: partPrice === "" ? undefined : partPrice }],
    }));
    setPartName(""); setPartQty(1); setPartPrice("");
  };
  const removePart = (i: number) => setForm((prev) => ({ ...prev, parts_list: (prev.parts_list ?? []).filter((_, j) => j !== i) }));

  const FormUI = () => (
    <div className="bg-surface border-2 border-orange p-6 mb-4">
      <h3 className="font-display text-xl tracking-wider mb-5 text-orange">
        {creating ? "Добавить работу" : "Редактировать"}
      </h3>

      {/* ── Basic info ── */}
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
            placeholder="Camry" className="w-full bg-background border-2 border-border px-3 py-2 font-mono text-sm focus:outline-none focus:border-orange" />
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
        <div>
          <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-1">Пробег (км)</label>
          <input type="number" value={form.mileage || ""} onChange={(e) => setForm({ ...form, mileage: e.target.value ? +e.target.value : null })}
            placeholder="85000" className="w-full bg-background border-2 border-border px-3 py-2 font-mono text-sm focus:outline-none focus:border-orange" />
        </div>
        <div>
          <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-1">Время выполнения</label>
          <input value={form.work_duration || ""} onChange={(e) => setForm({ ...form, work_duration: e.target.value })}
            placeholder="1 рабочий день" className="w-full bg-background border-2 border-border px-3 py-2 font-mono text-sm focus:outline-none focus:border-orange" />
        </div>
        <div>
          <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-1">Итоговая стоимость (₽)</label>
          <input type="number" value={form.final_price || ""} onChange={(e) => setForm({ ...form, final_price: e.target.value ? +e.target.value : null })}
            placeholder="25000" className="w-full bg-background border-2 border-border px-3 py-2 font-mono text-sm focus:outline-none focus:border-orange" />
        </div>

        {/* Image upload: before */}
        <div>
          <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-1">Фото «До»</label>
          <div className="flex gap-2">
            <input value={form.image_before_url || ""} onChange={(e) => setForm({ ...form, image_before_url: e.target.value })}
              placeholder="URL или загрузите файл" className="flex-1 bg-background border-2 border-border px-3 py-2 font-mono text-sm focus:outline-none focus:border-orange" />
            <input type="file" ref={beforeInputRef} accept="image/*" className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], "before")} />
            <button type="button" onClick={() => beforeInputRef.current?.click()} disabled={uploadingBefore}
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
            <button type="button" onClick={() => afterInputRef.current?.click()} disabled={uploadingAfter}
              className="px-3 border-2 border-border hover:border-orange transition-colors">
              {uploadingAfter ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            </button>
          </div>
          {form.image_after_url && <img src={form.image_after_url} alt="После" className="mt-2 h-16 w-auto object-cover border border-border" />}
        </div>

        <div className="flex items-center gap-3 md:col-span-2">
          <input type="checkbox" id="is_pub" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
            className="accent-orange w-4 h-4" />
          <label htmlFor="is_pub" className="font-mono text-sm">Опубликовать на сайте</label>
        </div>
      </div>

      {/* ── Advanced section ── */}
      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        className="flex items-center gap-2 font-mono text-xs text-muted-foreground hover:text-orange transition-colors mt-5 mb-3"
      >
        {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        {showAdvanced ? "Скрыть детали кейса" : "Добавить детали кейса (работы, запчасти)"}
      </button>

      {showAdvanced && (
        <div className="space-y-5 border-t border-border pt-4">
          {/* Work list */}
          <div>
            <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-2">Список выполненных работ</label>
            <TagsInput
              value={form.work_list ?? []}
              onChange={(v) => setForm({ ...form, work_list: v })}
              placeholder="Замена амортизаторов → Enter"
            />
          </div>

          {/* Parts list */}
          <div>
            <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-2">Запчасти / детали</label>
            <div className="flex gap-2 mb-2 flex-wrap">
              <input value={partName} onChange={(e) => setPartName(e.target.value)} placeholder="Название детали"
                className="flex-1 min-w-40 bg-background border-2 border-border px-3 py-2 font-mono text-sm focus:outline-none focus:border-orange" />
              <input type="number" value={partQty} onChange={(e) => setPartQty(+e.target.value)} placeholder="Кол-во"
                className="w-20 bg-background border-2 border-border px-3 py-2 font-mono text-sm focus:outline-none focus:border-orange" min={1} />
              <input type="number" value={partPrice} onChange={(e) => setPartPrice(e.target.value ? +e.target.value : "")} placeholder="Цена ₽"
                className="w-24 bg-background border-2 border-border px-3 py-2 font-mono text-sm focus:outline-none focus:border-orange" />
              <button type="button" onClick={addPart}
                className="px-4 border-2 border-orange text-orange font-mono text-sm hover:bg-orange hover:text-primary-foreground transition-colors">
                + Добавить
              </button>
            </div>
            {(form.parts_list ?? []).length > 0 && (
              <div className="space-y-1">
                {(form.parts_list ?? []).map((p, i) => (
                  <div key={i} className="flex items-center gap-3 bg-background border border-border px-3 py-1.5 font-mono text-xs">
                    <span className="flex-1">{p.name}</span>
                    <span className="text-muted-foreground">{p.qty ?? 1} шт.</span>
                    {p.price && <span className="text-orange">{p.price.toLocaleString("ru-RU")} ₽</span>}
                    <button type="button" onClick={() => removePart(i)} className="text-muted-foreground hover:text-destructive">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

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
        <button onClick={() => { setCreating(true); setEditing(null); setForm(EMPTY); setShowAdvanced(false); }}
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
                      <div className="flex-1 min-w-0">
                        <h3 className="font-display text-lg tracking-wider truncate">{item.title}</h3>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {item.car_make && <p className="font-mono text-xs text-muted-foreground">{item.car_make} {item.car_model}</p>}
                          {item.service_type && (
                            <span className="font-mono text-xs text-orange border border-orange/30 px-1.5 py-0 uppercase">{item.service_type}</span>
                          )}
                          {item.final_price && (
                            <span className="font-mono text-xs text-muted-foreground">{item.final_price.toLocaleString("ru-RU")} ₽</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
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
