import { Phone, MapPin, Clock, Wrench, Mail, Send } from "lucide-react";
import { Link } from "react-router-dom";
import { useSiteSettings } from "@/hooks/use-site-settings";

export function Footer() {
  const { settings } = useSiteSettings();
  const year = new Date().getFullYear();

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
                {settings.site_name.toUpperCase().replace("-", "<span>-</span>")}
              </span>
            </div>
            <p className="font-mono text-sm text-muted-foreground leading-relaxed">
              Точка. И никаких вопросов.
            </p>
            <p className="font-mono text-xs text-muted-foreground mt-3 leading-relaxed">
              {settings.meta_description}
            </p>
            {/* Socials */}
            <div className="flex gap-3 mt-4">
              {settings.social_vk && (
                <a href={settings.social_vk} target="_blank" rel="noopener noreferrer"
                  className="font-mono text-xs text-muted-foreground hover:text-orange transition-colors border border-border px-2 py-1 hover:border-orange">
                  ВК
                </a>
              )}
              {settings.social_telegram_channel && (
                <a href={settings.social_telegram_channel} target="_blank" rel="noopener noreferrer"
                  className="font-mono text-xs text-muted-foreground hover:text-orange transition-colors border border-border px-2 py-1 hover:border-orange">
                  <Send className="w-3 h-3 inline mr-1" />TG
                </a>
              )}
              {settings.social_whatsapp && (
                <a href={`https://wa.me/${settings.social_whatsapp}`} target="_blank" rel="noopener noreferrer"
                  className="font-mono text-xs text-muted-foreground hover:text-orange transition-colors border border-border px-2 py-1 hover:border-orange">
                  WA
                </a>
              )}
            </div>
          </div>

          {/* Contacts */}
          <div>
            <h3 className="font-display text-lg tracking-widest text-orange mb-4">КОНТАКТЫ</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-orange flex-shrink-0" />
                <a href={`tel:${settings.site_phone.replace(/\D/g, "")}`}
                  className="font-mono text-sm hover:text-orange transition-colors">
                  {settings.site_phone}
                </a>
              </div>
              {settings.site_phone_2 && (
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-orange/50 flex-shrink-0" />
                  <a href={`tel:${settings.site_phone_2.replace(/\D/g, "")}`}
                    className="font-mono text-sm hover:text-orange transition-colors text-muted-foreground">
                    {settings.site_phone_2}
                  </a>
                </div>
              )}
              {settings.site_email && (
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-orange flex-shrink-0" />
                  <a href={`mailto:${settings.site_email}`}
                    className="font-mono text-sm hover:text-orange transition-colors">
                    {settings.site_email}
                  </a>
                </div>
              )}
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-orange flex-shrink-0 mt-0.5" />
                <span className="font-mono text-sm text-muted-foreground">
                  {settings.site_address}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-orange flex-shrink-0" />
                <span className="font-mono text-sm text-muted-foreground">
                  {settings.site_hours}
                  {settings.site_hours_sun && (
                    <><br />{settings.site_hours_sun}</>
                  )}
                </span>
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
                ...(settings.module_portfolio ? [{ href: "/portfolio", label: "Наши работы" }] : []),
                ...(settings.module_booking ? [{ href: "/booking", label: "Записаться" }] : []),
                ...(settings.module_cabinet ? [{ href: "/cabinet", label: "Кабинет" }] : []),
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
            © {year} {settings.site_name}. Все права защищены.
          </p>
          <Link to="/admin" className="font-mono text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors">
            Панель управления
          </Link>
        </div>
      </div>
    </footer>
  );
}
