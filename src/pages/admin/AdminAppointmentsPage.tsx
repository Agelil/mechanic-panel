import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Clock, CheckCircle2, Wrench, XCircle, ChevronDown } from "lucide-react";

interface Appointment {
  id: string;
  name: string;
  phone: string;
  car_make: string;
  service_type: string;
  message: string | null;
  status: "new" | "processing" | "completed" | "cancelled";
  created_at: string;
}

const STATUS_CONFIG = {
  new: { label: "Новая", color: "text-orange border-orange bg-orange/10", icon: Clock },
  processing: { label: "В работе", color: "text-blue-400 border-blue-400/50 bg-blue-400/10", icon: Wrench },
  completed: { label: "Выполнено", color: "text-green-400 border-green-400/50 bg-green-400/10", icon: CheckCircle2 },
  cancelled: { label: "Отменена", color: "text-muted-foreground border-border bg-muted", icon: XCircle },
};

export default function AdminAppointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");

  const load = async () => {
    let q = supabase.from("appointments").select("*").order("created_at", { ascending: false });
    const { data } = await q;
    setAppointments((data as Appointment[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (id: string, status: Appointment["status"]) => {
    await supabase.from("appointments").update({ status }).eq("id", id);
    setAppointments((prev) => prev.map((a) => a.id === id ? { ...a, status } : a));
  };

  const filtered = statusFilter === "all"
    ? appointments
    : appointments.filter((a) => a.status === statusFilter);

  const counts = {
    all: appointments.length,
    new: appointments.filter((a) => a.status === "new").length,
    processing: appointments.filter((a) => a.status === "processing").length,
    completed: appointments.filter((a) => a.status === "completed").length,
    cancelled: appointments.filter((a) => a.status === "cancelled").length,
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-4xl tracking-wider">ЗАЯВКИ</h1>
        <p className="font-mono text-sm text-muted-foreground">Все входящие заявки с сайта</p>
      </div>

      {/* Filters */}
      <div className="flex gap-px bg-border mb-6 w-fit">
        {(["all", "new", "processing", "completed", "cancelled"] as const).map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-4 py-2 font-mono text-xs uppercase tracking-widest transition-colors ${
              statusFilter === st ? "bg-orange text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground hover:bg-surface"
            }`}
          >
            {st === "all" ? "Все" : STATUS_CONFIG[st].label} ({counts[st]})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-orange animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 font-mono text-sm text-muted-foreground">Заявок нет</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((appt) => {
            const cfg = STATUS_CONFIG[appt.status];
            const Icon = cfg.icon;
            return (
              <div key={appt.id} className="bg-surface border-2 border-border hover:border-orange/30 transition-colors p-5">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                      <span className={`inline-flex items-center gap-1.5 font-mono text-xs border px-2 py-1 ${cfg.color}`}>
                        <Icon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {new Date(appt.created_at).toLocaleString("ru-RU")}
                      </span>
                    </div>
                    <h3 className="font-display text-xl tracking-wider">{appt.name}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                      <div>
                        <span className="font-mono text-xs text-muted-foreground block">Телефон</span>
                        <a href={`tel:${appt.phone}`} className="font-mono text-sm hover:text-orange transition-colors">{appt.phone}</a>
                      </div>
                      <div>
                        <span className="font-mono text-xs text-muted-foreground block">Автомобиль</span>
                        <span className="font-mono text-sm">{appt.car_make}</span>
                      </div>
                      <div>
                        <span className="font-mono text-xs text-muted-foreground block">Услуга</span>
                        <span className="font-mono text-sm">{appt.service_type}</span>
                      </div>
                    </div>
                    {appt.message && (
                      <p className="font-mono text-xs text-muted-foreground mt-3 border-l-2 border-orange/30 pl-3">
                        {appt.message}
                      </p>
                    )}
                  </div>
                  
                  {/* Status selector */}
                  <div className="flex-shrink-0">
                    <label className="font-mono text-xs text-muted-foreground block mb-1">Статус</label>
                    <div className="relative">
                      <select
                        value={appt.status}
                        onChange={(e) => updateStatus(appt.id, e.target.value as Appointment["status"])}
                        className="bg-background border-2 border-border px-3 py-2 pr-8 font-mono text-xs appearance-none focus:outline-none focus:border-orange cursor-pointer"
                      >
                        <option value="new">Новая</option>
                        <option value="processing">В работе</option>
                        <option value="completed">Выполнено</option>
                        <option value="cancelled">Отменена</option>
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
