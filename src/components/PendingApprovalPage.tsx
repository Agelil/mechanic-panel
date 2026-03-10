import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Clock, LogOut, Wrench } from "lucide-react";

export default function PendingApprovalPage() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center bg-grid">
      <div className="w-full max-w-md px-4 text-center">
        <div className="w-16 h-16 bg-orange/10 border-2 border-orange flex items-center justify-center mx-auto mb-6">
          <Clock className="w-8 h-8 text-orange" />
        </div>

        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-8 h-8 bg-orange flex items-center justify-center">
            <Wrench className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-display text-2xl tracking-widest">СЕРВИС<span className="text-orange">-</span>ТОЧКА</span>
        </div>

        <div className="bg-surface border-2 border-border p-8 shadow-brutal">
          <h1 className="font-display text-3xl tracking-wider mb-4">АККАУНТ НА РАССМОТРЕНИИ</h1>
          
          <div className="w-full h-0.5 bg-orange/20 mb-6" />

          <p className="font-mono text-sm text-muted-foreground leading-relaxed mb-6">
            Ваш аккаунт создан и ожидает подтверждения Менеджером или Администратором.
          </p>

          <div className="bg-orange/5 border border-orange/20 p-4 mb-6">
            <p className="font-mono text-xs text-orange uppercase tracking-widest mb-2">Что дальше?</p>
            <ul className="font-mono text-xs text-muted-foreground space-y-1 text-left">
              <li>• Менеджер проверит ваши данные</li>
              <li>• После одобрения вы получите полный доступ</li>
              <li>• Попробуйте войти повторно через некоторое время</li>
            </ul>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full font-mono text-sm border-2 border-border px-6 py-3 hover:border-orange hover:text-orange transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Выйти из аккаунта
          </button>
        </div>
      </div>
    </div>
  );
}
