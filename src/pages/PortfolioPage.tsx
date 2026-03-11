import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ChevronLeft, ChevronRight, Car, ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { BeforeAfterSlider } from "@/components/BeforeAfterSlider";
import { PortfolioLightbox } from "@/components/PortfolioLightbox";

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
  car_details: Record<string, string> | null;
  work_list: string[] | null;
  mileage: number | null;
  work_duration: string | null;
  parts_list: Array<{ name: string; qty?: number; price?: number }> | null;
  final_price: number | null;
}

const PLACEHOLDER_ITEMS: PortfolioItem[] = [
  {
    id: "1",
    title: "Ремонт подвески BMW 5 Series",
    description: "Полная замена передней подвески: амортизаторы, пружины, рычаги и сайлентблоки.",
    car_make: "BMW", car_model: "5 Series", car_year: 2018,
    image_before_url: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800&q=80",
    image_after_url: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&q=80",
    service_type: "Ходовая", is_published: true,
    car_details: null, work_list: ["Замена амортизаторов (2 шт.)", "Замена пружин (2 шт.)", "Замена рычагов", "Замена сайлентблоков"],
    mileage: 94000, work_duration: "1 день",
    parts_list: [{ name: "Амортизатор Bilstein", qty: 2, price: 8500 }, { name: "Пружина передняя", qty: 2, price: 3200 }],
    final_price: 24500,
  },
  {
    id: "2",
    title: "Кузовной ремонт Toyota Camry",
    description: "Рихтовка переднего бампера и левого крыла после небольшого ДТП.",
    car_make: "Toyota", car_model: "Camry", car_year: 2020,
    image_before_url: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
    image_after_url: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800&q=80",
    service_type: "Кузов", is_published: true,
    car_details: null, work_list: ["Рихтовка бампера", "Рихтовка крыла", "Покраска в цвет автомобиля"],
    mileage: 41000, work_duration: "3 дня",
    parts_list: [{ name: "Грунт", qty: 1, price: 1800 }, { name: "Лак", qty: 1, price: 2400 }],
    final_price: 18000,
  },
  {
    id: "3",
    title: "Замена ГРМ Mercedes E-Class",
    description: "Полная замена ремня ГРМ, всех роликов и помпы охлаждающей жидкости.",
    car_make: "Mercedes-Benz", car_model: "E-Class", car_year: 2016,
    image_before_url: "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800&q=80",
    image_after_url: "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=800&q=80",
    service_type: "Двигатель", is_published: true,
    car_details: null, work_list: ["Снятие защиты картера", "Замена ремня ГРМ", "Замена роликов (3 шт.)", "Замена помпы ОЖ", "Проверка фаз"],
    mileage: 128000, work_duration: "4 часа",
    parts_list: [{ name: "Ремень ГРМ Gates", qty: 1, price: 4200 }, { name: "Комплект роликов", qty: 1, price: 3800 }, { name: "Помпа", qty: 1, price: 5600 }],
    final_price: 21500,
  },
  {
    id: "4",
    title: "Диагностика и ремонт Audi A4",
    description: "Устранение неисправности системы ABS и тормозных суппортов.",
    car_make: "Audi", car_model: "A4", car_year: 2019,
    image_before_url: "https://images.unsplash.com/photo-1542362567-b07e54358753?w=800&q=80",
    image_after_url: "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?w=800&q=80",
    service_type: "Тормоза", is_published: true,
    car_details: null, work_list: ["Диагностика системы ABS", "Замена датчика ABS (ЛП)", "Прокачка суппортов", "Замена тормозных колодок"],
    mileage: 67000, work_duration: "2 часа",
    parts_list: [{ name: "Датчик ABS Bosch", qty: 1, price: 2100 }, { name: "Колодки TRW", qty: 1, price: 3400 }],
    final_price: 12800,
  },
];

export default function PortfolioPage() {
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<PortfolioItem | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchPortfolio() {
      const { data, error } = await supabase
        .from("portfolio")
        .select("*")
        .eq("is_published", true)
        .order("created_at", { ascending: false });
      if (!error && data?.length) {
        setItems(data as unknown as PortfolioItem[]);
      } else {
        setItems(PLACEHOLDER_ITEMS);
      }
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
            Реальные кейсы нашего автосервиса. Перетащите ползунок, чтобы сравнить до и после ремонта. Нажмите на карточку для подробностей.
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
                  {/* Image area — click opens lightbox */}
                  <div
                    className="relative"
                    onClick={() => setLightbox(item)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && setLightbox(item)}
                    aria-label={`Открыть фото ${item.title}`}
                  >
                    {item.image_before_url && item.image_after_url ? (
                      <div onClick={(e) => e.stopPropagation()}>
                        <BeforeAfterSlider
                          before={item.image_before_url}
                          after={item.image_after_url}
                          height="h-56"
                        />
                        {/* Overlay hint */}
                        <button
                          onClick={() => setLightbox(item)}
                          className="absolute bottom-2 right-2 bg-background/80 backdrop-blur-sm border border-border px-3 py-1 font-mono text-xs text-muted-foreground hover:border-orange hover:text-orange transition-colors z-20"
                        >
                          ⛶ полный экран
                        </button>
                      </div>
                    ) : item.image_after_url || item.image_before_url ? (
                      <img
                        src={item.image_after_url || item.image_before_url || ""}
                        alt={item.title}
                        className="w-full h-56 object-cover"
                      />
                    ) : (
                      <div className="w-full h-56 bg-muted flex items-center justify-center">
                        <Car className="w-12 h-12 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-6">
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
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
                      {item.mileage && (
                        <span className="font-mono text-xs text-muted-foreground">
                          {item.mileage.toLocaleString("ru-RU")} км
                        </span>
                      )}
                    </div>

                    <Link to={`/portfolio/${item.id}`} className="group/title block">
                      <h3 className="font-display text-2xl tracking-wider mb-2 group-hover/title:text-orange transition-colors">
                        {item.title}
                      </h3>
                    </Link>

                    {item.description && (
                      <p className="font-mono text-sm text-muted-foreground leading-relaxed line-clamp-2">{item.description}</p>
                    )}

                    <div className="flex items-center justify-between mt-4">
                      {item.final_price ? (
                        <span className="font-mono text-sm text-orange font-semibold">
                          от {item.final_price.toLocaleString("ru-RU")} ₽
                        </span>
                      ) : <span />}
                      <Link
                        to={`/portfolio/${item.id}`}
                        className="font-mono text-xs text-muted-foreground hover:text-orange transition-colors flex items-center gap-1"
                      >
                        Подробнее <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>
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

      {/* Lightbox */}
      {lightbox && (
        <PortfolioLightbox
          images={[]}
          before={lightbox.image_before_url}
          after={lightbox.image_after_url}
          title={lightbox.title}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
