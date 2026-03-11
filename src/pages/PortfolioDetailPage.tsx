import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, ArrowLeft, Car, Clock, Gauge, Wrench,
  Package, ChevronRight, Star, CheckCircle2
} from "lucide-react";
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

// Fallback data for demo IDs
const PLACEHOLDER: Record<string, PortfolioItem> = {
  "1": {
    id: "1", title: "Ремонт подвески BMW 5 Series",
    description: "Полная замена передней подвески: амортизаторы, пружины, рычаги и сайлентблоки. Клиент жаловался на стук при проезде неровностей и увод автомобиля вправо.",
    car_make: "BMW", car_model: "5 Series", car_year: 2018,
    image_before_url: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1200&q=80",
    image_after_url: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1200&q=80",
    service_type: "Ходовая", is_published: true,
    car_details: { "Двигатель": "3.0 B58 M Sport", "КПП": "Автомат 8AT", "Цвет": "Carbon Black Metallic" },
    work_list: [
      "Компьютерная диагностика подвески",
      "Замена передних амортизаторов (2 шт.)",
      "Замена передних пружин (2 шт.)",
      "Замена передних нижних рычагов",
      "Замена сайлентблоков передних рычагов (4 шт.)",
      "Регулировка сходимости и развала",
      "Тест-драйв после ремонта",
    ],
    mileage: 94000, work_duration: "1 рабочий день",
    parts_list: [
      { name: "Амортизатор Bilstein B4 (пер. лев.)", qty: 1, price: 8500 },
      { name: "Амортизатор Bilstein B4 (пер. прав.)", qty: 1, price: 8500 },
      { name: "Пружина передняя левая", qty: 1, price: 3200 },
      { name: "Пружина передняя правая", qty: 1, price: 3200 },
      { name: "Сайлентблок рычага (к-т)", qty: 1, price: 2800 },
    ],
    final_price: 34200,
  },
  "2": {
    id: "2", title: "Кузовной ремонт Toyota Camry",
    description: "Рихтовка переднего бампера и левого крыла после небольшого ДТП. Локальная покраска в цвет автомобиля с полировкой.",
    car_make: "Toyota", car_model: "Camry", car_year: 2020,
    image_before_url: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80",
    image_after_url: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=1200&q=80",
    service_type: "Кузов", is_published: true,
    car_details: { "Двигатель": "2.5 2AR-FE", "КПП": "Автомат 6AT", "Цвет": "Серебристый металлик 1F7" },
    work_list: ["Рихтовка переднего бампера", "Рихтовка левого переднего крыла", "Шпаклевание и шлифование", "Грунтование", "Покраска в цвет автомобиля", "Лакирование", "Полировка стыков"],
    mileage: 41000, work_duration: "3 рабочих дня",
    parts_list: [{ name: "Грунт 2K HS", qty: 1, price: 1800 }, { name: "Краска (подбор)", qty: 1, price: 2200 }, { name: "Лак 2K HS", qty: 1, price: 2400 }],
    final_price: 18000,
  },
};

export default function PortfolioDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [item, setItem] = useState<PortfolioItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    async function fetchItem() {
      if (!id) return;

      // Try DB first
      const { data, error } = await supabase
        .from("portfolio")
        .select("*")
        .eq("id", id)
        .eq("is_published", true)
        .single();

      if (!error && data) {
        setItem(data as unknown as PortfolioItem);
      } else if (PLACEHOLDER[id]) {
        setItem(PLACEHOLDER[id]);
      } else {
        navigate("/portfolio", { replace: true });
      }
      setLoading(false);
    }
    fetchItem();
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange animate-spin" />
      </div>
    );
  }

  if (!item) return null;

  const partsTotal = item.parts_list?.reduce((sum, p) => sum + (p.price ?? 0) * (p.qty ?? 1), 0) ?? 0;
  const workCost = item.final_price ? item.final_price - partsTotal : null;

  return (
    <>
      {/* SEO meta — injected via Helmet if available, else raw title */}
      {(() => {
        document.title = `${item.title} — ${item.car_make} ${item.car_model} | Автосервис`;
        const desc = document.querySelector('meta[name="description"]');
        if (desc) desc.setAttribute("content", item.description ?? item.title);
        return null;
      })()}

      <div className="min-h-screen pt-16">
        {/* Breadcrumb */}
        <div className="bg-surface border-b border-border">
          <div className="container mx-auto px-4 py-3 flex items-center gap-2 font-mono text-xs text-muted-foreground">
            <Link to="/" className="hover:text-orange transition-colors">Главная</Link>
            <ChevronRight className="w-3 h-3" />
            <Link to="/portfolio" className="hover:text-orange transition-colors">Наши работы</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground truncate">{item.title}</span>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8 max-w-5xl">
          {/* Back */}
          <Link
            to="/portfolio"
            className="inline-flex items-center gap-2 font-mono text-sm text-muted-foreground hover:text-orange transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" /> Все работы
          </Link>

          {/* Title */}
          <div className="mb-6">
            {item.service_type && (
              <span className="font-mono text-xs text-orange border border-orange/30 px-2 py-0.5 uppercase tracking-wider mr-3">
                {item.service_type}
              </span>
            )}
            <h1 className="font-display text-4xl md:text-6xl tracking-wider mt-3">{item.title}</h1>
          </div>

          {/* Hero: Before/After Slider */}
          <div className="relative mb-8 border-2 border-border shadow-brutal-lg cursor-zoom-in group">
            {item.image_before_url && item.image_after_url ? (
              <div onClick={(e) => e.stopPropagation()}>
                <BeforeAfterSlider
                  before={item.image_before_url}
                  after={item.image_after_url}
                  height="h-[50vh] md:h-[60vh]"
                />
              </div>
            ) : (
              <img
                src={item.image_after_url || item.image_before_url || ""}
                alt={item.title}
                className="w-full h-[50vh] object-cover"
              />
            )}
            <button
              onClick={() => setLightboxOpen(true)}
              className="absolute bottom-3 right-3 bg-background/80 backdrop-blur-sm border border-border px-3 py-1.5 font-mono text-xs hover:border-orange hover:text-orange transition-colors z-20"
            >
              ⛶ Открыть на весь экран
            </button>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border mb-8">
            {[
              { icon: Car, label: "Автомобиль", value: `${item.car_make ?? ""} ${item.car_model ?? ""}` },
              { icon: Star, label: "Год выпуска", value: item.car_year ? String(item.car_year) : "—" },
              { icon: Gauge, label: "Пробег", value: item.mileage ? `${item.mileage.toLocaleString("ru-RU")} км` : "—" },
              { icon: Clock, label: "Время работы", value: item.work_duration ?? "—" },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="bg-surface p-4 flex flex-col gap-1">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Icon className="w-4 h-4 text-orange" />
                  <span className="font-mono text-xs uppercase tracking-widest">{label}</span>
                </div>
                <span className="font-display text-lg tracking-wider">{value}</span>
              </div>
            ))}
          </div>

          {/* Car extra details */}
          {item.car_details && Object.keys(item.car_details).length > 0 && (
            <div className="bg-surface border-2 border-border p-5 mb-8">
              <h2 className="font-mono text-xs text-orange uppercase tracking-widest mb-4">// Характеристики автомобиля</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(item.car_details).map(([k, v]) => (
                  <div key={k}>
                    <div className="font-mono text-xs text-muted-foreground">{k}</div>
                    <div className="font-mono text-sm">{v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Description */}
            {item.description && (
              <div className="bg-surface border-2 border-border p-5">
                <h2 className="font-mono text-xs text-orange uppercase tracking-widest mb-4">// Описание</h2>
                <p className="font-mono text-sm text-muted-foreground leading-relaxed">{item.description}</p>
              </div>
            )}

            {/* Work list */}
            {item.work_list && item.work_list.length > 0 && (
              <div className="bg-surface border-2 border-border p-5">
                <h2 className="font-mono text-xs text-orange uppercase tracking-widest mb-4">
                  <Wrench className="inline w-3.5 h-3.5 mr-1 text-orange" />
                  // Выполненные работы
                </h2>
                <ul className="space-y-2">
                  {item.work_list.map((work, i) => (
                    <li key={i} className="flex items-start gap-2 font-mono text-sm">
                      <CheckCircle2 className="w-4 h-4 text-orange flex-shrink-0 mt-0.5" />
                      <span>{work}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Parts list */}
          {item.parts_list && item.parts_list.length > 0 && (
            <div className="bg-surface border-2 border-border p-5 mb-8">
              <h2 className="font-mono text-xs text-orange uppercase tracking-widest mb-4">
                <Package className="inline w-3.5 h-3.5 mr-1 text-orange" />
                // Использованные запчасти
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full font-mono text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left text-muted-foreground text-xs uppercase tracking-widest py-2 pr-4">Наименование</th>
                      <th className="text-center text-muted-foreground text-xs uppercase tracking-widest py-2 pr-4">Кол-во</th>
                      <th className="text-right text-muted-foreground text-xs uppercase tracking-widest py-2">Цена</th>
                    </tr>
                  </thead>
                  <tbody>
                    {item.parts_list.map((part, i) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-2 pr-4">{part.name}</td>
                        <td className="text-center py-2 pr-4 text-muted-foreground">{part.qty ?? 1} шт.</td>
                        <td className="text-right py-2">
                          {part.price ? `${((part.price) * (part.qty ?? 1)).toLocaleString("ru-RU")} ₽` : "—"}
                        </td>
                      </tr>
                    ))}
                    {partsTotal > 0 && (
                      <tr>
                        <td colSpan={2} className="text-right py-2 pr-4 text-muted-foreground font-mono text-xs">Запчасти итого:</td>
                        <td className="text-right py-2 font-semibold">{partsTotal.toLocaleString("ru-RU")} ₽</td>
                      </tr>
                    )}
                    {workCost !== null && workCost > 0 && (
                      <tr>
                        <td colSpan={2} className="text-right py-2 pr-4 text-muted-foreground font-mono text-xs">Работа:</td>
                        <td className="text-right py-2 font-semibold">{workCost.toLocaleString("ru-RU")} ₽</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {item.final_price && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t-2 border-border">
                  <span className="font-mono text-sm text-muted-foreground uppercase tracking-widest">Итоговая стоимость</span>
                  <span className="font-display text-3xl tracking-wider text-orange">
                    {item.final_price.toLocaleString("ru-RU")} ₽
                  </span>
                </div>
              )}
            </div>
          )}

          {/* CTA */}
          <div className="bg-orange p-8 md:p-10 text-center shadow-brutal-lg">
            <p className="font-mono text-sm text-primary-foreground/80 mb-2 uppercase tracking-widest">Хотите такой же результат?</p>
            <h2 className="font-display text-3xl md:text-4xl tracking-wider text-primary-foreground mb-6">
              ХОЧУ ТАК ЖЕ
            </h2>
            <Link
              to={`/booking${item.service_type ? `?service=${encodeURIComponent(item.service_type)}` : ""}`}
              className="inline-flex items-center gap-2 bg-primary-foreground text-primary px-8 py-4 font-display text-lg tracking-widest hover:bg-primary-foreground/90 transition-colors shadow-brutal"
            >
              Записаться на {item.service_type ?? "ремонт"} →
            </Link>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <PortfolioLightbox
          images={[]}
          before={item.image_before_url}
          after={item.image_after_url}
          title={item.title}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  );
}
