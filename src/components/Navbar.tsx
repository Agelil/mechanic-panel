import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Главная" },
  { href: "/services", label: "Услуги" },
  { href: "/portfolio", label: "Наши работы" },
  { href: "/booking", label: "Записаться" },
  { href: "/cabinet", label: "Кабинет" },
];

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background border-b-2 border-border">
      <div className="container mx-auto flex items-center justify-between h-16 px-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 bg-orange flex items-center justify-center">
            <Wrench className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-display text-2xl tracking-widest">
            СЕРВИС<span className="text-orange">-</span>ТОЧКА
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-0">
          {navItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "px-4 py-2 font-mono text-sm font-medium uppercase tracking-wider border-r-2 border-border transition-all duration-150",
                "hover:text-orange hover:bg-muted",
                location.pathname === item.href
                  ? "text-orange bg-muted"
                  : "text-muted-foreground"
              )}
            >
              {item.label}
            </Link>
          ))}
          <Link
            to="/booking"
            className="ml-4 px-5 py-2 bg-orange text-primary-foreground font-mono text-sm font-bold uppercase tracking-wider hover:bg-orange-bright transition-colors shadow-brutal-sm"
          >
            Записаться →
          </Link>
        </div>

        {/* Mobile Toggle */}
        <button
          className="md:hidden p-2 text-foreground"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden bg-background border-t-2 border-border">
          {navItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => setIsOpen(false)}
              className={cn(
                "block px-6 py-3 font-mono text-sm uppercase tracking-wider border-b border-border",
                "hover:text-orange hover:bg-muted transition-colors",
                location.pathname === item.href ? "text-orange" : "text-muted-foreground"
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
