import { useMemo, useState } from "react";
import { Plus, Trash2, Calculator, FileText, Loader2, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/use-permission";
import { formatPrice } from "@/lib/utils";

export interface WorkItem {
  id: string;
  name: string;
  qty: number;
  unit_price: number;
  is_part: boolean;       // true = запчасть, false = работа
  from_supply?: boolean;  // подтянута из supply_orders
}

interface SupplyOrder {
  id: string;
  item_name: string;
  quantity: number;
  status: string;
}

interface ServiceCatalogItem {
  id: string;
  name: string;
  price_from: number;
}

interface Props {
  appointmentId: string;
  workItems: WorkItem[];
  partsCost: number;
  servicesCost: number;
  totalPrice: number | null;
  supplyOrders: SupplyOrder[];
  catalogServices: ServiceCatalogItem[];
  onChange: (items: WorkItem[], partsCost: number, servicesCost: number, total: number) => void;
}

function newItem(isPart = false): WorkItem {
  return { id: crypto.randomUUID(), name: "", qty: 1, unit_price: 0, is_part: isPart };
}

export default function AppointmentFinancialBlock({
  appointmentId,
  workItems,
  supplyOrders,
  catalogServices,
  onChange,
}: Props) {
  const { toast } = useToast();
  const canViewPrice = usePermission("view_appointment_price");
  const canEditServices = usePermission("edit_appointment_services");

  const [items, setItems] = useState<WorkItem[]>(workItems);
  const [saving, setSaving] = useState(false);
  const [generatingDoc, setGeneratingDoc] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [selectedCatalogId, setSelectedCatalogId] = useState("");
  const [directPartsCost, setDirectPartsCost] = useState<number>(0);
  const [directServicesCost, setDirectServicesCost] = useState<number>(0);
  const [useDirectInput, setUseDirectInput] = useState(false);

  // Reactive totals
  const { partsCost, servicesCost, grandTotal } = useMemo(() => {
    if (useDirectInput) {
      return { partsCost: directPartsCost, servicesCost: directServicesCost, grandTotal: directPartsCost + directServicesCost };
    }
    const partsCost = items.filter((i) => i.is_part).reduce((s, i) => s + i.qty * i.unit_price, 0);
    const servicesCost = items.filter((i) => !i.is_part).reduce((s, i) => s + i.qty * i.unit_price, 0);
    return { partsCost, servicesCost, grandTotal: partsCost + servicesCost };
  }, [items, useDirectInput, directPartsCost, directServicesCost]);

  const updateItem = (id: string, field: keyof WorkItem, value: string | number | boolean) => {
    setItems((prev) => {
      const next = prev.map((it) => it.id === id ? { ...it, [field]: value } : it);
      const pc = next.filter((i) => i.is_part).reduce((s, i) => s + i.qty * i.unit_price, 0);
      const sc = next.filter((i) => !i.is_part).reduce((s, i) => s + i.qty * i.unit_price, 0);
      onChange(next, pc, sc, pc + sc);
      return next;
    });
  };

  const addItem = (isPart = false) => {
    const item = newItem(isPart);
    setItems((prev) => {
      const next = [...prev, item];
      const pc = next.filter((i) => i.is_part).reduce((s, i) => s + i.qty * i.unit_price, 0);
      const sc = next.filter((i) => !i.is_part).reduce((s, i) => s + i.qty * i.unit_price, 0);
      onChange(next, pc, sc, pc + sc);
      return next;
    });
  };

  const removeItem = (id: string) => {
    setItems((prev) => {
      const next = prev.filter((it) => it.id !== id);
      const pc = next.filter((i) => i.is_part).reduce((s, i) => s + i.qty * i.unit_price, 0);
      const sc = next.filter((i) => !i.is_part).reduce((s, i) => s + i.qty * i.unit_price, 0);
      onChange(next, pc, sc, pc + sc);
      return next;
    });
  };

  const addFromCatalog = () => {
    const svc = catalogServices.find((s) => s.id === selectedCatalogId);
    if (!svc) return;
    const item: WorkItem = {
      id: crypto.randomUUID(),
      name: svc.name,
      qty: 1,
      unit_price: svc.price_from,
      is_part: false,
    };
    setItems((prev) => {
      const next = [...prev, item];
      const pc = next.filter((i) => i.is_part).reduce((s, i) => s + i.qty * i.unit_price, 0);
      const sc = next.filter((i) => !i.is_part).reduce((s, i) => s + i.qty * i.unit_price, 0);
      onChange(next, pc, sc, pc + sc);
      return next;
    });
    setSelectedCatalogId("");
    setShowCatalog(false);
  };

  const importFromSupply = () => {
    const approvedOrders = supplyOrders.filter((o) => ["approved", "ordered", "received"].includes(o.status));
    if (approvedOrders.length === 0) {
      toast({ title: "Нет подтверждённых заявок на запчасти" });
      return;
    }
    const newParts: WorkItem[] = approvedOrders
      .filter((o) => !items.some((it) => it.name === o.item_name && it.from_supply))
      .map((o) => ({
        id: crypto.randomUUID(),
        name: o.item_name,
        qty: o.quantity,
        unit_price: 0,
        is_part: true,
        from_supply: true,
      }));
    if (newParts.length === 0) {
      toast({ title: "Все запчасти из снабжения уже добавлены" });
      return;
    }
    setItems((prev) => {
      const next = [...prev, ...newParts];
      const pc = next.filter((i) => i.is_part).reduce((s, i) => s + i.qty * i.unit_price, 0);
      const sc = next.filter((i) => !i.is_part).reduce((s, i) => s + i.qty * i.unit_price, 0);
      onChange(next, pc, sc, pc + sc);
      return next;
    });
    toast({ title: `✓ Добавлено ${newParts.length} запчастей из снабжения` });
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("appointments").update({
      work_items: items as unknown as import("@/integrations/supabase/types").Json,
      parts_cost: partsCost,
      services_cost: servicesCost,
      total_price: grandTotal || null,
    }).eq("id", appointmentId);
    if (error) {
      toast({ title: "Ошибка сохранения", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "✓ Финансовый блок сохранён" });
    }
    setSaving(false);
  };

  const generateDoc = async () => {
    setGeneratingDoc(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-document", {
        body: { appointment_id: appointmentId, doc_type: "work_order" },
      });
      if (error) throw error;
      if (data?.file_url) {
        window.open(data.file_url, "_blank");
        toast({ title: "✓ Предварительный счёт сформирован" });
      }
    } catch (e) {
      toast({ title: "Ошибка генерации документа", description: String(e), variant: "destructive" });
    }
    setGeneratingDoc(false);
  };

  const parts = items.filter((i) => i.is_part);
  const works = items.filter((i) => !i.is_part);

  return (
    <div className="space-y-5">
      {/* ── Works table ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="font-mono text-xs text-orange uppercase tracking-widest">Список работ</p>
          {canEditServices && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCatalog(!showCatalog)}
                className="flex items-center gap-1.5 font-mono text-xs border border-border px-3 py-1.5 hover:border-orange hover:text-orange transition-colors"
              >
                <ChevronDown className={`w-3 h-3 transition-transform ${showCatalog ? "rotate-180" : ""}`} />
                Из справочника
              </button>
              <button
                onClick={() => addItem(false)}
                className="flex items-center gap-1.5 font-mono text-xs border border-border px-3 py-1.5 hover:border-orange hover:text-orange transition-colors"
              >
                <Plus className="w-3 h-3" /> Добавить работу
              </button>
            </div>
          )}
        </div>

        {/* Catalog picker */}
        {showCatalog && (
          <div className="mb-3 flex gap-2">
            <select
              value={selectedCatalogId}
              onChange={(e) => setSelectedCatalogId(e.target.value)}
              className="flex-1 bg-background border-2 border-border px-3 py-2 font-mono text-sm focus:outline-none focus:border-orange"
            >
              <option value="">Выберите услугу...</option>
              {catalogServices.map((s) => (
                <option key={s.id} value={s.id}>{s.name} — {formatPrice(s.price_from)}</option>
              ))}
            </select>
            <button
              onClick={addFromCatalog}
              disabled={!selectedCatalogId}
              className="px-4 py-2 bg-orange text-primary-foreground font-mono text-sm hover:bg-orange-bright disabled:opacity-40 transition-colors"
            >
              Добавить
            </button>
          </div>
        )}

        <div className="bg-background border border-border overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-[1fr_80px_120px_36px] gap-0 border-b border-border">
            <div className="px-3 py-2 font-mono text-xs text-muted-foreground uppercase tracking-widest">Наименование работы</div>
            <div className="px-3 py-2 font-mono text-xs text-muted-foreground uppercase tracking-widest text-center">Кол-во</div>
            {canViewPrice && <div className="px-3 py-2 font-mono text-xs text-muted-foreground uppercase tracking-widest text-right">Цена / ед.</div>}
            <div />
          </div>
          {works.length === 0 ? (
            <div className="px-4 py-6 text-center font-mono text-xs text-muted-foreground">
              Работы не добавлены
            </div>
          ) : (
            works.map((item) => {
              const subtotal = item.qty * item.unit_price;
              return (
                <div key={item.id} className="grid grid-cols-[1fr_80px_120px_36px] gap-0 border-b border-border/50 hover:bg-surface/40 transition-colors">
                  <div className="px-2 py-1.5">
                    {canEditServices ? (
                      <input
                        value={item.name}
                        onChange={(e) => updateItem(item.id, "name", e.target.value)}
                        placeholder="Название работы"
                        className="w-full bg-transparent font-mono text-sm focus:outline-none focus:bg-background/50 px-1 rounded"
                      />
                    ) : (
                      <span className="font-mono text-sm px-1">{item.name}</span>
                    )}
                  </div>
                  <div className="px-2 py-1.5 flex items-center justify-center">
                    {canEditServices ? (
                      <input
                        type="number"
                        min={1}
                        value={item.qty}
                        onChange={(e) => updateItem(item.id, "qty", Math.max(1, Number(e.target.value)))}
                        className="w-full text-center bg-transparent font-mono text-sm focus:outline-none focus:bg-background/50 rounded"
                      />
                    ) : (
                      <span className="font-mono text-sm text-center w-full">{item.qty}</span>
                    )}
                  </div>
                  {canViewPrice && (
                    <div className="px-2 py-1.5 flex items-center justify-end gap-1">
                      {canEditServices ? (
                        <input
                          type="number"
                          min={0}
                          value={item.unit_price}
                          onChange={(e) => updateItem(item.id, "unit_price", Math.max(0, Number(e.target.value)))}
                          className="w-full text-right bg-transparent font-mono text-sm focus:outline-none focus:bg-background/50 rounded"
                        />
                      ) : (
                        <span className="font-mono text-sm text-right">{subtotal > 0 ? formatPrice(subtotal) : "—"}</span>
                      )}
                    </div>
                  )}
                  <div className="flex items-center justify-center">
                    {canEditServices && (
                      <button onClick={() => removeItem(item.id)} className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
          {canViewPrice && works.length > 0 && (
            <div className="grid grid-cols-[1fr_80px_120px_36px] bg-surface border-t border-border">
              <div className="px-3 py-2 font-mono text-xs text-muted-foreground col-span-2">Итого работы</div>
              <div className="px-3 py-2 font-mono text-sm font-bold text-orange text-right">{formatPrice(servicesCost)}</div>
              <div />
            </div>
          )}
        </div>
      </div>

      {/* ── Parts table ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="font-mono text-xs text-orange uppercase tracking-widest">Запчасти и материалы</p>
          {canEditServices && (
            <div className="flex items-center gap-2">
              {supplyOrders.length > 0 && (
                <button
                  onClick={importFromSupply}
                  className="flex items-center gap-1.5 font-mono text-xs border border-border px-3 py-1.5 hover:border-orange hover:text-orange transition-colors"
                >
                  <Plus className="w-3 h-3" /> Из снабжения
                </button>
              )}
              <button
                onClick={() => addItem(true)}
                className="flex items-center gap-1.5 font-mono text-xs border border-border px-3 py-1.5 hover:border-orange hover:text-orange transition-colors"
              >
                <Plus className="w-3 h-3" /> Добавить запчасть
              </button>
            </div>
          )}
        </div>

        <div className="bg-background border border-border overflow-hidden">
          <div className="grid grid-cols-[1fr_80px_120px_120px_36px] gap-0 border-b border-border">
            <div className="px-3 py-2 font-mono text-xs text-muted-foreground uppercase tracking-widest">Наименование</div>
            <div className="px-3 py-2 font-mono text-xs text-muted-foreground uppercase tracking-widest text-center">Кол-во</div>
            {canViewPrice && <>
              <div className="px-3 py-2 font-mono text-xs text-muted-foreground uppercase tracking-widest text-right">Закуп.</div>
              <div className="px-3 py-2 font-mono text-xs text-muted-foreground uppercase tracking-widest text-right">Клиент</div>
            </>}
            <div />
          </div>
          {parts.length === 0 ? (
            <div className="px-4 py-6 text-center font-mono text-xs text-muted-foreground">
              Запчасти не добавлены
            </div>
          ) : (
            parts.map((item) => {
              const subtotal = item.qty * item.unit_price;
              return (
                <div key={item.id} className={`grid grid-cols-[1fr_80px_120px_120px_36px] gap-0 border-b border-border/50 hover:bg-surface/40 transition-colors ${item.from_supply ? "bg-primary/5" : ""}`}>
                  <div className="px-2 py-1.5 flex items-center gap-1.5">
                    {item.from_supply && <span className="text-[9px] font-mono text-accent border border-accent/30 px-1">СНБ</span>}
                    {canEditServices ? (
                      <input
                        value={item.name}
                        onChange={(e) => updateItem(item.id, "name", e.target.value)}
                        placeholder="Наименование запчасти"
                        className="flex-1 bg-transparent font-mono text-sm focus:outline-none focus:bg-background/50 px-1 rounded"
                      />
                    ) : (
                      <span className="font-mono text-sm px-1">{item.name}</span>
                    )}
                  </div>
                  <div className="px-2 py-1.5 flex items-center justify-center">
                    {canEditServices ? (
                      <input
                        type="number"
                        min={1}
                        value={item.qty}
                        onChange={(e) => updateItem(item.id, "qty", Math.max(1, Number(e.target.value)))}
                        className="w-full text-center bg-transparent font-mono text-sm focus:outline-none"
                      />
                    ) : (
                      <span className="font-mono text-sm">{item.qty}</span>
                    )}
                  </div>
                  {canViewPrice && (
                    <>
                      <div className="px-2 py-1.5 flex items-center justify-end">
                        {canEditServices ? (
                          <input
                            type="number"
                            min={0}
                            value={item.unit_price}
                            onChange={(e) => updateItem(item.id, "unit_price", Math.max(0, Number(e.target.value)))}
                            placeholder="0"
                            className="w-full text-right bg-transparent font-mono text-xs text-muted-foreground focus:outline-none"
                          />
                        ) : (
                          <span className="font-mono text-xs text-muted-foreground">{item.unit_price > 0 ? formatPrice(item.unit_price) : "—"}</span>
                        )}
                      </div>
                      <div className="px-2 py-1.5 flex items-center justify-end">
                        <span className="font-mono text-sm">{subtotal > 0 ? formatPrice(subtotal) : "—"}</span>
                      </div>
                    </>
                  )}
                  <div className="flex items-center justify-center">
                    {canEditServices && (
                      <button onClick={() => removeItem(item.id)} className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
          {canViewPrice && parts.length > 0 && (
            <div className="grid grid-cols-[1fr_80px_120px_120px_36px] bg-surface border-t border-border">
              <div className="px-3 py-2 font-mono text-xs text-muted-foreground col-span-3">Итого запчасти</div>
              <div className="px-3 py-2 font-mono text-sm font-bold text-orange text-right">{formatPrice(partsCost)}</div>
              <div />
            </div>
          )}
        </div>
      </div>

      {/* ── Grand Total ── */}
      {canViewPrice && (
        <div className="bg-surface border-2 border-orange/30 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <Calculator className="w-4 h-4 text-orange" /> Итоговый расчёт
            </span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between font-mono text-sm">
              <span className="text-muted-foreground">Стоимость работ</span>
              <span>{formatPrice(servicesCost)}</span>
            </div>
            <div className="flex justify-between font-mono text-sm">
              <span className="text-muted-foreground">Запчасти и материалы</span>
              <span>{formatPrice(partsCost)}</span>
            </div>
            <div className="border-t border-border/50 pt-2 flex justify-between items-baseline">
              <span className="font-display text-2xl tracking-wider">ИТОГО</span>
              <span className="font-display text-3xl text-orange tracking-wider">{formatPrice(grandTotal)}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Actions ── */}
      {(canEditServices || canViewPrice) && (
        <div className="flex items-center gap-3 flex-wrap">
          {canEditServices && (
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-2 bg-orange text-primary-foreground px-5 py-2.5 font-mono text-sm hover:bg-orange-bright transition-colors disabled:opacity-50 shadow-brutal-sm"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
              Сохранить расчёт
            </button>
          )}
          {canViewPrice && (
            <button
              onClick={generateDoc}
              disabled={generatingDoc}
              className="flex items-center gap-2 border-2 border-border px-4 py-2.5 font-mono text-sm hover:border-orange hover:text-orange transition-colors disabled:opacity-50"
            >
              {generatingDoc ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Сформировать счёт
            </button>
          )}
        </div>
      )}
    </div>
  );
}
