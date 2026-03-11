import { useMemo, useState } from "react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, format,
  isSameMonth, isSameDay, isToday, addMonths, subMonths
} from "date-fns";
import { ru } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Clock, Wrench, CheckCircle2, Package, XCircle } from "lucide-react";

interface CalendarAppointment {
  id: string;
  name: string;
  car_make: string;
  status: string;
  scheduled_at: string | null;
  created_at: string;
  total_price: number | null;
}

interface Props {
  appointments: CalendarAppointment[];
  onSelect: (id: string) => void;
}

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  new:           { bg: "bg-orange/20",      border: "border-orange/50",      text: "text-orange" },
  processing:    { bg: "bg-blue-400/20",    border: "border-blue-400/50",    text: "text-blue-400" },
  parts_ordered: { bg: "bg-yellow-400/20",  border: "border-yellow-400/50",  text: "text-yellow-400" },
  parts_arrived: { bg: "bg-purple-400/20",  border: "border-purple-400/50",  text: "text-purple-400" },
  ready:         { bg: "bg-green-400/20",   border: "border-green-400/50",   text: "text-green-400" },
  completed:     { bg: "bg-muted",          border: "border-border",         text: "text-muted-foreground" },
  cancelled:     { bg: "bg-muted",          border: "border-border",         text: "text-muted-foreground" },
};

const STATUS_LABELS: Record<string, string> = {
  new: "Новая",
  processing: "В работе",
  parts_ordered: "Запчасти заказаны",
  parts_arrived: "Запчасти приехали",
  ready: "Готово",
  completed: "Завершено",
  cancelled: "Отменена",
};

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export default function AppointmentCalendar({ appointments, onSelect }: Props) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const days: Date[] = [];
    let day = startDate;
    while (day <= endDate) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [currentMonth]);

  const appointmentsByDate = useMemo(() => {
    const map: Record<string, CalendarAppointment[]> = {};
    appointments.forEach((appt) => {
      const dateStr = format(new Date(appt.scheduled_at || appt.created_at), "yyyy-MM-dd");
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push(appt);
    });
    return map;
  }, [appointments]);

  return (
    <div>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="p-2 border border-border hover:border-orange hover:text-orange transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h2 className="font-display text-2xl tracking-wider capitalize">
          {format(currentMonth, "LLLL yyyy", { locale: ru })}
        </h2>
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="p-2 border border-border hover:border-orange hover:text-orange transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mb-4">
        {Object.entries(STATUS_LABELS).filter(([k]) => !["completed", "cancelled"].includes(k)).map(([key, label]) => {
          const c = STATUS_COLORS[key];
          return (
            <span key={key} className={`font-mono text-[10px] border px-2 py-0.5 ${c.bg} ${c.border} ${c.text}`}>
              {label}
            </span>
          );
        })}
      </div>

      {/* Calendar grid */}
      <div className="border-2 border-border">
        {/* Weekday header */}
        <div className="grid grid-cols-7 border-b border-border">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-1 py-2 text-center font-mono text-xs text-muted-foreground uppercase tracking-widest border-r border-border last:border-r-0">
              {d}
            </div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, idx) => {
            const dateKey = format(day, "yyyy-MM-dd");
            const dayAppts = appointmentsByDate[dateKey] || [];
            const inMonth = isSameMonth(day, currentMonth);
            const today = isToday(day);

            return (
              <div
                key={idx}
                className={`min-h-[100px] border-r border-b border-border last:border-r-0 p-1 ${
                  !inMonth ? "bg-muted/30" : today ? "bg-orange/5" : "bg-background"
                }`}
              >
                <div className={`font-mono text-xs mb-1 ${
                  today ? "text-orange font-bold" : !inMonth ? "text-muted-foreground/40" : "text-muted-foreground"
                }`}>
                  {format(day, "d")}
                </div>
                <div className="space-y-0.5">
                  {dayAppts.slice(0, 3).map((appt) => {
                    const c = STATUS_COLORS[appt.status] || STATUS_COLORS.new;
                    return (
                      <button
                        key={appt.id}
                        onClick={() => onSelect(appt.id)}
                        className={`w-full text-left px-1 py-0.5 border ${c.bg} ${c.border} ${c.text} font-mono text-[10px] truncate hover:opacity-80 transition-opacity`}
                        title={`${appt.name} — ${appt.car_make}`}
                      >
                        {appt.name.split(" ")[0]} · {appt.car_make.split(" ")[0]}
                      </button>
                    );
                  })}
                  {dayAppts.length > 3 && (
                    <span className="font-mono text-[10px] text-muted-foreground px-1">
                      +{dayAppts.length - 3} ещё
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
