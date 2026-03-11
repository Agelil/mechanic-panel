import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, Users, Phone, Car, Star, MessageSquare, Send,
  ChevronRight, Gift, Minus, Plus, History, Wrench, Package
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { decrypt } from "@/lib/encryption";
import { formatPrice } from "@/lib/utils";
import { usePermission } from "@/hooks/use-permission";

interface Client {
  id: string;
  phone: string;
  name: string | null;
  bonus_points: number;
  telegram_chat_id: string | null;
  telegram_username: string | null;
  car_history: unknown;
  created_at: string;
}

interface TelegramUser {
  id: string;
  chat_id: string;
  username: string | null;
  first_name: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

interface AppointmentRecord {
  id: string;
  car_make: string;
  car_vin: string | null;
  license_plate: string | null;
  service_type: string;
  status: string;
  created_at: string;
  total_price: number | null;
  work_items: { name: string; qty: number; unit_price: number }[] | null;
  services: { name: string; price_from: number }[] | null;
}

interface BonusTransaction {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  new: "Новая", processing: "В работе", parts_ordered: "Запчасти заказаны",
  parts_arrived: "Запчасти прибыли", ready: "Готово!", completed: "Завершено", cancelled: "Отменена",
};

export default function AdminClientsPage() {
  const { toast } = useToast();
  const canEditBonuses = usePermission("edit_bonuses");
  const canViewBonuses = usePermission("view_client_bonuses");
  const canViewHistory = usePermission("view_service_history");

  const [clients, setClients] = useState<Client[]>([]);
  const [tgUsers, setTgUsers] = useState<TelegramUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"clients" | "telegram">("clients");
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [broadcasting, setBroadcasting] = useState(false);

  // Client detail state
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientHistory, setClientHistory] = useState<AppointmentRecord[]>([]);
  const [bonusHistory, setBonusHistory] = useState<BonusTransaction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [bonusAdjust, setBonusAdjust] = useState("");
  const [bonusAdjustNote, setBonusAdjustNote] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [expandedAppt, setExpandedAppt] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from("clients").select("*").order("created_at", { ascending: false }),
      supabase.from("telegram_users").select("*").order("created_at", { ascending: false }),
    ]).then(([c, t]) => {
      setClients(c.data || []);
      setTgUsers(t.data || []);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        supabase.from("security_audit_log").insert({
          user_id: session.user.id,
          user_email: session.user.email,
          action: "view_clients",
          target_table: "clients",
          details: { page: "AdminClientsPage" },
        });
      }
    });
  }, []);

  const openClientDetail = async (client: Client) => {
    setSelectedClientId(client.id);
    setHistoryLoading(true);
    setClientHistory([]);
    setBonusHistory([]);
    setBonusAdjust("");
    setBonusAdjustNote("");

    // Query appointments by client_id (reliable FK link set at appointment completion)
    // Also fetch bonus transaction history in parallel
    const [{ data: apptsByClientId }, { data: bonusTx }] = await Promise.all([
      supabase
        .from("appointments")
        .select("id, car_make, car_vin, license_plate, service_type, status, created_at, total_price, work_items, services")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("bonus_transactions")
        .select("*")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    let finalAppts = apptsByClientId || [];

    // Fallback: if no results via client_id (legacy records), try matching by decrypted phone
    if (finalAppts.length === 0) {
      const decPhone = decrypt(client.phone);
      if (decPhone) {
        // Fetch all appointments and filter client-side by decrypted phone
        const { data: allAppts } = await supabase
          .from("appointments")
          .select("id, car_make, car_vin, license_plate, service_type, status, created_at, total_price, work_items, services, phone")
          .order("created_at", { ascending: false })
          .limit(1000);

        if (allAppts) {
          const { decrypt: dec } = await import("@/lib/encryption");
          finalAppts = allAppts.filter((a) => dec(a.phone) === decPhone);

          // Backfill client_id on matched legacy appointments
          if (finalAppts.length > 0) {
            const ids = finalAppts.map((a) => a.id);
            supabase
              .from("appointments")
              .update({ client_id: client.id })
              .in("id", ids)
              .then(() => {});
          }
        }
      }
    }

    setClientHistory(finalAppts as AppointmentRecord[]);
    setBonusHistory((bonusTx as BonusTransaction[]) || []);
    setHistoryLoading(false);
  };

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  const handleBonusAdjust = async (type: "manual_add" | "manual_deduct") => {
    if (!selectedClient || !bonusAdjust) return;
    const amount = parseInt(bonusAdjust);
    if (isNaN(amount) || amount <= 0) return;

    setAdjusting(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const finalAmount = type === "manual_deduct" ? -amount : amount;
      const newBalance = selectedClient.bonus_points + finalAmount;
      if (newBalance < 0) {
        toast({ title: "Недостаточно бонусов на счёте", variant: "destructive" });
        setAdjusting(false);
        return;
      }

      await Promise.all([
        supabase.from("clients").update({ bonus_points: newBalance }).eq("id", selectedClient.id),
        supabase.from("bonus_transactions").insert({
          client_id: selectedClient.id,
          amount: finalAmount,
          type,
          description: bonusAdjustNote || (type === "manual_add" ? "Ручное начисление" : "Ручное списание"),
          created_by: session.session?.user.id,
        }),
      ]);

      setClients((prev) => prev.map((c) => c.id === selectedClient.id ? { ...c, bonus_points: newBalance } : c));
      setBonusHistory((prev) => [{
        id: Date.now().toString(),
        amount: finalAmount,
        type,
        description: bonusAdjustNote || null,
        created_at: new Date().toISOString(),
      }, ...prev]);
      setBonusAdjust("");
      setBonusAdjustNote("");
      toast({ title: type === "manual_add" ? "✓ Бонусы начислены" : "✓ Бонусы списаны", description: `Новый баланс: ${newBalance} баллов` });
    } catch {
      toast({ title: "Ошибка", variant: "destructive" });
    }
    setAdjusting(false);
  };

  const handleBroadcast = async () => {
    if (!broadcastMsg.trim()) return;
    setBroadcasting(true);
    try {
      const { data } = await supabase.functions.invoke("send-telegram-notification", {
        body: { type: "broadcast", message: broadcastMsg.trim() },
      });
      toast({ title: "Рассылка отправлена", description: `Доставлено: ${data?.sent || 0}` });
      setBroadcastMsg("");
    } catch {
      toast({ title: "Ошибка рассылки", variant: "destructive" });
    }
    setBroadcasting(false);
  };

  const bonusTypeLabel: Record<string, { label: string; color: string }> = {
    accrual: { label: "Начисление", color: "text-green-400" },
    spend: { label: "Списание", color: "text-destructive" },
    manual_add: { label: "Ручное начисление", color: "text-green-400" },
    manual_deduct: { label: "Ручное списание", color: "text-destructive" },
    cancel: { label: "Отмена начисления", color: "text-muted-foreground" },
  };

  // ── Client Detail Panel ──────────────────────────────────────────
  if (selectedClientId && selectedClient) {
    const decPhone = decrypt(selectedClient.phone);
    const completedAppts = clientHistory.filter((a) => ["completed", "ready"].includes(a.status));
    const totalSpent = completedAppts.reduce((s, a) => s + (a.total_price || 0), 0);

    return (
      <div>
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => setSelectedClientId(null)}
            className="font-mono text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            ← Клиенты
          </button>
          <span className="text-border">/</span>
          <h1 className="font-display text-2xl tracking-wider">{selectedClient.name || "Без имени"}</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: client info + bonuses */}
          <div className="space-y-4">
            {/* Profile */}
            <div className="bg-surface border-2 border-border p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-orange/10 border border-orange/20 flex items-center justify-center flex-shrink-0">
                  <Users className="w-6 h-6 text-orange" />
                </div>
                <div>
                  <h2 className="font-display text-2xl tracking-wider">{selectedClient.name || "Без имени"}</h2>
                  {decPhone && (
                    <a href={`tel:${decPhone}`} className="flex items-center gap-1 font-mono text-sm text-orange hover:text-orange-bright">
                      <Phone className="w-3 h-3" />{decPhone}
                    </a>
                  )}
                </div>
              </div>
              <div className="space-y-2 font-mono text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Клиент с</span>
                  <span>{new Date(selectedClient.created_at).toLocaleDateString("ru-RU")}</span>
                </div>
                <div className="flex justify-between">
                  <span>Завершённых заказов</span>
                  <span className="text-foreground font-bold">{completedAppts.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Потрачено всего</span>
                  <span className="text-orange font-bold">{formatPrice(totalSpent)}</span>
                </div>
              </div>
            </div>

            {/* Bonus balance */}
            {canViewBonuses ? (
            <div className="bg-surface border-2 border-orange/30 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Star className="w-5 h-5 text-orange" />
                <h3 className="font-display text-xl tracking-wider">БОНУСЫ</h3>
              </div>
              <div className="text-center py-4 bg-orange/5 border border-orange/20 mb-4">
                <span className="font-display text-5xl text-orange">{selectedClient.bonus_points}</span>
                <span className="font-mono text-sm text-muted-foreground block mt-1">баллов</span>
              </div>

              {canEditBonuses && (
                <div className="space-y-2">
                  <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Корректировка баланса</p>
                  <input
                    type="number"
                    value={bonusAdjust}
                    onChange={(e) => setBonusAdjust(e.target.value)}
                    placeholder="Кол-во баллов"
                    min="1"
                    className="w-full bg-background border-2 border-border px-3 py-2 font-mono text-sm focus:outline-none focus:border-orange"
                  />
                  <input
                    type="text"
                    value={bonusAdjustNote}
                    onChange={(e) => setBonusAdjustNote(e.target.value)}
                    placeholder="Причина (опционально)"
                    className="w-full bg-background border-2 border-border px-3 py-2 font-mono text-sm focus:outline-none focus:border-orange"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleBonusAdjust("manual_add")}
                      disabled={adjusting || !bonusAdjust}
                      className="flex-1 flex items-center justify-center gap-1 bg-green-500/10 border-2 border-green-500/30 text-green-400 px-3 py-2 font-mono text-xs hover:bg-green-500/20 transition-colors disabled:opacity-50"
                    >
                      {adjusting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                      Начислить
                    </button>
                    <button
                      onClick={() => handleBonusAdjust("manual_deduct")}
                      disabled={adjusting || !bonusAdjust}
                      className="flex-1 flex items-center justify-center gap-1 bg-destructive/10 border-2 border-destructive/30 text-destructive px-3 py-2 font-mono text-xs hover:bg-destructive/20 transition-colors disabled:opacity-50"
                    >
                      {adjusting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Minus className="w-3 h-3" />}
                      Списать
                    </button>
                  </div>
                </div>
              )}
            </div>
            ) : null}

            {/* Bonus transaction history */}
            {canViewBonuses && bonusHistory.length > 0 && (
              <div className="bg-surface border-2 border-border p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Gift className="w-4 h-4 text-orange" />
                  <h3 className="font-mono text-xs uppercase tracking-widest">История бонусов</h3>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {bonusHistory.map((tx) => {
                    const cfg = bonusTypeLabel[tx.type] || { label: tx.type, color: "text-muted-foreground" };
                    return (
                      <div key={tx.id} className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className={`font-mono text-xs ${cfg.color}`}>{cfg.label}</span>
                          {tx.description && <p className="font-mono text-xs text-muted-foreground truncate">{tx.description}</p>}
                          <p className="font-mono text-xs text-muted-foreground/50">{new Date(tx.created_at).toLocaleDateString("ru-RU")}</p>
                        </div>
                        <span className={`font-mono text-sm font-bold flex-shrink-0 ${tx.amount >= 0 ? "text-green-400" : "text-destructive"}`}>
                          {tx.amount >= 0 ? "+" : ""}{tx.amount}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right: service history */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <History className="w-5 h-5 text-orange" />
              <h2 className="font-display text-2xl tracking-wider">ИСТОРИЯ ОБСЛУЖИВАНИЯ</h2>
              <span className="font-mono text-xs text-muted-foreground ml-auto">{clientHistory.length} записей</span>
            </div>

            {historyLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 text-orange animate-spin" />
              </div>
            ) : clientHistory.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-border">
                <Car className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="font-mono text-sm text-muted-foreground">История заказов пуста</p>
                <p className="font-mono text-xs text-muted-foreground mt-1">Заказы появятся после первого обращения</p>
              </div>
            ) : (
              <div className="space-y-2">
                {clientHistory.map((appt) => {
                  const isOpen = expandedAppt === appt.id;
                  const workItems = Array.isArray(appt.work_items) ? appt.work_items : [];
                  const services = Array.isArray(appt.services) ? appt.services : [];
                  const statusLabel = STATUS_LABELS[appt.status] || appt.status;
                  const isCompleted = ["completed", "ready"].includes(appt.status);
                  return (
                    <div key={appt.id} className={`bg-surface border-2 transition-colors ${isCompleted ? "border-border hover:border-orange/20" : "border-border/50 opacity-70"}`}>
                      <button
                        onClick={() => setExpandedAppt(isOpen ? null : appt.id)}
                        className="w-full p-4 flex items-center gap-4 text-left"
                      >
                        <div className="w-10 h-10 bg-orange/10 border border-orange/20 flex items-center justify-center flex-shrink-0">
                          <Car className="w-5 h-5 text-orange" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="font-display text-xl tracking-wider">{appt.car_make}</span>
                            {appt.license_plate && <span className="font-mono text-xs bg-surface border border-border px-2 py-0.5">{appt.license_plate}</span>}
                            <span className={`font-mono text-xs ${isCompleted ? "text-green-400" : "text-muted-foreground"}`}>{statusLabel}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 font-mono text-xs text-muted-foreground flex-wrap">
                            <span>{new Date(appt.created_at).toLocaleDateString("ru-RU")}</span>
                            <span>{appt.service_type}</span>
                            {appt.car_vin && <span className="text-orange/60">VIN: {appt.car_vin}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          {appt.total_price ? (
                            <span className="font-mono text-sm font-bold text-orange">{formatPrice(appt.total_price)}</span>
                          ) : null}
                          <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`} />
                        </div>
                      </button>

                      {isOpen && (
                        <div className="border-t-2 border-border p-4 space-y-4">
                          {workItems.length > 0 && (
                            <div>
                              <div className="flex items-center gap-1 mb-2">
                                <Wrench className="w-3.5 h-3.5 text-orange" />
                                <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Выполненные работы</p>
                              </div>
                              <div className="space-y-1">
                                {workItems.map((w, i) => (
                                  <div key={i} className="flex justify-between font-mono text-sm py-1 border-b border-border/30 last:border-0">
                                    <span>{w.name}{w.qty > 1 ? ` × ${w.qty}` : ""}</span>
                                    {w.unit_price > 0 && <span className="text-orange ml-4 flex-shrink-0">{formatPrice(w.qty * w.unit_price)}</span>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {services.length > 0 && workItems.length === 0 && (
                            <div>
                              <div className="flex items-center gap-1 mb-2">
                                <Package className="w-3.5 h-3.5 text-orange" />
                                <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Услуги</p>
                              </div>
                              <div className="space-y-1">
                                {services.map((s, i) => (
                                  <div key={i} className="flex justify-between font-mono text-sm py-1 border-b border-border/30 last:border-0">
                                    <span>{s.name}</span>
                                    {s.price_from > 0 && <span className="text-orange ml-4 flex-shrink-0">от {formatPrice(s.price_from)}</span>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {workItems.length === 0 && services.length === 0 && (
                            <p className="font-mono text-xs text-muted-foreground">Состав работ не указан</p>
                          )}
                          {appt.total_price && (
                            <div className="flex justify-between items-center pt-2 border-t-2 border-orange/20">
                              <span className="font-mono text-sm font-bold">Итого</span>
                              <span className="font-display text-2xl text-orange">{formatPrice(appt.total_price)}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Main clients list ────────────────────────────────────────────
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-4xl tracking-wider">КЛИЕНТЫ</h1>
          <p className="font-mono text-sm text-muted-foreground">База клиентов и Telegram-подписчики</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-xs text-muted-foreground">{clients.length} клиентов</span>
          <span className="font-mono text-xs text-orange">{tgUsers.length} в Telegram</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-px bg-border mb-6 w-fit">
        {(["clients", "telegram"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2.5 font-mono text-xs uppercase tracking-widest transition-colors ${tab === t ? "bg-orange text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground hover:bg-surface"}`}>
            {t === "clients" ? `Клиенты (${clients.length})` : `Telegram (${tgUsers.length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-orange animate-spin" /></div>
      ) : tab === "clients" ? (
        <>
          {clients.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-border">
              <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="font-mono text-sm text-muted-foreground">Клиентов пока нет. Они появятся после первых заявок.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {clients.map((client) => (
                <button
                  key={client.id}
                  onClick={() => openClientDetail(client)}
                  className="w-full bg-surface border-2 border-border hover:border-orange/40 transition-colors p-5 text-left group"
                >
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="w-10 h-10 bg-orange/10 border border-orange/20 flex items-center justify-center flex-shrink-0">
                      <Users className="w-5 h-5 text-orange" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display text-xl tracking-wider">{client.name || "Без имени"}</h3>
                      <div className="flex flex-wrap gap-4 mt-1">
                        <span className="flex items-center gap-1 font-mono text-sm">
                          <Phone className="w-3 h-3 text-orange" />
                          {decrypt(client.phone)}
                        </span>
                        {client.telegram_username && (
                          <span className="flex items-center gap-1 font-mono text-sm text-muted-foreground">
                            <MessageSquare className="w-3 h-3" />@{client.telegram_username}
                          </span>
                        )}
                        <span className="flex items-center gap-1 font-mono text-sm text-orange">
                          <Star className="w-3 h-3" />{client.bonus_points} бонусов
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-muted-foreground">
                        {new Date(client.created_at).toLocaleDateString("ru-RU")}
                      </span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-orange transition-colors" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {/* Broadcast */}
          <div className="bg-surface border-2 border-orange/30 p-5 mb-6">
            <h3 className="font-display text-xl tracking-wider mb-3 flex items-center gap-2">
              <Send className="w-5 h-5 text-orange" />
              РАССЫЛКА ВСЕМ ПОДПИСЧИКАМ
            </h3>
            <p className="font-mono text-xs text-muted-foreground mb-4">
              Сообщение получат <strong>{tgUsers.filter(u => u.is_active).length}</strong> активных подписчиков Telegram-бота.
            </p>
            <textarea
              value={broadcastMsg}
              onChange={(e) => setBroadcastMsg(e.target.value)}
              placeholder="🎉 Новая акция! Скидка 20% на ТО до конца месяца."
              rows={4}
              className="w-full bg-background border-2 border-border px-4 py-3 font-mono text-sm focus:outline-none focus:border-orange transition-colors resize-none mb-3"
            />
            <button onClick={handleBroadcast} disabled={broadcasting || !broadcastMsg.trim()}
              className="flex items-center gap-2 bg-orange text-primary-foreground px-5 py-2.5 font-mono text-sm hover:bg-orange-bright transition-colors disabled:opacity-50 shadow-brutal-sm">
              {broadcasting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {broadcasting ? "Отправляем..." : "Отправить рассылку"}
            </button>
          </div>

          {tgUsers.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-border">
              <MessageSquare className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="font-mono text-sm text-muted-foreground">Подписчиков пока нет.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tgUsers.map((user) => (
                <div key={user.id} className={`bg-surface border-2 transition-colors p-4 flex items-center gap-4 ${user.is_active ? "border-border hover:border-orange/20" : "border-border/30 opacity-50"}`}>
                  <div className="w-8 h-8 bg-orange/10 flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="w-4 h-4 text-orange" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold">{user.first_name || "Без имени"}</span>
                      {user.username && <span className="font-mono text-xs text-muted-foreground">@{user.username}</span>}
                      <span className="font-mono text-xs text-orange/70">ID: {user.chat_id}</span>
                    </div>
                    {user.phone && (
                      <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                        <Phone className="w-3 h-3" />{user.phone}
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">{new Date(user.created_at).toLocaleDateString("ru-RU")}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
