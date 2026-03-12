import { useState, useEffect } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Wrench, Images, ClipboardList,
  Settings, LogOut, Menu, X, ChevronRight, Tag, Users, FolderOpen, UserCog, Star,
  ShieldCheck, ServerCog, ShoppingCart, UsersRound, WifiOff, BookOpen
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { supabase } from "@/integrations/supabase/client";

const allNavItems = [
  { href: "/admin",             label: "Дашборд",        icon: LayoutDashboard, exact: true, permission: "view_dashboard" },
  { href: "/admin/appointments",label: "Заявки",          icon: ClipboardList,               permission: "view_appointments" },
  { href: "/admin/supply",      label: "Снабжение",       icon: ShoppingCart,                permission: "view_appointments" },
  { href: "/admin/services",    label: "Услуги",           icon: Wrench,                      permission: "view_services" },
  { href: "/admin/categories",  label: "Категории",        icon: FolderOpen,                  permission: "view_categories" },
  { href: "/admin/portfolio",   label: "Портфолио",        icon: Images,                      permission: "view_portfolio" },
  { href: "/admin/promotions",  label: "Акции",            icon: Tag,                         permission: "view_promotions" },
  { href: "/admin/clients",     label: "Клиенты",          icon: Users,                       permission: "view_clients" },
  { href: "/admin/reviews",     label: "Отзывы",           icon: Star,                        permission: "view_promotions" },
  { href: "/admin/users",       label: "Сотрудники",       icon: UserCog,                     permission: "view_users" },
  { href: "/admin/groups",      label: "Группы и права",   icon: UsersRound,                  permission: "view_groups" },
  { href: "/admin/access",      label: "Доступ",           icon: ShieldCheck,                 permission: "view_users" },
  { href: "/admin/settings",    label: "Настройки",        icon: Settings,                    permission: "view_settings" },
  { href: "/admin/wiki",        label: "База знаний",      icon: BookOpen,                    permission: "view_dashboard" },
  { href: "/admin/system",      label: "Система",          icon: ServerCog,                   permission: "edit_settings" },
];

const ROLE_BADGE: Record<string, string> = {
  admin:   "АДМИНИСТРАТОР",
  manager: "МЕНЕДЖЕР",
  master:  "МАСТЕР",
};

function NavSkeleton() {
  return (
    <div className="flex-1 py-4 space-y-1 px-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="h-10 bg-sidebar-accent/40 animate-pulse rounded-sm"
          style={{ opacity: Math.max(0.2, 1 - i * 0.12) }}
        />
      ))}
    </div>
  );
}

/** Проверяет сессию и возвращает true если есть проблемы со связью */
function useConnectionStatus() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const check = async () => {
      const { error } = await supabase.auth.getSession();
      setOffline(!!error);
    };

    // Проверяем при потере сети
    const handleOffline = () => setOffline(true);
    const handleOnline = () => { setOffline(false); check(); };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online",  handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online",  handleOnline);
    };
  }, []);

  return offline;
}

export default function AdminLayout() {
  const location = useLocation();
  const { session, role, loading, hasPermission, isOwner, signOut, user, groupDisplayName } = useAuth();
  const isOffline = useConnectionStatus();

  useAuthGuard();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [position, setPosition] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("users_registry" as any)
      .select("position")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if ((data as any)?.position) setPosition((data as any).position);
      });
  }, [user?.id]);

  const isActive = (item: typeof allNavItems[0]) => {
    if (item.exact) return location.pathname === item.href;
    return location.pathname.startsWith(item.href);
  };

  // Глобальный спиннер пока Auth не инициализировался
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-orange border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="font-mono text-xs text-muted-foreground">Проверка доступа...</p>
        </div>
      </div>
    );
  }

  // Нет сессии — guard сделает редирект, не мигаем
  if (!session) return null;

  const navItems = allNavItems.filter((item) => {
    if (!role) return true;
    return hasPermission(item.permission);
  });

  return (
    <div className="min-h-screen flex bg-background">
      {/* ── Sidebar ── */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-sidebar border-r-2 border-sidebar-border flex flex-col transition-transform duration-200",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-4 border-b-2 border-sidebar-border">
          <div className="w-8 h-8 bg-orange flex items-center justify-center flex-shrink-0">
            <Wrench className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <p className="font-display text-sm tracking-widest">
              СЕРВИС<span className="text-orange">-</span>ТОЧКА
            </p>
            <p className="font-mono text-xs text-muted-foreground">
              {position === "Мастер" ? "Панель мастера"
                : position === "Менеджер" ? "Панель менеджера"
                : position === "Снабженец" ? "Панель снабжения"
                : "Admin Panel"}
            </p>
          </div>
        </div>

        {/* Nav */}
        {!role ? (
          <NavSkeleton />
        ) : (
          <nav className="flex-1 py-4 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item);
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-6 py-3 font-mono text-sm transition-all",
                    "hover:bg-sidebar-accent hover:text-sidebar-foreground",
                    active
                      ? "bg-sidebar-accent text-orange border-r-2 border-orange"
                      : "text-sidebar-foreground/70"
                  )}
                >
                  <Icon className={cn("w-4 h-4", active ? "text-orange" : "")} />
                  {item.label}
                  {active && <ChevronRight className="w-3 h-3 ml-auto text-orange" />}
                </Link>
              );
            })}
          </nav>
        )}

        {/* Footer */}
        <div className="border-t-2 border-sidebar-border p-4">
          <p className="font-mono text-xs text-muted-foreground mb-1 truncate">
            {session.user.email}
          </p>
          {(groupDisplayName || role) && (
            <p className="font-mono text-xs text-orange mb-3">
              {groupDisplayName || (role && ROLE_BADGE[role]) || ""}
            </p>
          )}
          <div className="flex gap-2">
            <Link
              to="/"
              target="_blank"
              className="flex-1 font-mono text-xs text-center border border-sidebar-border py-2 hover:border-orange hover:text-orange transition-colors"
            >
              ↗ Сайт
            </Link>
            <button
              onClick={() => signOut()}
              className="flex-1 flex items-center justify-center gap-1 font-mono text-xs border border-sidebar-border py-2 hover:border-destructive hover:text-destructive transition-colors"
            >
              <LogOut className="w-3 h-3" />
              Выйти
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Main ── */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-background border-b-2 border-border h-14 flex items-center px-4 gap-4">
          <button
            className="lg:hidden text-muted-foreground hover:text-foreground"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="font-mono text-xs text-muted-foreground">
            {navItems.find(isActive)?.label || "Admin"}
          </div>

          <div className="ml-auto flex items-center gap-3">
            {/* Индикатор потери связи */}
            {isOffline && (
              <div className="flex items-center gap-1.5 border border-destructive/30 bg-destructive/10 px-2 py-1">
                <WifiOff className="w-3 h-3 text-destructive" />
                <span className="font-mono text-xs text-destructive">Нет связи</span>
              </div>
            )}
            {role && (
              <span className="font-mono text-xs text-orange border border-orange/30 px-2 py-0.5">
                {ROLE_BADGE[role]}
              </span>
            )}
          </div>
        </header>

        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
