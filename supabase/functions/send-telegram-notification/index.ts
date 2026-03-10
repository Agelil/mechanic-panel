import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = () => createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

async function getTelegramSettings(db: ReturnType<typeof createClient>) {
  const { data } = await db.from('settings').select('key, value').in('key', ['telegram_bot_token', 'telegram_chat_id', 'notification_type']);
  const map: Record<string, string> = {};
  data?.forEach((s: { key: string; value: string | null }) => { map[s.key] = s.value || ''; });
  return map;
}

async function sendTelegramMessage(botToken: string, chatId: string, text: string) {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
  return res.json();
}

const STATUS_LABELS: Record<string, string> = {
  new: '🆕 Новая',
  processing: '🔧 В работе',
  parts_ordered: '📦 Запчасти заказаны',
  parts_arrived: '✅ Запчасти приехали',
  ready: '🎉 Готово!',
  completed: '✅ Завершено',
  cancelled: '❌ Отменено',
};

const CLIENT_NOTIFY_STATUSES = ['parts_arrived', 'ready', 'completed'];

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { type, ...payload } = body;

    const db = supabase();
    const settings = await getTelegramSettings(db);
    const botToken = settings['telegram_bot_token'];
    const masterChatId = settings['telegram_chat_id'];
    const notificationType = settings['notification_type'] || 'both';

    if (!botToken) {
      return new Response(JSON.stringify({ success: true, skipped: 'no_token' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // TYPE: new_registration — notify master/admin about new user signup
    if (type === 'new_registration') {
      if (masterChatId) {
        const { email: regEmail, user_id } = payload;
        const now = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
        const text = `👤 <b>НОВАЯ РЕГИСТРАЦИЯ — Сервис-Точка</b>\n\n📧 <b>Email:</b> ${regEmail}\n🔑 <b>ID:</b> <code>${user_id}</code>\n\n⏳ Ожидает подтверждения доступа.\n🕐 <i>${now} МСК</i>\n\n<i>Откройте админ-панель → Управление доступом для одобрения.</i>`;
        await sendTelegramMessage(botToken, masterChatId, text);
      }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // TYPE: new_appointment — notify master
    if (type === 'new_appointment') {
      if ((notificationType === 'master' || notificationType === 'both') && masterChatId) {
        const { name, phone, car_make, service_type, services, total_price, message } = payload;
        const now = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
        
        let servicesText = '';
        if (services && Array.isArray(services) && services.length > 0) {
          servicesText = '\n📋 <b>Услуги:</b>\n' + services.map((s: { name: string; price_from: number }) => `  • ${s.name} — от ${s.price_from.toLocaleString('ru-RU')} руб.`).join('\n');
        } else if (service_type) {
          servicesText = `\n🔧 <b>Услуга:</b> ${service_type}`;
        }

        const text = `🔔 <b>НОВАЯ ЗАЯВКА — Сервис-Точка</b>\n\n👤 <b>Клиент:</b> ${name}\n📞 <b>Телефон:</b> ${phone}\n🚗 <b>Автомобиль:</b> ${car_make}${servicesText}${total_price ? `\n💰 <b>Предв. стоимость:</b> от ${total_price.toLocaleString('ru-RU')} руб.` : ''}${message ? `\n💬 <b>Комментарий:</b> ${message}` : ''}\n\n🕐 <i>${now} МСК</i>`;
        await sendTelegramMessage(botToken, masterChatId, text);
      }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // TYPE: status_changed — notify client and/or master
    if (type === 'status_changed') {
      const { appointment_id, new_status, appointment } = payload;
      const statusLabel = STATUS_LABELS[new_status] || new_status;

      // Notify master
      if ((notificationType === 'master' || notificationType === 'both') && masterChatId) {
        const text = `📊 <b>СТАТУС ИЗМЕНЁН</b>\n\n👤 ${appointment.name} (${appointment.phone})\n🚗 ${appointment.car_make}\n📌 Новый статус: <b>${statusLabel}</b>`;
        await sendTelegramMessage(botToken, masterChatId, text);
      }

      // Notify client if status warrants it
      if ((notificationType === 'client' || notificationType === 'both') && CLIENT_NOTIFY_STATUSES.includes(new_status)) {
        // Find telegram_user by phone
        const phone = appointment.phone || appointment.client_phone;
        if (phone) {
          const { data: tgUser } = await db.from('telegram_users').select('chat_id').eq('phone', phone).maybeSingle();
          if (tgUser?.chat_id) {
            let clientText = '';
            if (new_status === 'ready') {
              clientText = `🎉 <b>Ваш автомобиль готов!</b>\n\nАвтосервис <b>Сервис-Точка</b> сообщает, что ремонт вашего автомобиля завершён.\n\nМожете забирать! 🚗\n📞 +7 (812) 123-45-67`;
            } else if (new_status === 'parts_arrived') {
              clientText = `📦 <b>Запчасти для вашего автомобиля прибыли!</b>\n\nАвтосервис <b>Сервис-Точка</b> сообщает, что все необходимые запчасти получены. Ремонт скоро начнётся.`;
            } else if (new_status === 'completed') {
              clientText = `✅ <b>Заказ завершён!</b>\n\nСпасибо, что доверились <b>Сервис-Точка</b>. Будем рады видеть вас снова! 🔧`;
            }
            if (clientText) await sendTelegramMessage(botToken, tgUser.chat_id, clientText);
          }

          // Also update client_notified in appointments
          await db.from('appointments').update({ client_notified: true }).eq('id', appointment_id);
        }
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // TYPE: broadcast — send to all telegram_users
    if (type === 'broadcast') {
      const { message: broadcastMsg } = payload;
      const { data: users } = await db.from('telegram_users').select('chat_id').eq('is_active', true);
      
      let sent = 0, failed = 0;
      for (const user of (users || [])) {
        try {
          await sendTelegramMessage(botToken, user.chat_id, broadcastMsg);
          sent++;
          await new Promise(r => setTimeout(r, 50)); // rate limit
        } catch { failed++; }
      }

      return new Response(JSON.stringify({ success: true, sent, failed }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // TYPE: check_status (from bot webhook) — client queries their repair status
    if (type === 'check_status') {
      const { phone, chat_id } = payload;
      
      // Register/update user
      await db.from('telegram_users').upsert({ chat_id, phone }, { onConflict: 'chat_id' });
      if (phone) {
        await db.from('telegram_users').update({ phone }).eq('chat_id', chat_id);
        // Update clients table
        await db.from('clients').upsert({ phone, telegram_chat_id: chat_id }, { onConflict: 'phone' });
      }

      // Find latest active appointment
      const { data: appt } = await db.from('appointments')
        .select('*')
        .eq('phone', phone)
        .not('status', 'in', '("completed","cancelled")')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let replyText = '';
      if (appt) {
        const statusLabel = STATUS_LABELS[appt.status] || appt.status;
        replyText = `🔍 <b>Статус вашего ремонта:</b>\n\n🚗 ${appt.car_make}\n📌 Статус: <b>${statusLabel}</b>`;
      } else {
        replyText = `ℹ️ Активных заказов не найдено.\n\nЗапишитесь на сервис через наш сайт или по телефону +7 (812) 123-45-67`;
      }

      if (chat_id) await sendTelegramMessage(botToken, chat_id, replyText);

      return new Response(JSON.stringify({ success: true, has_appointment: !!appt }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'unknown_type' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('Notification error:', err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
