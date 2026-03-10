import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ChevronLeft, ChevronRight, Car } from "lucide-react";
import { Link } from "react-router-dom";

interface PortfolioItem {
  id: string;
  title: string;
  description: string | null;
  car_make: string | null;
  car_model: string | null;
  car_year: number | null;
  image_before_url: string | null;
  image_after_url: string | null;
  service_type: string | null;
  is_published: boolean;
}

function BeforeAfterSlider({ before, after }: { before: string; after: string }) {
  const [position, setPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handleMove = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    setPosition(pos);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-48 overflow-hidden cursor-ew-resize select-none"
      onMouseMove={(e) => isDragging.current && handleMove(e.clientX)}
      onMouseDown={() => { isDragging.current = true; }}
      onMouseUp={() => { isDragging.current = false; }}
      onMouseLeave={() => { isDragging.current = false; }}
      onTouchMove={(e) => handleMove(e.touches[0].clientX)}
    >
      {/* After (base) */}
      <img src={after} alt="После" className="absolute inset-0 w-full h-full object-cover" />

      {/* Before (clipped) */}
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${position}%` }}>
        <img src={before} alt="До" className="w-full h-full object-cover" style={{ width: `${containerRef.current?.offsetWidth || 400}px` }} />
      </div>

      {/* Divider */}
      <div className="absolute top-0 bottom-0 w-0.5 bg-orange" style={{ left: `${position}%` }}>
        <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-orange flex items-center justify-center">
          <ChevronLeft className="w-3 h-3 text-primary-foreground" />
          <ChevronRight className="w-3 h-3 text-primary-foreground" />
        </div>
      </div>

      {/* Labels */}
      <span className="absolute top-2 left-2 font-mono text-xs bg-background/80 px-2 py-0.5">ДО</span>
      <span className="absolute top-2 right-2 font-mono text-xs bg-orange text-primary-foreground px-2 py-0.5">ПОСЛЕ</span>
    </div>
  );
}

const PLACEHOLDER_ITEMS: PortfolioItem[] = [
  {
    id: "1",
    title: "Ремонт подвески BMW 5 Series",
    description: "Полная замена передней подвески: амортизаторы, пружины, рычаги и сайлентблоки.",
    car_make: "BMW",
    car_model: "5 Series",
    car_year: 2018,
    image_before_url: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=600&q=80",
    image_after_url: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=600&q=80",
    service_type: "Ходовая",
    is_published: true,
  },
  {
    id: "2",
    title: "Кузовной ремонт Toyota Camry",
    description: "Рихтовка переднего бампера и левого крыла после небольшого ДТП.",
    car_make: "Toyota",
    car_model: "Camry",
    car_year: 2020,
    image_before_url: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80",
    image_after_url: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=600&q=80",
    service_type: "Кузов",
    is_published: true,
  },
  {
    id: "3",
    title: "Замена ГРМ Mercedes E-Class",
    description: "Полная замена ремня ГРМ, всех роликов и помпы охлаждающей жидкости.",
    car_make: "Mercedes-Benz",
    car_model: "E-Class",
    car_year: 2016,
    image_before_url: "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=600&q=80",
    image_after_url: "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=600&q=80",
    service_type: "Двигатель",
    is_published: true,
  },
  {
    id: "4",
    title: "Диагностика и ремонт Audi A4",
    description: "Устранение неисправности системы ABS и тормозных суппортов.",
    car_make: "Audi",
    car_model: "A4",
    car_year: 2019,
    image_before_url: "https://images.unsplash.com/photo-1542362567-b07e54358753?w=600&q=80",
    image_after_url: "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?w=600&q=80",
    service_type: "Тормоза",
    is_published: true,
  },
];

export default function PortfolioPage() {
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPortfolio() {
      const { data, error } = await supabase
        .from("portfolio")
        .select("*")
        .eq("is_published", true)
        .order("created_at", { ascending: false });
      setItems(error || !data?.length ? PLACEHOLDER_ITEMS : data);
      setLoading(false);
    }
    fetchPortfolio();
  }, []);

  return (
    <div className="min-h-screen pt-16">
      {/* Header */}
      <section className="relative bg-surface border-b-2 border-border py-16 bg-grid">
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-orange" />
        <div className="container mx-auto px-4">
          <span className="font-mono text-xs text-orange uppercase tracking-widest">// Галерея работ</span>
          <h1 className="font-display text-6xl md:text-8xl tracking-wider mt-2">
            НАШИ <span className="text-orange">РАБОТЫ</span>
          </h1>
          <p className="font-mono text-sm text-muted-foreground mt-4 max-w-xl">
            Реальные кейсы нашего автосервиса. Перетяните ползунок, чтобы сравнить результат до и после ремонта.
          </p>
        </div>
      </section>

      {/* Grid */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 text-orange animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border">
              {items.map((item) => (
                <div key={item.id} className="bg-background hover:bg-surface transition-colors group">
                  {/* Image slider or placeholder */}
                  {item.image_before_url && item.image_after_url ? (
                    <BeforeAfterSlider before={item.image_before_url} after={item.image_after_url} />
                  ) : item.image_after_url || item.image_before_url ? (
                    <img
                      src={item.image_after_url || item.image_before_url || ""}
                      alt={item.title}
                      className="w-full h-48 object-cover"
                    />
                  ) : (
                    <div className="w-full h-48 bg-muted flex items-center justify-center">
                      <Car className="w-12 h-12 text-muted-foreground/30" />
                    </div>
                  )}

                  {/* Info */}
                  <div className="p-6">
                    <div className="flex items-center gap-3 mb-3">
                      {item.service_type && (
                        <span className="font-mono text-xs text-orange border border-orange/30 px-2 py-0.5 uppercase tracking-wider">
                          {item.service_type}
                        </span>
                      )}
                      {item.car_make && (
                        <span className="font-mono text-xs text-muted-foreground">
                          {item.car_make} {item.car_model} {item.car_year}
                        </span>
                      )}
                    </div>
                    <h3 className="font-display text-2xl tracking-wider mb-2">{item.title}</h3>
                    {item.description && (
                      <p className="font-mono text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="pb-16">
        <div className="container mx-auto px-4">
          <div className="bg-orange p-8 md:p-12 text-center shadow-brutal-lg">
            <h2 className="font-display text-4xl md:text-5xl tracking-wider text-primary-foreground mb-4">
              ДОВЕРЬТЕ НАМ СВОЙ АВТОМОБИЛЬ
            </h2>
            <Link
              to="/booking"
              className="inline-flex items-center gap-2 bg-primary-foreground text-primary px-8 py-4 font-display text-xl tracking-widest hover:bg-primary-foreground/90 transition-colors shadow-brutal"
            >
              Записаться на ремонт →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
