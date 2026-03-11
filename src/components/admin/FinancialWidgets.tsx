import { useMemo } from "react";
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";
import { TrendingUp, Calculator, AlertTriangle, DollarSign } from "lucide-react";
import { formatPrice } from "@/lib/utils";

interface Appointment {
  id: string;
  status: string;
  total_price: number | null;
  parts_cost: number;
  services_cost: number;
  is_paid: boolean;
  created_at: string;
}

interface Props {
  appointments: Appointment[];
}

export default function FinancialWidgets({ appointments }: Props) {
  const stats = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const completed = appointments.filter((a) => a.status === "completed");

    const todayCompleted = completed.filter((a) => {
      const d = new Date(a.created_at);
      return d >= todayStart && d <= todayEnd;
    });

    const monthCompleted = completed.filter((a) => {
      const d = new Date(a.created_at);
      return d >= monthStart && d <= monthEnd;
    });

    const revenueToday = todayCompleted.reduce((s, a) => s + (a.total_price || 0), 0);
    const revenueMonth = monthCompleted.reduce((s, a) => s + (a.total_price || 0), 0);
    const avgCheck = monthCompleted.length > 0
      ? Math.round(revenueMonth / monthCompleted.length)
      : 0;

    // Unpaid completed orders (дебиторка)
    const unpaid = completed.filter((a) => !a.is_paid && (a.total_price || 0) > 0);
    const unpaidTotal = unpaid.reduce((s, a) => s + (a.total_price || 0), 0);

    // Parts vs services split this month
    const partsMonth = monthCompleted.reduce((s, a) => s + (a.parts_cost || 0), 0);
    const servicesMonth = monthCompleted.reduce((s, a) => s + (a.services_cost || 0), 0);

    return {
      revenueToday,
      revenueMonth,
      avgCheck,
      monthOrders: monthCompleted.length,
      unpaidTotal,
      unpaidCount: unpaid.length,
      partsMonth,
      servicesMonth,
    };
  }, [appointments]);

  const widgets = [
    {
      label: "Выручка за день",
      value: formatPrice(stats.revenueToday),
      icon: DollarSign,
      color: "text-green-400",
      borderColor: "border-green-400/30",
      bgColor: "bg-green-400/5",
    },
    {
      label: "Выручка за месяц",
      value: formatPrice(stats.revenueMonth),
      sub: `${stats.monthOrders} заказов`,
      icon: TrendingUp,
      color: "text-orange",
      borderColor: "border-orange/30",
      bgColor: "bg-orange/5",
    },
    {
      label: "Средний чек",
      value: formatPrice(stats.avgCheck),
      icon: Calculator,
      color: "text-blue-400",
      borderColor: "border-blue-400/30",
      bgColor: "bg-blue-400/5",
    },
    {
      label: "Дебиторка",
      value: formatPrice(stats.unpaidTotal),
      sub: stats.unpaidCount > 0 ? `${stats.unpaidCount} неоплач.` : "Всё оплачено",
      icon: AlertTriangle,
      color: stats.unpaidTotal > 0 ? "text-red-400" : "text-green-400",
      borderColor: stats.unpaidTotal > 0 ? "border-red-400/30" : "border-green-400/30",
      bgColor: stats.unpaidTotal > 0 ? "bg-red-400/5" : "bg-green-400/5",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {widgets.map((w) => {
        const Icon = w.icon;
        return (
          <div key={w.label} className={`${w.bgColor} border-2 ${w.borderColor} p-4`}>
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`w-4 h-4 ${w.color}`} />
              <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">{w.label}</span>
            </div>
            <div className={`font-display text-2xl ${w.color}`}>{w.value}</div>
            {w.sub && <p className="font-mono text-xs text-muted-foreground mt-1">{w.sub}</p>}
          </div>
        );
      })}

      {/* Breakdown bar */}
      {(stats.partsMonth > 0 || stats.servicesMonth > 0) && (
        <div className="col-span-2 lg:col-span-4 bg-surface border-2 border-border p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Структура выручки (месяц)</span>
            <span className="font-mono text-xs text-muted-foreground">
              Работы: {formatPrice(stats.servicesMonth)} · Запчасти: {formatPrice(stats.partsMonth)}
            </span>
          </div>
          <div className="h-3 flex overflow-hidden border border-border">
            {stats.servicesMonth > 0 && (
              <div
                className="bg-blue-400/60 h-full"
                style={{ width: `${(stats.servicesMonth / (stats.servicesMonth + stats.partsMonth)) * 100}%` }}
              />
            )}
            {stats.partsMonth > 0 && (
              <div
                className="bg-orange/60 h-full"
                style={{ width: `${(stats.partsMonth / (stats.servicesMonth + stats.partsMonth)) * 100}%` }}
              />
            )}
          </div>
          <div className="flex gap-4 mt-1">
            <span className="font-mono text-[10px] text-blue-400 flex items-center gap-1">
              <span className="w-2 h-2 bg-blue-400/60" /> Работы
            </span>
            <span className="font-mono text-[10px] text-orange flex items-center gap-1">
              <span className="w-2 h-2 bg-orange/60" /> Запчасти
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
