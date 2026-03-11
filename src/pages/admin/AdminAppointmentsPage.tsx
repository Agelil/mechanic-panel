import { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Clock, CheckCircle2, Wrench, XCircle, ChevronDown, Package, Bell, Upload, Trash2, Image, Eye } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { decryptPII } from "@/lib/encryption";
import { usePermission } from "@/hooks/use-permission";
import AppointmentFinancialBlock, { type WorkItem } from "@/components/admin/AppointmentFinancialBlock";

interface ServiceItem {
  id: string;
  name: string;
  price_from: number;
  price_to?: number | null;
}

interface Appointment {
  id: string;
  name: string;
  phone: string;
  car_make: string;
  car_vin: string | null;
  license_plate: string | null;
  service_type: string;
  services: ServiceItem[] | null;
  work_items: WorkItem[];
  parts_cost: number;
  services_cost: number;
  total_price: number | null;
  message: string | null;
  photos: string[] | null;
  status: string;
  client_notified: boolean;
  created_at: string;
}

interface SupplyOrder {
  id: string;
  item_name: string;
  quantity: number;
  appointment_id: string | null;
  status: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  new:            { label: "Новая",              color: "text-orange border-orange bg-orange/10",             icon: Clock },
  processing:     { label: "В работе",           color: "text-blue-400 border-blue-400/50 bg-blue-400/10",   icon: Wrench },
  parts_ordered:  { label: "Запчасти заказаны",  color: "text-yellow-400 border-yellow-400/50 bg-yellow-400/10", icon: Package },
  parts_arrived:  { label: "Запчасти приехали",  color: "text-purple-400 border-purple-400/50 bg-purple-400/10", icon: Package },
  ready:          { label: "Готово!",             color: "text-green-400 border-green-400/50 bg-green-400/10",  icon: CheckCircle2 },
  completed:      { label: "Завершено",           color: "text-muted-foreground border-border bg-muted",       icon: CheckCircle2 },
  cancelled:      { label: "Отменена",            color: "text-muted-foreground border-border bg-muted",       icon: XCircle },
};

const NOTIFY_STATUSES = ["parts_arrived", "ready", "completed"];

export default function AdminAppointmentsPage() {
  const { toast } = useToast();
  const canViewPrice = usePermission("view_appointment_price");

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [supplyOrders, setSupplyOrders] = useState<SupplyOrder[]>([]);
  const [catalogServices, setCatalogServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingUploadId, setPendingUploadId] = useState<string | null>(null);

  const load = async () => {
    const [{ data: appts }, { data: supply }, { data: services }] = await Promise.all([
      supabase.from("appointments").select("*").order("created_at", { ascending: false }),
      supabase.from("supply_orders").select("id, item_name, quantity, appointment_id, status"),
      supabase.from("services").select("id, name, price_from").eq("is_active", true).order("name"),
    ]);

    const decrypted = ((appts as unknown as Appointment[]) || []).map((a) => {
      const dec = decryptPII(a) as Appointment;
      return {
        ...dec,
        work_items: Array.isArray(dec.work_items) ? dec.work_items as WorkItem[] : [],
        parts_cost: dec.parts_cost ?? 0,
        services_cost: dec.services_cost ?? 0,
      };
    });
    setAppointments(decrypted);
    setSupplyOrders((supply as SupplyOrder[]) || []);
    setCatalogServices((services as ServiceItem[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const upsertClient = async (appt: Appointment) => {
    if (!appt.phone) return;
    // Use encrypted phone as the unique key (match on encrypted value)
    const { data: existing } = await supabase
      .from("clients")
      .select("id, car_history")
      .eq("phone", appt.phone)
      .maybeSingle();

    const carEntry = appt.car_make
      ? { car_make: appt.car_make, service_type: appt.service_type, date: appt.created_at }
      : null;

    if (existing) {
      // Update name if missing, append car history
      const history = Array.isArray(existing.car_history) ? existing.car_history : [];
      const alreadyHas = history.some(
        (h: Record<string, unknown>) => h.car_make === appt.car_make && h.date === appt.created_at
      );
      const newHistory = carEntry && !alreadyHas ? [...history, carEntry] : history;
      await supabase.from("clients").update({
        name: appt.name || undefined,
        car_history: newHistory,
      }).eq("id", existing.id);
    } else {
      // Create new client
      await supabase.from("clients").insert({
        phone: appt.phone,
        name: appt.name || null,
        car_history: carEntry ? [carEntry] : [],
        bonus_points: 0,
      });
    }
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("appointments").update({ status }).eq("id", id);
    const appt = appointments.find((a) => a.id === id);
    const updatedAppt = appt ? { ...appt, status } : null;
    setAppointments((prev) => prev.map((a) => a.id === id ? { ...a, status } : a));

    if (!updatedAppt) return;

    // Auto-create/update client on terminal statuses
    if (["ready", "completed"].includes(status)) {
      try {
        await upsertClient(updatedAppt);
      } catch { /* non-critical */ }
    }

    try {
      await supabase.functions.invoke("send-telegram-notification", {
        body: { type: "status_changed", appointment_id: id, new_status: status, appointment: updatedAppt },
      });
      if (NOTIFY_STATUSES.includes(status)) {
        toast({ title: "Уведомление отправлено", description: "Клиент уведомлён об изменении статуса" });
      }
    } catch { /* non-critical */ }

    try {
      await supabase.functions.invoke("sync-google-sheets", {
        body: { type: "updated", appointment: updatedAppt },
      });
    } catch { /* non-critical */ }
  };

  const uploadPhoto = async (id: string, file: File) => {
    setUploadingFor(id);
    try {
      const path = `${id}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("appointment-photos").upload(path, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("appointment-photos").getPublicUrl(path);

      const appt = appointments.find((a) => a.id === id);
      const existingPhotos = appt?.photos || [];
      const newPhotos = [...existingPhotos, publicUrl];
      await supabase.from("appointments").update({ photos: newPhotos }).eq("id", id);
      setAppointments((prev) => prev.map((a) => a.id === id ? { ...a, photos: newPhotos } : a));
      toast({ title: "Фото загружено" });
    } catch {
      toast({ title: "Ошибка загрузки фото", variant: "destructive" });
    }
    setUploadingFor(null);
  };

  const deletePhoto = async (id: string, photoUrl: string) => {
    const appt = appointments.find((a) => a.id === id);
    const newPhotos = (appt?.photos || []).filter((p) => p !== photoUrl);
    await supabase.from("appointments").update({ photos: newPhotos }).eq("id", id);
    setAppointments((prev) => prev.map((a) => a.id === id ? { ...a, photos: newPhotos } : a));
  };

  const handleFinancialChange = (
    id: string,
    items: WorkItem[],
    partsCost: number,
    servicesCost: number,
    total: number
  ) => {
    setAppointments((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, work_items: items, parts_cost: partsCost, services_cost: servicesCost, total_price: total || null }
          : a
      )
    );
  };

  const filtered = useMemo(
    () => statusFilter === "all" ? appointments : appointments.filter((a) => a.status === statusFilter),
    [appointments, statusFilter]
  );

  const counts: Record<string, number> = { all: appointments.length };
  Object.keys(STATUS_CONFIG).forEach((s) => {
    counts[s] = appointments.filter((a) => a.status === s).length;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-4xl tracking-wider">ЗАЯВКИ</h1>
          <p className="font-mono text-sm text-muted-foreground">Входящие заявки с расширенным управлением</p>
        </div>
        <div className="font-display text-4xl text-orange">{counts.new || 0}
          <span className="font-mono text-xs text-muted-foreground ml-1">новых</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-px bg-border mb-6">
        <button onClick={() => setStatusFilter("all")}
          className={`px-4 py-2 font-mono text-xs uppercase tracking-widest transition-colors ${statusFilter === "all" ? "bg-orange text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground hover:bg-surface"}`}>
          Все ({counts.all})
        </button>
        {Object.entries(STATUS_CONFIG).map(([st, cfg]) => (
          <button key={st} onClick={() => setStatusFilter(st)}
            className={`px-4 py-2 font-mono text-xs uppercase tracking-widest transition-colors ${statusFilter === st ? "bg-orange text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground hover:bg-surface"}`}>
            {cfg.label} ({counts[st] || 0})
          </button>
        ))}
      </div>

      <input type="file" ref={fileInputRef} accept="image/*" className="hidden"
        onChange={(e) => { if (e.target.files?.[0] && pendingUploadId) uploadPhoto(pendingUploadId, e.target.files[0]); }} />

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-orange animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 font-mono text-sm text-muted-foreground">Заявок нет</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((appt) => {
            const cfg = STATUS_CONFIG[appt.status] || STATUS_CONFIG.new;
            const Icon = cfg.icon;
            const isExpanded = expanded === appt.id;
            const services = Array.isArray(appt.services) ? appt.services as ServiceItem[] : [];
            const photos = Array.isArray(appt.photos) ? appt.photos as string[] : [];
            const apptSupply = supplyOrders.filter((s) => s.appointment_id === appt.id);

            return (
              <div key={appt.id} className={`bg-surface border-2 transition-colors ${isExpanded ? "border-orange/50" : "border-border hover:border-orange/20"}`}>
                {/* Header */}
                <div className="p-5 flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`inline-flex items-center gap-1.5 font-mono text-xs border px-2 py-1 ${cfg.color}`}>
                        <Icon className="w-3 h-3" />{cfg.label}
                      </span>
                      {appt.client_notified && (
                        <span className="inline-flex items-center gap-1 font-mono text-xs border px-2 py-1 text-foreground border-border">
                          <Bell className="w-3 h-3" />Клиент оповещён
                        </span>
                      )}
                      <span className="font-mono text-xs text-muted-foreground">
                        {new Date(appt.created_at).toLocaleString("ru-RU")}
                      </span>
                    </div>

                    <h3 className="font-display text-xl tracking-wider">{appt.name}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                      <div>
                        <span className="font-mono text-xs text-muted-foreground block">Телефон</span>
                        <a href={`tel:${appt.phone}`} className="font-mono text-sm hover:text-orange transition-colors">{appt.phone}</a>
                      </div>
                      <div>
                        <span className="font-mono text-xs text-muted-foreground block">Автомобиль</span>
                        <span className="font-mono text-sm">{appt.car_make}</span>
                      </div>
                      {appt.car_vin && (
                        <div>
                          <span className="font-mono text-xs text-muted-foreground block">VIN</span>
                          <span className="font-mono text-xs uppercase tracking-widest">{appt.car_vin}</span>
                        </div>
                      )}
                      {canViewPrice && appt.total_price ? (
                        <div>
                          <span className="font-mono text-xs text-muted-foreground block">К оплате</span>
                          <span className="font-mono text-sm text-orange font-bold">{formatPrice(appt.total_price)}</span>
                        </div>
                      ) : null}
                    </div>

                    {/* Quick financial summary if has data */}
                    {canViewPrice && (appt.parts_cost > 0 || appt.services_cost > 0) && (
                      <div className="flex gap-4 mt-2">
                        {appt.services_cost > 0 && (
                          <span className="font-mono text-xs text-muted-foreground">
                            Работы: <span className="text-foreground">{formatPrice(appt.services_cost)}</span>
                          </span>
                        )}
                        {appt.parts_cost > 0 && (
                          <span className="font-mono text-xs text-muted-foreground">
                            Запчасти: <span className="text-foreground">{formatPrice(appt.parts_cost)}</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Status dropdown */}
                    <div className="relative">
                      <select value={appt.status} onChange={(e) => updateStatus(appt.id, e.target.value)}
                        className="bg-background border-2 border-border px-3 py-2 pr-8 font-mono text-xs appearance-none focus:outline-none focus:border-orange cursor-pointer">
                        {Object.entries(STATUS_CONFIG).map(([st, cfg]) => (
                          <option key={st} value={st}>{cfg.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                    </div>

                    <button onClick={() => setExpanded(isExpanded ? null : appt.id)}
                      className={`p-2 border transition-colors ${isExpanded ? "border-orange text-orange" : "border-border text-muted-foreground hover:border-orange hover:text-orange"}`}>
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t-2 border-border p-5 space-y-5">
                    {/* Legacy services from booking form */}
                    {services.length > 0 && appt.work_items.length === 0 && (
                      <div>
                        <p className="font-mono text-xs text-orange uppercase tracking-widest mb-3">Услуги из заявки</p>
                        <div className="bg-background border border-border">
                          {services.map((s, i) => (
                            <div key={i} className="flex justify-between items-center px-4 py-2.5 border-b border-border last:border-0">
                              <span className="font-mono text-sm">{s.name}</span>
                              {canViewPrice && (
                                <span className="font-mono text-sm text-orange">{formatPrice(s.price_from)}{s.price_to ? ` — ${formatPrice(s.price_to)}` : ""}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Financial block */}
                    <AppointmentFinancialBlock
                      appointmentId={appt.id}
                      workItems={appt.work_items}
                      partsCost={appt.parts_cost}
                      servicesCost={appt.services_cost}
                      totalPrice={appt.total_price}
                      supplyOrders={apptSupply}
                      catalogServices={catalogServices}
                      onChange={(items, partsCost, servicesCost, total) =>
                        handleFinancialChange(appt.id, items, partsCost, servicesCost, total)
                      }
                    />

                    {/* Comment */}
                    {appt.message && (
                      <div>
                        <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-2">Комментарий</p>
                        <p className="font-mono text-sm border-l-2 border-orange/30 pl-3 text-muted-foreground">{appt.message}</p>
                      </div>
                    )}

                    {/* Photos */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <p className="font-mono text-xs text-orange uppercase tracking-widest">Фото дефектов ({photos.length})</p>
                        <button
                          onClick={() => { setPendingUploadId(appt.id); fileInputRef.current?.click(); }}
                          disabled={!!uploadingFor}
                          className="flex items-center gap-1.5 font-mono text-xs border border-border px-3 py-1.5 hover:border-orange hover:text-orange transition-colors disabled:opacity-50">
                          {uploadingFor === appt.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                          Загрузить фото
                        </button>
                      </div>
                      {photos.length > 0 ? (
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                          {photos.map((url, idx) => (
                            <div key={idx} className="relative group aspect-square">
                              <img src={url} alt={`Фото ${idx + 1}`} className="w-full h-full object-cover border border-border" />
                              <a href={url} target="_blank" rel="noopener noreferrer"
                                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Eye className="w-4 h-4 text-white" />
                              </a>
                              <button onClick={() => deletePhoto(appt.id, url)}
                                className="absolute top-1 right-1 w-5 h-5 bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="border-2 border-dashed border-border py-6 flex flex-col items-center gap-2 text-muted-foreground">
                          <Image className="w-8 h-8 opacity-30" />
                          <span className="font-mono text-xs">Фото ещё не загружены</span>
                        </div>
                      )}
                    </div>
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
