import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatPriceRange } from "@/lib/utils";
import { Wrench, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useSiteSettings } from "@/hooks/use-site-settings";

interface Service {
  id: string;
  name: string;
  description: string | null;
  price_from: number;
  price_to: number | null;
  category: string | null;
  is_active: boolean;
  sort_order: number;
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("Все");
  const { settings } = useSiteSettings();

  useEffect(() => {
    async function fetchServices() {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (!error && data?.length) {
        setServices(data);
      }
      setLoading(false);
    }
    fetchServices();
  }, []);

  const categories = ["Все", ...Array.from(new Set(services.map((s) => s.category).filter(Boolean))) as string[]];
  const filtered = activeCategory === "Все" ? services : services.filter((s) => s.category === activeCategory);

  return (
    <div className="min-h-screen pt-16">
      {/* Header */}
      <section className="relative bg-surface border-b-2 border-border py-16 bg-grid">
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-orange" />
        <div className="container mx-auto px-4">
          <span className="font-mono text-xs text-orange uppercase tracking-widest">// Прайс-лист</span>
          <h1 className="font-display text-6xl md:text-8xl tracking-wider mt-2">
            НАШИ <span className="text-orange">УСЛУГИ</span>
          </h1>
          <p className="font-mono text-sm text-muted-foreground mt-4 max-w-xl">
            Актуальные цены на ремонт и обслуживание автомобилей. Финальная стоимость определяется после диагностики.
          </p>
        </div>
      </section>

      {/* Filter */}
      {categories.length > 1 && (
        <section className="bg-background border-b-2 border-border sticky top-16 z-30">
          <div className="container mx-auto px-4">
            <div className="flex gap-0 overflow-x-auto">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-5 py-3 font-mono text-xs uppercase tracking-widest border-r border-border whitespace-nowrap transition-colors ${
                    activeCategory === cat
                      ? "bg-orange text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Services Grid */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 text-orange animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <Wrench className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="font-mono text-sm text-muted-foreground">Услуги ещё не добавлены</p>
              <p className="font-mono text-xs text-muted-foreground/60 mt-1">Добавьте услуги в панели администратора</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border">
              {filtered.map((service, i) => (
                <div key={service.id} className="bg-background p-8 group hover:bg-surface transition-colors relative">
                  <div className="absolute top-4 right-4 font-mono text-xs text-muted-foreground/40">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  {service.category && (
                    <span className="inline-block font-mono text-xs text-orange uppercase tracking-wider border border-orange/30 px-2 py-0.5 mb-4">
                      {service.category}
                    </span>
                  )}
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-orange/10 flex items-center justify-center flex-shrink-0 mt-1">
                      <Wrench className="w-5 h-5 text-orange" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-display text-2xl tracking-wider mb-2">{service.name}</h3>
                      {service.description && (
                        <p className="font-mono text-sm text-muted-foreground leading-relaxed mb-4">
                          {service.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="font-display text-xl text-orange tracking-wide">
                          {formatPriceRange(service.price_from, service.price_to)}
                        </span>
                        {settings.module_booking && (
                          <Link
                            to="/booking"
                            className="font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-orange transition-colors border border-border px-3 py-1.5 hover:border-orange"
                          >
                            Записаться →
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Note */}
      <section className="pb-16">
        <div className="container mx-auto px-4">
          <div className="bg-surface border-2 border-orange/20 p-6 max-w-2xl">
            <p className="font-mono text-xs text-muted-foreground leading-relaxed">
              <span className="text-orange font-bold">Внимание:</span> Указанные цены являются ориентировочными. Точная стоимость рассчитывается индивидуально после диагностики автомобиля. Все работы сопровождаются гарантией.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
