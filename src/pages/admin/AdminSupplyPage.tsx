import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, Plus, Package, Wrench, Layers, Clock, CheckCircle2,
  XCircle, AlertTriangle, ChevronDown, ShoppingCart, Filter
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/use-user-role";

type SupplyType = "part" | "tool" | "consumable";
type SupplyUrgency = "urgent" | "planned";
type SupplyStatus = "pending" | "approved" | "ordered" | "received" | "cancelled";

interface SupplyOrder {
  id: string;
  master_id: string | null;
  master_name: string;
  supply_type: SupplyType;
  item_name: string;
  quantity: number;
  unit: string;
  urgency: SupplyUrgency;
  appointment_id: string | null;
  notes: string | null;
  status: SupplyStatus;
  created_at: string;
}

const TYPE_CONFIG: Record<SupplyType, { label: string; icon: React.ElementType; color: string }> = {
  part: { label: "Запчасть", icon: Package, color: "text-orange border-orange/30 bg-orange/10" },
  tool: { label: "Инструмент", icon: Wrench, color: "text-blue-400 border-blue-400/30 bg-blue-400/10" },
  consumable: { label: "Расходники", icon: Layers, color: "text-purple-400 border-purple-400/30 bg-purple-400/10" },
};

const STATUS_CONFIG: Record<SupplyStatus, { label: string; icon: React.ElementType; color: string }> = {
  pending: { label: "Ожидает", icon: Clock, color: "text-orange border-orange/30" },
  approved: { label: "Одобрено", icon: CheckCircle2, color: "text-blue-400 border-blue-400/30" },
  ordered: { label: "Заказано", icon: ShoppingCart, color: "text-yellow-400 border-yellow-400/30" },
  received: { label: "Получено", icon: CheckCircle2, color: "text-muted-foreground border-border" },
  cancelled: { label: "Отменено", icon: XCircle, color: "text-destructive border-destructive/30" },
};

const URGENCY_CONFIG: Record<SupplyUrgency, { label: string; color: string }> = {
  urgent: { label: "СРОЧНО", color: "text-destructive border-destructive/50 bg-destructive/10" },
  planned: { label: "Планово", color: "text-muted-foreground border-border" },
};

export default function AdminSupplyPage() {
  const { toast } = useToast();
  const { role, isAtLeast } = useUserRole();
  const [orders, setOrders] = useState<SupplyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<SupplyStatus | "all">("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // New order form
  const [showForm, setShowForm] = useState(false);
  const [masterName, setMasterName] = useState("");
  const [form, setForm] = useState({
    supply_type: "part" as SupplyType,
    item_name: "",
    quantity: "1",
    unit: "шт.",
    urgency: "planned" as SupplyUrgency,
    appointment_id: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = async () => {
    const { data } = await supabase
      .from("supply_orders")
      .select("*")
      .order("created_at", { ascending: false });
    setOrders((data as SupplyOrder[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    // Prefill master name
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        supabase.from("profiles")
          .select("display_name, email")
          .eq("user_id", session.user.id)
          .maybeSingle()
          .then(({ data }) => {
            setMasterName(data?.display_name || session.user?.email?.split("@")[0] || "Мастер");
          });
      }
    });
    load();
  }, []);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.item_name.trim()) errs.item_name = "Укажите наименование";
    if (!form.quantity || Number(form.quantity) < 1) errs.quantity = "Укажите количество";
    if (!masterName.trim()) errs.masterName = "Укажите имя мастера";
    return errs;
  };

  // Таймаут 10 секунд для мутаций
  const withTimeout = <T,>(promise: Promise<T>, ms = 10_000): Promise<T> => {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Сервер не ответил вовремя")), ms)
    );
    return Promise.race([promise, timeout]);
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setSubmitting(true);
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      const insertPromise = supabase.from("supply_orders").insert({
        master_id: s?.user?.id || null,
        master_name: masterName.trim(),
        supply_type: form.supply_type,
        item_name: form.item_name.trim(),
        quantity: Number(form.quantity),
        unit: form.unit.trim() || "шт.",
        urgency: form.urgency,
        appointment_id: form.appointment_id.trim() || null,
        notes: form.notes.trim() || null,
        status: "pending",
      }).select().single();

      const { data, error } = await withTimeout(insertPromise);

      if (error) {
        toast({ title: "Ошибка", description: error.message, variant: "destructive" });
        return;
      }

      try {
        await supabase.functions.invoke("send-telegram-notification", {
          body: {
            type: "supply_order",
            master_name: masterName.trim(),
            supply_type: form.supply_type,
            item_name: form.item_name.trim(),
            quantity: Number(form.quantity),
            unit: form.unit || "шт.",
            urgency: form.urgency,
            appointment_id: form.appointment_id.trim() || null,
          },
        });
      } catch { /* non-critical */ }

      setOrders((p) => [data as SupplyOrder, ...p]);
      setForm({ supply_type: "part", item_name: "", quantity: "1", unit: "шт.", urgency: "planned", appointment_id: "", notes: "" });
      setShowForm(false);
      toast({ title: "Заявка создана", description: "Администратор получит уведомление в Telegram" });
    } catch (err) {
      toast({
        title: "Ошибка",
        description: err instanceof Error ? err.message : "Неизвестная ошибка",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (id: string, status: SupplyStatus) => {
    setUpdatingId(id);
    try {
      const updatePromise = supabase.from("supply_orders").update({ status }).eq("id", id);
      const { error } = await withTimeout(updatePromise);
      if (error) {
        toast({ title: "Ошибка обновления", description: error.message, variant: "destructive" });
        return;
      }
      setOrders((p) => p.map((o) => o.id === id ? { ...o, status } : o));
    } catch (err) {
      toast({
        title: "Ошибка",
        description: err instanceof Error ? err.message : "Сервер не ответил",
        variant: "destructive",
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = statusFilter === "all" ? orders : orders.filter((o) => o.status === statusFilter);
  const counts: Record<string, number> = { all: orders.length };
  Object.keys(STATUS_CONFIG).forEach((s) => { counts[s] = orders.filter((o) => o.status === s).length; });

  return (
    <div>
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h1 className="font-display text-4xl tracking-wider">СНАБЖЕНИЕ</h1>
          <p className="font-mono text-sm text-muted-foreground">Заявки мастеров на запчасти, инструменты и расходники</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-orange text-primary-foreground px-5 py-2.5 font-mono text-sm hover:bg-orange-bright transition-colors shadow-brutal flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          Новая заявка
        </button>
      </div>

      {/* New order form */}
      {showForm && (
        <div className="bg-surface border-2 border-orange/50 p-6 mb-6 shadow-brutal">
          <h3 className="font-display text-2xl tracking-wider mb-5 text-orange">ЗАЯВКА НА СНАБЖЕНИЕ</h3>

          <div className="space-y-4">
            {/* Master name */}
            <div>
              <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-1">Мастер *</label>
              <input
                type="text"
                value={masterName}
                onChange={(e) => setMasterName(e.target.value)}
                placeholder="Иван Петров"
                className={`w-full bg-background border-2 px-4 py-3 font-mono text-sm focus:outline-none focus:border-orange transition-colors ${errors.masterName ? "border-destructive" : "border-border"}`}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Type */}
              <div>
                <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-2">Тип *</label>
                <div className="grid grid-cols-3 gap-1">
                  {(["part", "tool", "consumable"] as SupplyType[]).map((t) => {
                    const cfg = TYPE_CONFIG[t];
                    const Icon = cfg.icon;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, supply_type: t }))}
                        className={`flex flex-col items-center gap-1 py-3 border-2 font-mono text-xs transition-colors ${
                          form.supply_type === t ? "border-orange bg-orange/10 text-orange" : "border-border text-muted-foreground hover:border-orange/30"
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Urgency */}
              <div>
                <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-2">Срочность *</label>
                <div className="grid grid-cols-2 gap-1">
                  {(["urgent", "planned"] as SupplyUrgency[]).map((u) => {
                    const cfg = URGENCY_CONFIG[u];
                    return (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, urgency: u }))}
                        className={`py-3 border-2 font-mono text-sm font-bold transition-colors ${
                          form.urgency === u
                            ? u === "urgent" ? "border-destructive bg-destructive/10 text-destructive" : "border-orange bg-orange/10 text-orange"
                            : "border-border text-muted-foreground hover:border-orange/30"
                        }`}
                      >
                        {u === "urgent" && <AlertTriangle className="w-4 h-4 inline mr-1" />}
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Item name */}
            <div>
              <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-1">Наименование *</label>
              <input
                type="text"
                value={form.item_name}
                onChange={(e) => setForm((p) => ({ ...p, item_name: e.target.value }))}
                placeholder="Тормозные колодки передние, артикул..."
                className={`w-full bg-background border-2 px-4 py-3 font-mono text-sm focus:outline-none focus:border-orange transition-colors text-lg ${errors.item_name ? "border-destructive" : "border-border"}`}
              />
              {errors.item_name && <p className="font-mono text-xs text-destructive mt-1">{errors.item_name}</p>}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Quantity */}
              <div className="col-span-1">
                <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-1">Количество *</label>
                <input
                  type="number"
                  min="1"
                  value={form.quantity}
                  onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
                  className={`w-full bg-background border-2 px-4 py-3 font-mono text-sm focus:outline-none focus:border-orange transition-colors text-center text-lg ${errors.quantity ? "border-destructive" : "border-border"}`}
                />
              </div>
              {/* Unit */}
              <div className="col-span-1">
                <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-1">Единица</label>
                <input
                  type="text"
                  value={form.unit}
                  onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
                  placeholder="шт."
                  className="w-full bg-background border-2 border-border px-4 py-3 font-mono text-sm focus:outline-none focus:border-orange transition-colors"
                />
              </div>
              {/* Appointment ID */}
              <div className="col-span-2">
                <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-1">ID заказа (необязательно)</label>
                <input
                  type="text"
                  value={form.appointment_id}
                  onChange={(e) => setForm((p) => ({ ...p, appointment_id: e.target.value }))}
                  placeholder="UUID заказа..."
                  className="w-full bg-background border-2 border-border px-4 py-3 font-mono text-xs focus:outline-none focus:border-orange transition-colors"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-1">Примечание</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                rows={2}
                placeholder="Дополнительная информация..."
                className="w-full bg-background border-2 border-border px-4 py-3 font-mono text-sm focus:outline-none focus:border-orange transition-colors resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-2 bg-orange text-primary-foreground px-6 py-3 font-display text-xl tracking-widest hover:bg-orange-bright transition-colors disabled:opacity-50 shadow-brutal"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShoppingCart className="w-5 h-5" />}
                {submitting ? "Отправляем..." : "Отправить заявку"}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="font-mono text-sm border-2 border-border px-5 py-3 hover:border-destructive hover:text-destructive transition-colors"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status filters */}
      <div className="flex flex-wrap gap-px bg-border mb-6">
        <button
          onClick={() => setStatusFilter("all")}
          className={`px-4 py-2 font-mono text-xs uppercase tracking-widest transition-colors ${statusFilter === "all" ? "bg-orange text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground hover:bg-surface"}`}
        >
          Все ({counts.all})
        </button>
        {(Object.entries(STATUS_CONFIG) as [SupplyStatus, typeof STATUS_CONFIG[SupplyStatus]][]).map(([st, cfg]) => (
          <button key={st} onClick={() => setStatusFilter(st)}
            className={`px-4 py-2 font-mono text-xs uppercase tracking-widest transition-colors ${statusFilter === st ? "bg-orange text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground hover:bg-surface"}`}
          >
            {cfg.label} ({counts[st] || 0})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-orange animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-border">
          <ShoppingCart className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
          <p className="font-mono text-sm text-muted-foreground">Заявок на снабжение нет</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((order) => {
            const typeCfg = TYPE_CONFIG[order.supply_type];
            const statusCfg = STATUS_CONFIG[order.status];
            const urgencyCfg = URGENCY_CONFIG[order.urgency];
            const TypeIcon = typeCfg.icon;
            const StatusIcon = statusCfg.icon;

            return (
              <div key={order.id} className="bg-surface border-2 border-border p-4 flex flex-col sm:flex-row sm:items-start gap-4">
                <div className={`w-10 h-10 flex items-center justify-center flex-shrink-0 border ${typeCfg.color}`}>
                  <TypeIcon className="w-5 h-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={`font-mono text-xs border px-2 py-0.5 ${urgencyCfg.color} font-bold`}>
                      {urgencyCfg.label}
                    </span>
                    <span className={`font-mono text-xs border px-2 py-0.5 ${typeCfg.color}`}>
                      {typeCfg.label}
                    </span>
                    <span className={`font-mono text-xs border px-2 py-0.5 ${statusCfg.color}`}>
                      <StatusIcon className="w-3 h-3 inline mr-1" />
                      {statusCfg.label}
                    </span>
                  </div>
                  <p className="font-display text-xl tracking-wider">{order.item_name}</p>
                  <div className="flex flex-wrap gap-4 mt-1 font-mono text-xs text-muted-foreground">
                    <span>Кол-во: <span className="text-foreground">{order.quantity} {order.unit}</span></span>
                    <span>Мастер: <span className="text-foreground">{order.master_name}</span></span>
                    {order.appointment_id && (
                      <span>Заказ: <span className="text-orange text-xs">{order.appointment_id.slice(0, 8)}…</span></span>
                    )}
                    <span>{new Date(order.created_at).toLocaleString("ru-RU")}</span>
                  </div>
                  {order.notes && (
                    <p className="font-mono text-xs text-muted-foreground mt-1 border-l-2 border-orange/30 pl-2">{order.notes}</p>
                  )}
                </div>

                {/* Status changer (admin/manager only) */}
                {isAtLeast("manager") && (
                  <div className="flex-shrink-0 relative">
                    <select
                      value={order.status}
                      onChange={(e) => updateStatus(order.id, e.target.value as SupplyStatus)}
                      disabled={updatingId === order.id}
                      className="bg-background border-2 border-border px-3 py-2 pr-8 font-mono text-xs appearance-none focus:outline-none focus:border-orange cursor-pointer"
                    >
                      <option value="pending">Ожидает</option>
                      <option value="approved">Одобрено</option>
                      <option value="ordered">Заказано</option>
                      <option value="received">Получено</option>
                      <option value="cancelled">Отменено</option>
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
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
