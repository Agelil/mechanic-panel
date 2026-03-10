import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatPriceRange } from "@/lib/utils";
import { Wrench, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

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

const FALLBACK_SERVICES: Service[] = [
  { id: "1", name: "Диагностика двигателя", description: "Компьютерная диагностика всех систем автомобиля. Расшифровка кодов ошибок.", price_from: 800, price_to: 1500, category: "Диагностика", is_active: true, sort_order: 1 },
  { id: "2", name: "Замена масла и фильтра", description: "Замена моторного масла и масляного фильтра. Рекомендуется каждые 10 000 км.", price_from: 1200, price_to: 3500, category: "ТО", is_active: true, sort_order: 2 },
  { id: "3", name: "Ремонт тормозной системы", description: "Замена колодок, дисков, суппортов. Прокачка тормозов.", price_from: 2000, price_to: 8000, category: "Тормоза", is_active: true, sort_order: 3 },
  { id: "4", name: "Замена ремня ГРМ", description: "Полная замена ремня или цепи ГРМ с роликами и помпой.", price_from: 5000, price_to: 15000, category: "Двигатель", is_active: true, sort_order: 4 },
  { id: "5", name: "Ремонт подвески", description: "Замена стоек, амортизаторов, рычагов, шаровых опор и сайлентблоков.", price_from: 2500, price_to: 12000, category: "Ходовая", is_active: true, sort_order: 5 },
  { id: "6", name: "Шиномонтаж и балансировка", description: "Сезонная замена шин, балансировка колёс, правка дисков.", price_from: 1500, price_to: 3000, category: "Шиномонтаж", is_active: true, sort_order: 6 },
  { id: "7", name: "Ремонт электрики", description: "Поиск и устранение неисправностей в электрической цепи автомобиля.", price_from: 1000, price_to: 10000, category: "Электрика", is_active: true, sort_order: 7 },
  { id: "8", name: "Кузовные работы", description: "Рихтовка, сварочные работы, антикоррозийная обработка.", price_from: 3000, price_to: 50000, category: "Кузов", is_active: true, sort_order: 8 },
];

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("Все");

  useEffect(() => {
    async function fetchServices() {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      setServices(error || !data?.length ? FALLBACK_SERVICES : data);
      setLoading(false);
    }
    fetchServices();
  }, []);

  const categories = ["Все", ...Array.from(new Set(services.map((s) => s.category).filter(Boolean)))];
  const filtered = activeCategory === "Все" ? services : services.filter((s) => s.category === activeCategory);

  return (
    <div className="min-h-screen pt-16">
      {/* Header */}
      <section className="relative bg-surface border-b-2 border-border py-16 bg-grid">
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-orange" />
        <div className="container mx-auto px-4">
          <span className="font-mono text-xs text-orange uppercase tracking-widest">// Прайс-лист 2024</span>
          <h1 className="font-display text-6xl md:text-8xl tracking-wider mt-2">
            НАШИ <span className="text-orange">УСЛУГИ</span>
          </h1>
          <p className="font-mono text-sm text-muted-foreground mt-4 max-w-xl">
            Актуальные цены на ремонт и обслуживание автомобилей в Санкт-Петербурге. Финальная стоимость определяется после диагностики.
          </p>
        </div>
      </section>

      {/* Filter */}
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

      {/* Services Grid */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 text-orange animate-spin" />
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
                        <Link
                          to="/booking"
                          className="font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-orange transition-colors border border-border px-3 py-1.5 hover:border-orange"
                        >
                          Записаться →
                        </Link>
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
              <span className="text-orange font-bold">Внимание:</span> Указанные цены являются ориентировочными для Санкт-Петербурга. Точная стоимость рассчитывается индивидуально после диагностики автомобиля. Все работы сопровождаются гарантией.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
