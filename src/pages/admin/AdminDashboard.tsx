import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Wrench, Images, ClipboardList, TrendingUp, Tag, Users } from "lucide-react";
import { Link } from "react-router-dom";

export default function AdminDashboard() {
  const [counts, setCounts] = useState({ services: 0, portfolio: 0, appointments: 0, newAppointments: 0, promotions: 0, clients: 0 });

  useEffect(() => {
    async function load() {
      const [svc, port, appt, newAppt, promo, clients] = await Promise.all([
        supabase.from("services").select("id", { count: "exact", head: true }),
        supabase.from("portfolio").select("id", { count: "exact", head: true }),
        supabase.from("appointments").select("id", { count: "exact", head: true }),
        supabase.from("appointments").select("id", { count: "exact", head: true }).eq("status", "new"),
        supabase.from("promotions").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("clients").select("id", { count: "exact", head: true }),
      ]);
      setCounts({
        services: svc.count || 0,
        portfolio: port.count || 0,
        appointments: appt.count || 0,
        newAppointments: newAppt.count || 0,
        promotions: promo.count || 0,
        clients: clients.count || 0,
      });
    }
    load();
  }, []);

  const cards = [
    { label: "Новых заявок", value: counts.newAppointments, icon: TrendingUp, href: "/admin/appointments" },
    { label: "Заявок всего", value: counts.appointments, icon: ClipboardList, href: "/admin/appointments" },
    { label: "Активных акций", value: counts.promotions, icon: Tag, href: "/admin/promotions" },
    { label: "Клиентов в базе", value: counts.clients, icon: Users, href: "/admin/clients" },
    { label: "Услуг", value: counts.services, icon: Wrench, href: "/admin/services" },
    { label: "Работ в портфолио", value: counts.portfolio, icon: Images, href: "/admin/portfolio" },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-4xl tracking-wider">ДАШБОРД</h1>
        <p className="font-mono text-sm text-muted-foreground mt-1">Сводная статистика сайта</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.label} to={card.href} className="bg-surface border-2 border-border p-4 hover:border-orange transition-colors group shadow-brutal-sm">
              <Icon className="w-4 h-4 text-orange mb-3" />
              <div className="font-display text-4xl text-orange mb-1">{card.value}</div>
              <div className="font-mono text-xs text-muted-foreground uppercase tracking-widest leading-tight">{card.label}</div>
            </Link>
          );
        })}
      </div>

      <div className="bg-orange/10 border-2 border-orange/30 p-6">
        <h3 className="font-display text-2xl tracking-wider mb-2">БЫСТРЫЕ ДЕЙСТВИЯ</h3>
        <div className="flex flex-wrap gap-3">
          <Link to="/admin/appointments" className="font-mono text-sm bg-orange text-primary-foreground px-4 py-2 hover:bg-orange-bright transition-colors">
            Заявки →
          </Link>
          <Link to="/admin/promotions" className="font-mono text-sm border-2 border-border px-4 py-2 hover:border-orange hover:text-orange transition-colors">
            Управление акциями
          </Link>
          <Link to="/admin/clients" className="font-mono text-sm border-2 border-border px-4 py-2 hover:border-orange hover:text-orange transition-colors">
            Рассылка клиентам
          </Link>
          <Link to="/admin/services" className="font-mono text-sm border-2 border-border px-4 py-2 hover:border-orange hover:text-orange transition-colors">
            Услуги
          </Link>
          <Link to="/admin/settings" className="font-mono text-sm border-2 border-border px-4 py-2 hover:border-orange hover:text-orange transition-colors">
            Настройки Telegram
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [counts, setCounts] = useState({ services: 0, portfolio: 0, appointments: 0, newAppointments: 0 });

  useEffect(() => {
    async function load() {
      const [svc, port, appt, newAppt] = await Promise.all([
        supabase.from("services").select("id", { count: "exact", head: true }),
        supabase.from("portfolio").select("id", { count: "exact", head: true }),
        supabase.from("appointments").select("id", { count: "exact", head: true }),
        supabase.from("appointments").select("id", { count: "exact", head: true }).eq("status", "new"),
      ]);
      setCounts({
        services: svc.count || 0,
        portfolio: port.count || 0,
        appointments: appt.count || 0,
        newAppointments: newAppt.count || 0,
      });
    }
    load();
  }, []);

  const cards = [
    { label: "Услуг", value: counts.services, icon: Wrench, href: "/admin/services", color: "text-orange" },
    { label: "Работ в портфолио", value: counts.portfolio, icon: Images, href: "/admin/portfolio", color: "text-orange" },
    { label: "Заявок всего", value: counts.appointments, icon: ClipboardList, href: "/admin/appointments", color: "text-orange" },
    { label: "Новых заявок", value: counts.newAppointments, icon: TrendingUp, href: "/admin/appointments", color: "text-orange" },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-4xl tracking-wider">ДАШБОРД</h1>
        <p className="font-mono text-sm text-muted-foreground mt-1">Сводная статистика сайта</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.label} to={card.href} className="bg-surface border-2 border-border p-6 hover:border-orange transition-colors group shadow-brutal-sm">
              <div className="flex items-center justify-between mb-4">
                <Icon className={`w-5 h-5 ${card.color}`} />
                <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">→</span>
              </div>
              <div className="font-display text-5xl text-orange mb-1">{card.value}</div>
              <div className="font-mono text-xs text-muted-foreground uppercase tracking-widest">{card.label}</div>
            </Link>
          );
        })}
      </div>

      <div className="bg-orange/10 border-2 border-orange/30 p-6">
        <h3 className="font-display text-2xl tracking-wider mb-2">БЫСТРЫЕ ДЕЙСТВИЯ</h3>
        <div className="flex flex-wrap gap-3">
          <Link to="/admin/appointments" className="font-mono text-sm bg-orange text-primary-foreground px-4 py-2 hover:bg-orange-bright transition-colors">
            Просмотреть заявки →
          </Link>
          <Link to="/admin/services" className="font-mono text-sm border-2 border-border px-4 py-2 hover:border-orange hover:text-orange transition-colors">
            Управление услугами
          </Link>
          <Link to="/admin/portfolio" className="font-mono text-sm border-2 border-border px-4 py-2 hover:border-orange hover:text-orange transition-colors">
            Добавить работу
          </Link>
          <Link to="/admin/settings" className="font-mono text-sm border-2 border-border px-4 py-2 hover:border-orange hover:text-orange transition-colors">
            Настройки Telegram
          </Link>
        </div>
      </div>
    </div>
  );
}
