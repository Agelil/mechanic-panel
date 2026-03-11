import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, MessageCircle, Bell, History, Gift, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function BookingSuccessPage() {
  const navigate = useNavigate();
  const [botUsername, setBotUsername] = useState("ServiceTochkaBot");
  const isGuest = !localStorage.getItem("tg_cabinet_user");

  useEffect(() => {
    supabase
      .from("settings")
      .select("value")
      .eq("key", "telegram_bot_username")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) setBotUsername(data.value);
      });
  }, []);

  return (
    <div className="min-h-screen pt-16 bg-background">
      <div className="container mx-auto px-4 py-16 max-w-2xl">
        {/* Success confirmation */}
        <div className="text-center mb-10 animate-slide-up">
          <div className="w-24 h-24 bg-orange/10 border-2 border-orange flex items-center justify-center mx-auto mb-6 relative">
            <CheckCircle2 className="w-12 h-12 text-orange" />
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-orange rounded-full animate-ping" />
          </div>
          <h1 className="font-display text-5xl md:text-6xl tracking-wider mb-4">
            ЗАЯВКА <span className="text-orange">ПРИНЯТА!</span>
          </h1>
          <p className="font-mono text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
            Мы свяжемся с вами <span className="text-foreground font-bold">в течение 15 минут</span> для подтверждения записи и уточнения деталей.
          </p>
        </div>

        {/* Telegram CTA */}
        <div className="bg-surface border-2 border-orange/50 p-8 shadow-brutal-sm mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-orange flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h2 className="font-display text-2xl tracking-wider">ОТСЛЕЖИВАЙТЕ РЕМОНТ</h2>
              <p className="font-mono text-xs text-orange">в Telegram</p>
            </div>
          </div>

          <div className="space-y-3 mb-6">
            <div className="flex items-start gap-3">
              <Bell className="w-4 h-4 text-orange flex-shrink-0 mt-0.5" />
              <p className="font-mono text-sm text-muted-foreground">
                Мгновенные уведомления о статусе работ — узнайте первым, когда машина будет готова
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Gift className="w-4 h-4 text-orange flex-shrink-0 mt-0.5" />
              <p className="font-mono text-sm text-muted-foreground">
                Начисление бонусов и скидки — отслеживайте баланс прямо в боте
              </p>
            </div>
            <div className="flex items-start gap-3">
              <History className="w-4 h-4 text-orange flex-shrink-0 mt-0.5" />
              <p className="font-mono text-sm text-muted-foreground">
                Полная история обслуживания и документы всегда под рукой
              </p>
            </div>
          </div>

          <a
            href={`https://t.me/${botUsername}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-orange text-primary-foreground px-8 py-4 font-display text-xl tracking-widest hover:bg-orange-bright transition-colors shadow-brutal-lg flex items-center justify-center gap-3"
          >
            <MessageCircle className="w-5 h-5" />
            ПЕРЕЙТИ В ЧАТ-БОТ
          </a>

          <p className="font-mono text-xs text-muted-foreground text-center mt-3">
            В боте вы будете получать мгновенные уведомления о статусе работ, начислении бонусов и сможете посмотреть историю обслуживания.
          </p>
        </div>

        {/* Guest registration CTA */}
        {isGuest && (
          <div className="bg-surface border-2 border-border p-6 mb-8">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-orange/10 border border-orange/20 flex items-center justify-center flex-shrink-0">
                <Gift className="w-5 h-5 text-orange" />
              </div>
              <div>
                <h3 className="font-display text-xl tracking-wider">СОЗДАЙТЕ ЛИЧНЫЙ КАБИНЕТ</h3>
                <p className="font-mono text-xs text-muted-foreground mt-1">
                  Отслеживайте статус ремонта, копите бонусы и получайте мгновенные уведомления через Telegram.
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate("/cabinet")}
              className="w-full border-2 border-orange text-orange px-6 py-3 font-display text-lg tracking-widest hover:bg-orange hover:text-primary-foreground transition-colors"
            >
              ЗАРЕГИСТРИРОВАТЬСЯ
            </button>
          </div>
        )}

        {/* Back actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate("/")}
            className="flex items-center justify-center gap-2 font-mono text-sm border-2 border-border px-6 py-3 hover:border-orange hover:text-orange transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            На главную
          </button>
          <button
            onClick={() => navigate("/booking")}
            className="flex items-center justify-center gap-2 font-mono text-sm border-2 border-border px-6 py-3 hover:border-orange hover:text-orange transition-colors"
          >
            Записать ещё один автомобиль
          </button>
        </div>
      </div>
    </div>
  );
}
