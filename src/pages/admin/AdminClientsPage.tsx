import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, Users, Phone, Car, Star, MessageSquare, Send,
  ChevronRight, Gift, Minus, Plus, History, Wrench, Package,
  Pencil, Trash2, AlertTriangle, Mail
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

interface CustomerCar {
  id: string;
  user_id: string;
  brand_model: string;
  vin: string | null;
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
  const canManageClients = usePermission("edit_clients");
  const canDeleteClients = usePermission("delete_clients");

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

  // Edit modal
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [editForm, setEditForm] = useState({ name: "", phone: "", car_make: "", car_vin: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [editNameError, setEditNameError] = useState("");
  const [phoneWarning, setPhoneWarning] = useState(false);

  // Delete modal
  const [deleteClient, setDeleteClient] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadClients = async () => {
    setLoading(true);
    const [c, t] = await Promise.all([
      supabase.from("clients").select("*").order("created_at", { ascending: false }),
      supabase.from("telegram_users").select("*").order("created_at", { ascending: false }),
    ]);
    setClients(c.data || []);
    setTgUsers(t.data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadClients();
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

  // Edit handlers
  const openEditClient = async (client: Client) => {
    setEditClient(client);
    setEditNameError("");
    setPhoneWarning(false);
    // Get car info from last appointment
    let carMake = "", carVin = "";
    const decPhone = decrypt(client.phone) || client.phone;
    if (decPhone) {
      const { data } = await supabase
        .from("appointments")
        .select("car_make, car_vin")
        .eq("phone", decPhone)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      carMake = data?.car_make || "";
      carVin = data?.car_vin || "";
    }
    setEditForm({
      name: client.name || "",
      phone: decPhone || client.phone,
      car_make: carMake,
      car_vin: carVin,
    });
  };

  const saveEditClient = async () => {
    if (!editClient) return;
    // Validate name (min 2 words)
    if (editForm.name.trim() && !/^\S+\s+\S+/.test(editForm.name.trim())) {
      setEditNameError("Укажите имя и фамилию (минимум два слова)");
      return;
    }
    setEditSaving(true);
    const originalPhone = decrypt(editClient.phone) || editClient.phone;
    const phoneChanged = editForm.phone.trim() !== originalPhone;

    await supabase
      .from("clients")
      .update({
        name: editForm.name.trim() || null,
        phone: editForm.phone.trim(),
      })
      .eq("id", editClient.id);

    setEditSaving(false);
    setEditClient(null);

    if (phoneChanged) {
      toast({
        title: "Данные обновлены",
        description: "⚠️ Номер телефона изменён — клиенту может потребоваться повторная привязка Telegram.",
      });
    } else {
      toast({ title: "Данные клиента обновлены" });
    }
    await loadClients();
  };

  // Delete handler
  const confirmDeleteClient = async () => {
    if (!deleteClient) return;
    setDeleting(true);

    await supabase.from("clients").delete().eq("id", deleteClient.id);

    const { data: { session } } = await supabase.auth.getSession();
    await supabase.from("security_audit_log").insert({
      user_id: session?.user?.id,
      user_email: session?.user?.email,
      action: "delete_client_account",
      target_table: "clients",
      target_id: deleteClient.id,
      details: { deleted_name: deleteClient.name, deleted_phone: deleteClient.phone },
    });

    setDeleting(false);
    setDeleteClient(null);
    toast({ title: "Клиент удалён", description: "Данные полностью удалены из базы." });
    await loadClients();
  };

  const openClientDetail = async (client: Client) => {
    setSelectedClientId(client.id);
    setHistoryLoading(true);
    setClientHistory([]);
    setBonusHistory([]);
    setBonusAdjust("");
    setBonusAdjustNote("");

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

    if (finalAppts.length === 0) {
      const decPhone = decrypt(client.phone);
      if (decPhone) {
        const { data: allAppts } = await supabase
          .from("appointments")
          .select("id, car_make, car_vin, license_plate, service_type, status, created_at, total_price, work_items, services, phone")
          .order("created_at", { ascending: false })
          .limit(1000);

        if (allAppts) {
          const { decrypt: dec } = await import("@/lib/encryption");
          finalAppts = allAppts.filter((a) => dec(a.phone) === decPhone);

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

              {/* Edit/Delete buttons in detail view */}
              <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                {canManageClients && (
                  <button
                    onClick={() => openEditClient(selectedClient)}
                    className="flex items-center gap-1.5 font-mono text-xs border border-border px-3 py-2 hover:border-orange hover:text-orange transition-colors"
                  >
                    <Pencil className="w-3 h-3" /> Редактировать
                  </button>
                )}
                {canDeleteClients && (
                  <button
                    onClick={() => setDeleteClient(selectedClient)}
                    className="flex items-center gap-1.5 font-mono text-xs border border-destructive/40 text-destructive px-3 py-2 hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" /> Удалить
                  </button>
                )}
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
                        className="w-full p-4 flex items-center justify-between text-left"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-8 h-8 bg-orange/10 border border-orange/20 flex items-center justify-center flex-shrink-0">
                            <Car className="w-4 h-4 text-orange" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-mono text-sm font-bold truncate">{appt.car_make}</p>
                            <p className="font-mono text-xs text-muted-foreground">
                              {new Date(appt.created_at).toLocaleDateString("ru-RU")} · {statusLabel}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          {appt.total_price != null && appt.total_price > 0 && (
                            <span className="font-mono text-sm text-orange">{formatPrice(appt.total_price)}</span>
                          )}
                          <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`} />
                        </div>
                      </button>

                      {isOpen && (
                        <div className="border-t border-border p-4 space-y-2">
                          {appt.car_vin && (
                            <p className="font-mono text-xs text-muted-foreground">VIN: {appt.car_vin}</p>
                          )}
                          {appt.license_plate && (
                            <p className="font-mono text-xs text-muted-foreground">Гос. номер: {appt.license_plate}</p>
                          )}
                          {workItems.length > 0 && (
                            <div className="space-y-1 mt-2">
                              {workItems.map((w: any, i: number) => (
                                <div key={i} className="flex justify-between font-mono text-xs">
                                  <span className="flex items-center gap-1">
                                    {w.type === "part" ? <Package className="w-3 h-3" /> : <Wrench className="w-3 h-3" />}
                                    {w.name}
                                  </span>
                                  <span className="text-orange">{formatPrice(w.unit_price || w.price || 0)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {services.length > 0 && workItems.length === 0 && (
                            <div className="space-y-1 mt-2">
                              {services.map((s: any, i: number) => (
                                <div key={i} className="flex justify-between font-mono text-xs">
                                  <span>{s.name}</span>
                                  <span className="text-orange">от {formatPrice(s.price_from)}</span>
                                </div>
                              ))}
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

  // ── Main list ────────────────────────────────────────────────────
  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="font-display text-4xl tracking-wider">КЛИЕНТЫ</h1>
          <p className="font-mono text-sm text-muted-foreground">CRM: клиентская база, бонусы и Telegram</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 mb-6">
        {[
          { key: "clients" as const, label: "Клиенты", icon: Users, count: clients.length },
          { key: "telegram" as const, label: "Telegram", icon: MessageSquare, count: tgUsers.length },
        ].map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-5 py-3 font-mono text-sm border-2 transition-colors ${
              tab === key ? "bg-orange text-primary-foreground border-orange" : "bg-surface border-border hover:border-orange"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
            <span className="text-xs opacity-70">({count})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 text-orange animate-spin" />
        </div>
      ) : tab === "clients" ? (
        <div className="space-y-2">
          {clients.map((client) => {
            const decPhone = decrypt(client.phone) || client.phone;
            return (
              <div key={client.id} className="bg-surface border-2 border-border p-4 flex flex-col sm:flex-row sm:items-center gap-4 hover:border-orange/30 transition-colors">
                <button
                  onClick={() => openClientDetail(client)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                >
                  <div className="w-10 h-10 bg-orange/10 border border-orange/20 flex items-center justify-center flex-shrink-0">
                    <Users className="w-5 h-5 text-orange" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-bold truncate">{client.name || "Без имени"}</p>
                    <p className="font-mono text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {decPhone}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {new Date(client.created_at).toLocaleDateString("ru-RU")}
                    </p>
                  </div>
                </button>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-center">
                    <span className="font-display text-xl text-orange">{client.bonus_points}</span>
                    <span className="font-mono text-xs text-muted-foreground block">баллов</span>
                  </div>
                  {client.telegram_chat_id ? (
                    <span className="font-mono text-xs border border-blue-400/30 bg-blue-400/10 text-blue-400 px-2 py-0.5 flex items-center gap-1">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/></svg>
                      TG
                    </span>
                  ) : (
                    <span className="font-mono text-xs border border-orange/30 bg-orange/10 text-orange px-2 py-0.5 flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      Email
                    </span>
                  )}

                  {canManageClients && (
                    <button
                      onClick={() => openEditClient(client)}
                      className="p-2 text-muted-foreground hover:text-orange border border-border hover:border-orange transition-colors"
                      title="Редактировать"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                  {canDeleteClients && (
                    <button
                      onClick={() => setDeleteClient(client)}
                      className="p-2 text-muted-foreground hover:text-destructive border border-border hover:border-destructive transition-colors"
                      title="Удалить"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}

                  <ChevronRight
                    className="w-4 h-4 text-muted-foreground cursor-pointer hover:text-orange"
                    onClick={() => openClientDetail(client)}
                  />
                </div>
              </div>
            );
          })}
          {clients.length === 0 && (
            <div className="text-center py-16 border-2 border-dashed border-border">
              <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="font-mono text-sm text-muted-foreground">Клиентов пока нет</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Broadcast */}
          <div className="bg-surface border-2 border-border p-5">
            <h3 className="font-display text-xl tracking-wider mb-3">РАССЫЛКА</h3>
            <div className="flex gap-3">
              <input
                type="text"
                value={broadcastMsg}
                onChange={(e) => setBroadcastMsg(e.target.value)}
                placeholder="Текст сообщения..."
                className="flex-1 bg-background border-2 border-border px-4 py-3 font-mono text-sm focus:outline-none focus:border-orange"
              />
              <button
                onClick={handleBroadcast}
                disabled={broadcasting || !broadcastMsg.trim()}
                className="bg-orange text-primary-foreground px-6 py-3 font-mono text-sm flex items-center gap-2 hover:bg-orange-bright transition-colors disabled:opacity-50"
              >
                {broadcasting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Отправить
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {tgUsers.map((u) => (
              <div key={u.id} className="bg-surface border-2 border-border p-4 flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-400/10 border border-blue-400/20 flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-sm font-bold">{u.first_name || "—"}</p>
                  {u.username && <p className="font-mono text-xs text-muted-foreground">@{u.username}</p>}
                  {u.phone && <p className="font-mono text-xs text-muted-foreground">📞 {u.phone}</p>}
                </div>
                <span className={`font-mono text-xs border px-2 py-0.5 ${u.is_active ? "text-green-400 border-green-400/30 bg-green-400/10" : "text-muted-foreground border-border"}`}>
                  {u.is_active ? "Активен" : "Неактивен"}
                </span>
              </div>
            ))}
            {tgUsers.length === 0 && (
              <div className="text-center py-12 border-2 border-dashed border-border">
                <p className="font-mono text-sm text-muted-foreground">Нет Telegram-подписчиков</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Client Modal */}
      {editClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-surface border-2 border-border shadow-brutal w-full max-w-md p-6">
            <h3 className="font-display text-xl tracking-wider mb-5">РЕДАКТИРОВАНИЕ КЛИЕНТА</h3>
            <p className="font-mono text-xs text-muted-foreground mb-4">{editClient.name || "Без имени"}</p>

            <div className="space-y-4">
              <div>
                <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-1">Имя и Фамилия</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => { setEditForm(p => ({ ...p, name: e.target.value })); setEditNameError(""); }}
                  placeholder="Иван Иванов"
                  className="w-full bg-background border-2 border-border px-4 py-3 font-mono text-sm focus:outline-none focus:border-orange transition-colors"
                />
                {editNameError && <p className="font-mono text-xs text-destructive mt-1">{editNameError}</p>}
              </div>
              <div>
                <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-1">Телефон</label>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => {
                    setEditForm(p => ({ ...p, phone: e.target.value }));
                    const orig = decrypt(editClient.phone) || editClient.phone;
                    setPhoneWarning(e.target.value !== orig);
                  }}
                  className="w-full bg-background border-2 border-border px-4 py-3 font-mono text-sm focus:outline-none focus:border-orange transition-colors"
                />
                {phoneWarning && (
                  <div className="flex items-center gap-1.5 mt-1.5 text-orange">
                    <AlertTriangle className="w-3 h-3" />
                    <span className="font-mono text-xs">При смене номера потребуется повторная привязка Telegram</span>
                  </div>
                )}
              </div>
              <div>
                <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-1">Автомобиль</label>
                <input
                  type="text"
                  value={editForm.car_make}
                  onChange={(e) => setEditForm(p => ({ ...p, car_make: e.target.value }))}
                  placeholder="Toyota Camry 2020"
                  className="w-full bg-background border-2 border-border px-4 py-3 font-mono text-sm focus:outline-none focus:border-orange transition-colors"
                  disabled
                />
                <p className="font-mono text-xs text-muted-foreground mt-1">Данные авто подтягиваются из заказов</p>
              </div>
              <div>
                <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-1">VIN</label>
                <input
                  type="text"
                  value={editForm.car_vin}
                  onChange={(e) => setEditForm(p => ({ ...p, car_vin: e.target.value.toUpperCase() }))}
                  maxLength={17}
                  className="w-full bg-background border-2 border-border px-4 py-3 font-mono text-sm focus:outline-none focus:border-orange transition-colors uppercase"
                  disabled
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setEditClient(null)}
                className="flex-1 font-mono text-sm border-2 border-border py-2.5 hover:border-muted-foreground transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={saveEditClient}
                disabled={editSaving}
                className="flex-1 bg-orange text-primary-foreground font-mono text-sm py-2.5 flex items-center justify-center gap-2 hover:bg-orange-bright transition-colors disabled:opacity-50"
              >
                {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Client Confirmation */}
      {deleteClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-surface border-2 border-destructive shadow-brutal w-full max-w-sm p-6">
            <h3 className="font-display text-xl tracking-wider text-destructive mb-3">УДАЛИТЬ КЛИЕНТА?</h3>
            <p className="font-mono text-sm text-muted-foreground mb-2">
              {deleteClient.name || "Без имени"}
            </p>
            <p className="font-mono text-xs text-muted-foreground mb-5">
              Все данные клиента, включая историю бонусов, будут удалены. Это действие нельзя отменить.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteClient(null)}
                className="flex-1 font-mono text-sm border-2 border-border py-2.5 hover:border-muted-foreground transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={confirmDeleteClient}
                disabled={deleting}
                className="flex-1 bg-destructive text-destructive-foreground font-mono text-sm py-2.5 flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
