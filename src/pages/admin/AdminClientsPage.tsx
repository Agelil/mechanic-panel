import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Users, Phone, Car, Star, MessageSquare, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Client {
  id: string;
  phone: string;
  name: string | null;
  bonus_points: number;
  telegram_chat_id: string | null;
  telegram_username: string | null;
  car_history: unknown;
  created_at: string;
}

interface TelegramUser {
  id: string;
  chat_id: string;
  username: string | null;
  first_name: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

export default function AdminClientsPage() {
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [tgUsers, setTgUsers] = useState<TelegramUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"clients" | "telegram">("clients");
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [broadcasting, setBroadcasting] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from("clients").select("*").order("created_at", { ascending: false }),
      supabase.from("telegram_users").select("*").order("created_at", { ascending: false }),
    ]).then(([c, t]) => {
      setClients(c.data || []);
      setTgUsers(t.data || []);
      setLoading(false);
    });
  }, []);

  const handleBroadcast = async () => {
    if (!broadcastMsg.trim()) return;
    setBroadcasting(true);
    try {
      const { data } = await supabase.functions.invoke("send-telegram-notification", {
        body: { type: "broadcast", message: broadcastMsg.trim() },
      });
      toast({ title: "Рассылка отправлена", description: `Доставлено: ${data?.sent || 0}` });
      setBroadcastMsg("");
    } catch {
      toast({ title: "Ошибка рассылки", variant: "destructive" });
    }
    setBroadcasting(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-4xl tracking-wider">КЛИЕНТЫ</h1>
          <p className="font-mono text-sm text-muted-foreground">База клиентов и Telegram-подписчики</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-xs text-muted-foreground">{clients.length} клиентов</span>
          <span className="font-mono text-xs text-orange">{tgUsers.length} в Telegram</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-px bg-border mb-6 w-fit">
        {(["clients", "telegram"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2.5 font-mono text-xs uppercase tracking-widest transition-colors ${tab === t ? "bg-orange text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground hover:bg-surface"}`}>
            {t === "clients" ? `Клиенты (${clients.length})` : `Telegram (${tgUsers.length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-orange animate-spin" /></div>
      ) : tab === "clients" ? (
        <>
          {clients.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-border">
              <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="font-mono text-sm text-muted-foreground">Клиентов пока нет. Они появятся после первых заявок.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {clients.map((client) => (
                <div key={client.id} className="bg-surface border-2 border-border hover:border-orange/20 transition-colors p-5">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="w-10 h-10 bg-orange/10 border border-orange/20 flex items-center justify-center flex-shrink-0">
                      <Users className="w-5 h-5 text-orange" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display text-xl tracking-wider">{client.name || "Без имени"}</h3>
                      <div className="flex flex-wrap gap-4 mt-1">
                        <span className="flex items-center gap-1 font-mono text-sm">
                          <Phone className="w-3 h-3 text-orange" />
                          <a href={`tel:${client.phone}`} className="hover:text-orange transition-colors">{client.phone}</a>
                        </span>
                        {client.telegram_username && (
                          <span className="flex items-center gap-1 font-mono text-sm text-muted-foreground">
                            <MessageSquare className="w-3 h-3" />@{client.telegram_username}
                          </span>
                        )}
                        <span className="flex items-center gap-1 font-mono text-sm text-orange">
                          <Star className="w-3 h-3" />{client.bonus_points} бонусов
                        </span>
                      </div>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">
                      {new Date(client.created_at).toLocaleDateString("ru-RU")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {/* Broadcast */}
          <div className="bg-surface border-2 border-orange/30 p-5 mb-6">
            <h3 className="font-display text-xl tracking-wider mb-3 flex items-center gap-2">
              <Send className="w-5 h-5 text-orange" />
              РАССЫЛКА ВСЕМ ПОДПИСЧИКАМ
            </h3>
            <p className="font-mono text-xs text-muted-foreground mb-4">
              Сообщение получат <strong>{tgUsers.filter(u => u.is_active).length}</strong> активных подписчиков Telegram-бота.
              Используйте для акций и новостей.
            </p>
            <textarea
              value={broadcastMsg}
              onChange={(e) => setBroadcastMsg(e.target.value)}
              placeholder="🎉 Новая акция! Скидка 20% на ТО до конца месяца. Записывайтесь прямо сейчас!"
              rows={4}
              className="w-full bg-background border-2 border-border px-4 py-3 font-mono text-sm focus:outline-none focus:border-orange transition-colors resize-none mb-3"
            />
            <button onClick={handleBroadcast} disabled={broadcasting || !broadcastMsg.trim()}
              className="flex items-center gap-2 bg-orange text-primary-foreground px-5 py-2.5 font-mono text-sm hover:bg-orange-bright transition-colors disabled:opacity-50 shadow-brutal-sm">
              {broadcasting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {broadcasting ? "Отправляем..." : "Отправить рассылку"}
            </button>
          </div>

          {/* TG users list */}
          {tgUsers.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-border">
              <MessageSquare className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="font-mono text-sm text-muted-foreground">Подписчиков пока нет. Напишите боту /start чтобы зарегистрироваться.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tgUsers.map((user) => (
                <div key={user.id} className={`bg-surface border-2 transition-colors p-4 flex items-center gap-4 ${user.is_active ? "border-border hover:border-orange/20" : "border-border/30 opacity-50"}`}>
                  <div className="w-8 h-8 bg-orange/10 flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="w-4 h-4 text-orange" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold">{user.first_name || "Без имени"}</span>
                      {user.username && <span className="font-mono text-xs text-muted-foreground">@{user.username}</span>}
                      <span className="font-mono text-xs text-orange/70">ID: {user.chat_id}</span>
                    </div>
                    {user.phone && (
                      <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                        <Phone className="w-3 h-3" />{user.phone}
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">{new Date(user.created_at).toLocaleDateString("ru-RU")}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
