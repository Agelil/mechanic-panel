import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Wrench, Images, ClipboardList,
  Settings, LogOut, Menu, X, ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin", label: "Дашборд", icon: LayoutDashboard, exact: true },
  { href: "/admin/services", label: "Услуги", icon: Wrench },
  { href: "/admin/portfolio", label: "Портфолио", icon: Images },
  { href: "/admin/appointments", label: "Заявки", icon: ClipboardList },
  { href: "/admin/settings", label: "Настройки", icon: Settings },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    supabase.auth.onAuthStateChange((event, session) => {
      if (!session) navigate("/admin/login");
      else setUserEmail(session.user.email || "");
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate("/admin/login");
      else setUserEmail(session?.user?.email || "");
      setLoading(false);
    });
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-orange border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isActive = (item: typeof navItems[0]) => {
    if (item.exact) return location.pathname === item.href;
    return location.pathname.startsWith(item.href);
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
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
            <p className="font-display text-sm tracking-widest">СЕРВИС<span className="text-orange">-</span>ТОЧКА</p>
            <p className="font-mono text-xs text-muted-foreground">Admin Panel</p>
          </div>
        </div>

        {/* Nav */}
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

        {/* Footer */}
        <div className="border-t-2 border-sidebar-border p-4">
          <p className="font-mono text-xs text-muted-foreground mb-3 truncate">{userEmail}</p>
          <div className="flex gap-2">
            <Link
              to="/"
              target="_blank"
              className="flex-1 font-mono text-xs text-center border border-sidebar-border py-2 hover:border-orange hover:text-orange transition-colors"
            >
              ↗ Сайт
            </Link>
            <button
              onClick={handleLogout}
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
        <div className="fixed inset-0 z-40 bg-background/80 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main */}
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
        </header>

        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
