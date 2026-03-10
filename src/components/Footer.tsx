import { Phone, MapPin, Clock, Wrench } from "lucide-react";
import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="bg-surface border-t-2 border-border mt-auto">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-orange flex items-center justify-center">
                <Wrench className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-display text-2xl tracking-widest">
                СЕРВИС<span className="text-orange">-</span>ТОЧКА
              </span>
            </div>
            <p className="font-mono text-sm text-muted-foreground leading-relaxed">
              Точка. И никаких вопросов.
            </p>
            <p className="font-mono text-xs text-muted-foreground mt-3 leading-relaxed">
              Профессиональный автосервис в Санкт-Петербурге. Прозрачные цены, современное оборудование, быстрый результат.
            </p>
          </div>

          {/* Contacts */}
          <div>
            <h3 className="font-display text-lg tracking-widest text-orange mb-4">КОНТАКТЫ</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-orange flex-shrink-0" />
                <a href="tel:+78121234567" className="font-mono text-sm hover:text-orange transition-colors">
                  +7 (812) 123-45-67
                </a>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-orange flex-shrink-0 mt-0.5" />
                <span className="font-mono text-sm text-muted-foreground">
                  Санкт-Петербург,<br />ул. Примерная, 42
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-orange flex-shrink-0" />
                <span className="font-mono text-sm text-muted-foreground">Пн–Сб: 9:00–20:00</span>
              </div>
            </div>
          </div>

          {/* Nav */}
          <div>
            <h3 className="font-display text-lg tracking-widest text-orange mb-4">НАВИГАЦИЯ</h3>
            <div className="space-y-2">
              {[
                { href: "/", label: "Главная" },
                { href: "/services", label: "Услуги" },
                { href: "/portfolio", label: "Наши работы" },
                { href: "/booking", label: "Записаться" },
              ].map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className="block font-mono text-sm text-muted-foreground hover:text-orange transition-colors"
                >
                  → {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border flex flex-col md:flex-row justify-between items-center gap-3">
          <p className="font-mono text-xs text-muted-foreground">
            © 2024 Сервис-Точка. Все права защищены.
          </p>
          <Link to="/admin" className="font-mono text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors">
            Панель управления
          </Link>
        </div>
      </div>
    </footer>
  );
}
