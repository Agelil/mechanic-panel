import { Link } from "react-router-dom";
import { ArrowRight, Shield, Zap, Eye, CheckCircle2, Phone } from "lucide-react";

const stats = [
  { value: "12+", label: "лет на рынке" },
  { value: "3 800+", label: "выполненных работ" },
  { value: "98%", label: "довольных клиентов" },
  { value: "24ч", label: "срочный ремонт" },
];

const features = [
  {
    icon: Shield,
    title: "Гарантия на все работы",
    desc: "Предоставляем письменную гарантию на каждый выполненный ремонт",
  },
  {
    icon: Eye,
    title: "Прозрачные цены",
    desc: "Стоимость работ согласовывается до начала ремонта, без скрытых доплат",
  },
  {
    icon: Zap,
    title: "Быстро и точно",
    desc: "Диагностика за 30 минут, большинство работ выполняется в день обращения",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* HERO */}
      <section className="relative min-h-screen flex items-center bg-grid overflow-hidden pt-16">
        {/* Orange accent bar */}
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-orange" />

        <div className="container mx-auto px-4 py-20">
          <div className="max-w-4xl">
            {/* Label */}
            <div className="inline-flex items-center gap-2 bg-orange/10 border border-orange/30 px-3 py-1 mb-8">
              <span className="w-2 h-2 bg-orange rounded-full animate-pulse" />
              <span className="font-mono text-xs text-orange uppercase tracking-widest">
                Автосервис · Санкт-Петербург
              </span>
            </div>

            {/* Headline */}
            <h1 className="font-display text-[clamp(4rem,12vw,9rem)] leading-none tracking-wider mb-6">
              СЕРВИС
              <br />
              <span className="text-orange">ТОЧКА</span>
            </h1>

            {/* Slogan */}
            <div className="flex items-center gap-4 mb-10">
              <div className="h-0.5 w-12 bg-orange" />
              <p className="font-mono text-lg md:text-xl text-muted-foreground tracking-wide">
                Точка. И никаких вопросов.
              </p>
            </div>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                to="/booking"
                className="inline-flex items-center justify-center gap-3 bg-orange text-primary-foreground px-8 py-4 font-display text-xl tracking-widest hover:bg-orange-bright transition-colors shadow-brutal-lg group"
              >
                Записаться на сервис
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a
                href="tel:+78121234567"
                className="inline-flex items-center justify-center gap-3 bg-transparent border-2 border-foreground text-foreground px-8 py-4 font-display text-xl tracking-widest hover:border-orange hover:text-orange transition-colors"
              >
                <Phone className="w-5 h-5" />
                +7 (812) 123-45-67
              </a>
            </div>
          </div>
        </div>

        {/* Decorative */}
        <div className="absolute right-0 top-0 bottom-0 hidden lg:flex items-center pr-16">
          <div className="relative">
            <div className="w-64 h-64 border-2 border-orange/20 absolute -top-4 -left-4" />
            <div className="w-64 h-64 border-2 border-orange/10 absolute -top-8 -left-8" />
            <div className="w-64 h-64 bg-surface border-2 border-border flex items-center justify-center">
              <div className="text-center">
                <span className="font-display text-7xl text-orange">SP</span>
                <p className="font-mono text-xs text-muted-foreground mt-2 tracking-widest">СЕРВИС-ТОЧКА</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MARQUEE */}
      <div className="bg-orange py-3 overflow-hidden border-y-2 border-border">
        <div className="flex animate-marquee whitespace-nowrap">
          {[...Array(3)].map((_, i) => (
            <span key={i} className="font-display text-primary-foreground text-xl tracking-widest mx-8">
              ДИАГНОСТИКА · РЕМОНТ ДВИГАТЕЛЯ · ТОРМОЗНАЯ СИСТЕМА · ХОДОВАЯ ЧАСТЬ · КУЗОВНЫЕ РАБОТЫ · ЭЛЕКТРИКА · ТО И ОБСЛУЖИВАНИЕ · ШИНОМОНТАЖ ·&nbsp;
            </span>
          ))}
        </div>
      </div>

      {/* STATS */}
      <section className="bg-surface border-b-2 border-border">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x-2 divide-border">
            {stats.map((stat) => (
              <div key={stat.value} className="px-8 py-10 text-center">
                <div className="font-display text-5xl text-orange mb-2">{stat.value}</div>
                <div className="font-mono text-xs text-muted-foreground uppercase tracking-widest">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="mb-14">
            <span className="font-mono text-xs text-orange uppercase tracking-widest">// Почему нас выбирают</span>
            <h2 className="font-display text-5xl md:text-6xl tracking-wider mt-2">
              НАШИ <span className="text-orange">ПРИНЦИПЫ</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border">
            {features.map((feat, i) => {
              const Icon = feat.icon;
              return (
                <div key={i} className="bg-background p-8 group hover:bg-surface transition-colors">
                  <div className="w-12 h-12 bg-orange/10 border border-orange/20 flex items-center justify-center mb-6 group-hover:bg-orange/20 transition-colors">
                    <Icon className="w-6 h-6 text-orange" />
                  </div>
                  <h3 className="font-display text-2xl tracking-wider mb-3">{feat.title}</h3>
                  <p className="font-mono text-sm text-muted-foreground leading-relaxed">{feat.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CHECKLIST */}
      <section className="py-16 bg-surface border-y-2 border-border">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="font-display text-4xl md:text-5xl tracking-wider mb-10">
              ЧТО МЫ <span className="text-orange">ДЕЛАЕМ</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
              {[
                "Диагностика двигателя",
                "Замена масла и фильтров",
                "Ремонт тормозной системы",
                "Замена подвески и ходовой",
                "Кузовные работы",
                "Компьютерная диагностика",
                "Ремонт электрики",
                "Шиномонтаж и балансировка",
                "Замена ГРМ",
                "Ремонт КПП",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-orange flex-shrink-0" />
                  <span className="font-mono text-sm">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA BLOCK */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="relative bg-orange p-12 md:p-16 shadow-brutal-lg">
            <div className="absolute top-0 left-0 right-0 h-1 bg-primary-foreground/20" />
            <div className="max-w-2xl">
              <h2 className="font-display text-5xl md:text-7xl tracking-wider text-primary-foreground mb-4 leading-none">
                ЗАПИШИТЕСЬ<br />ПРЯМО СЕЙЧАС
              </h2>
              <p className="font-mono text-sm text-primary-foreground/80 mb-8 leading-relaxed">
                Оставьте заявку — мы перезвоним в течение 15 минут и согласуем удобное время.
              </p>
              <Link
                to="/booking"
                className="inline-flex items-center gap-3 bg-primary-foreground text-primary px-8 py-4 font-display text-2xl tracking-widest hover:bg-primary-foreground/90 transition-colors shadow-brutal"
              >
                Записаться → 
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
