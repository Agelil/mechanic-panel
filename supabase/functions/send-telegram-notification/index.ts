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

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

    // TYPE: new_registration
    if (type === 'new_registration') {
      if (masterChatId) {
        const { email: regEmail, user_id } = payload;
        const now = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
        const text = `👤 <b>НОВАЯ РЕГИСТРАЦИЯ — Сервис-Точка</b>\n\n📧 <b>Email:</b> ${regEmail}\n🔑 <b>ID:</b> <code>${user_id}</code>\n\n⏳ Ожидает подтверждения доступа.\n🕐 <i>${now} МСК</i>`;
        await sendTelegramMessage(botToken, masterChatId, text);
      }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // TYPE: supply_order
    if (type === 'supply_order') {
      const { master_name, supply_type, item_name, quantity, unit, urgency, appointment_id } = payload;
      const supplyTypeLabels: Record<string, string> = { part: '🔩 Запчасть', tool: '🔧 Инструмент', consumable: '🧴 Расходники' };
      const urgencyLabel = urgency === 'urgent' ? '🚨 СРОЧНО' : '📋 Планово';
      const now = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });

      let licenseInfo = '';
      if (appointment_id) {
        const { data: appt } = await db.from('appointments').select('license_plate, car_make').eq('id', appointment_id).maybeSingle();
        if (appt) licenseInfo = `\n🚗 <b>Авто:</b> ${appt.car_make}${appt.license_plate ? ` (${appt.license_plate})` : ''}`;
      }

      const text = `🛠 <b>ЗАЯВКА НА СНАБЖЕНИЕ — Сервис-Точка</b>\n\n👤 <b>Мастер:</b> ${master_name}\n📦 <b>Тип:</b> ${supplyTypeLabels[supply_type] || supply_type}\n📝 <b>Наименование:</b> ${item_name}\n🔢 <b>Количество:</b> ${quantity} ${unit}\n⚡ <b>Срочность:</b> ${urgencyLabel}${licenseInfo}\n\n🕐 <i>${now} МСК</i>`;

      if (masterChatId) await sendTelegramMessage(botToken, masterChatId, text);

      const { data: supplyGroups } = await db.from('user_groups').select('telegram_chat_id, permissions');
      for (const group of (supplyGroups || [])) {
        const perms = group.permissions as Record<string, boolean>;
        if (perms?.notify_supply_orders && group.telegram_chat_id && group.telegram_chat_id !== masterChatId) {
          await sendTelegramMessage(botToken, group.telegram_chat_id, text);
        }
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // TYPE: new_appointment
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

        const { data: apptGroups } = await db.from('user_groups').select('telegram_chat_id, permissions');
        for (const group of (apptGroups || [])) {
          const perms = group.permissions as Record<string, boolean>;
          if (perms?.notify_new_appointments && group.telegram_chat_id && group.telegram_chat_id !== masterChatId) {
            const priceText = perms?.view_prices && total_price ? `\n💰 от ${total_price.toLocaleString('ru-RU')} руб.` : '';
            const groupText = `🔔 <b>НОВАЯ ЗАЯВКА</b>\n\n🚗 ${car_make}${servicesText}${priceText}\n🕐 <i>${now} МСК</i>`;
            await sendTelegramMessage(botToken, group.telegram_chat_id, groupText);
          }
        }
      }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // TYPE: status_changed — CASCADING notifications with delay
    if (type === 'status_changed') {
      const { appointment_id, new_status, appointment } = payload;
      const statusLabel = STATUS_LABELS[new_status] || new_status;

      const results = { master_sent: false, master_error: null as string | null, client_sent: false, client_error: null as string | null };

      // Step 1: Notify master/admin FIRST
      if ((notificationType === 'master' || notificationType === 'both') && masterChatId) {
        try {
          const text = `📊 <b>СТАТУС ИЗМЕНЁН</b>\n\n👤 ${appointment.name} (${appointment.phone})\n🚗 ${appointment.car_make}\n📌 Новый статус: <b>${statusLabel}</b>`;
          await sendTelegramMessage(botToken, masterChatId, text);
          results.master_sent = true;

          // Also notify groups with notify_status_changes permission
          const { data: statusGroups } = await db.from('user_groups').select('telegram_chat_id, permissions');
          for (const group of (statusGroups || [])) {
            const perms = group.permissions as Record<string, boolean>;
            if (perms?.notify_status_changes && group.telegram_chat_id && group.telegram_chat_id !== masterChatId) {
              await sendTelegramMessage(botToken, group.telegram_chat_id, text);
            }
          }
        } catch (err) {
          results.master_error = String(err);
          console.error('[Telegram] Master notification failed:', err);
          // Don't block client notification
        }
      }

      // Step 2: Wait 20 seconds before notifying client
      if ((notificationType === 'client' || notificationType === 'both') && CLIENT_NOTIFY_STATUSES.includes(new_status)) {
        // 20-second delay to prevent Telegram API rate limits and give master time
        await delay(20000);

        // Step 3: Notify client
        try {
          const phone = appointment.phone || appointment.client_phone;
          if (phone) {
            const { data: tgUser } = await db.from('telegram_users').select('chat_id').eq('phone', phone).maybeSingle();
            if (tgUser?.chat_id) {
              let clientText = '';
              if (new_status === 'ready') {
                clientText = `🎉 <b>Ваш автомобиль готов!</b>\n\nАвтосервис <b>Сервис-Точка</b> сообщает, что ремонт вашего автомобиля завершён.\n\nМожете забирать! 🚗`;
              } else if (new_status === 'parts_arrived') {
                clientText = `📦 <b>Запчасти для вашего автомобиля прибыли!</b>\n\nАвтосервис <b>Сервис-Точка</b> сообщает, что все необходимые запчасти получены. Ремонт скоро начнётся.`;
              } else if (new_status === 'completed') {
                clientText = `✅ <b>Заказ завершён!</b>\n\nСпасибо, что доверились <b>Сервис-Точка</b>. Будем рады видеть вас снова! 🔧`;
              }
              if (clientText) {
                await sendTelegramMessage(botToken, tgUser.chat_id, clientText);
                results.client_sent = true;
              }
            }

            await db.from('appointments').update({ client_notified: true }).eq('id', appointment_id);
          }
        } catch (err) {
          results.client_error = String(err);
          console.error('[Telegram] Client notification failed:', err);
        }
      }

      return new Response(JSON.stringify({ success: true, ...results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // TYPE: broadcast
    if (type === 'broadcast') {
      const { message: broadcastMsg } = payload;
      const { data: users } = await db.from('telegram_users').select('chat_id').eq('is_active', true);
      
      let sent = 0, failed = 0;
      for (const user of (users || [])) {
        try {
          await sendTelegramMessage(botToken, user.chat_id, broadcastMsg);
          sent++;
          await delay(50);
        } catch { failed++; }
      }

      return new Response(JSON.stringify({ success: true, sent, failed }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // TYPE: check_status
    if (type === 'check_status') {
      const { phone, chat_id } = payload;
      
      await db.from('telegram_users').upsert({ chat_id, phone }, { onConflict: 'chat_id' });
      if (phone) {
        await db.from('telegram_users').update({ phone }).eq('chat_id', chat_id);
        await db.from('clients').upsert({ phone, telegram_chat_id: chat_id }, { onConflict: 'phone' });
      }

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
        replyText = `ℹ️ Активных заказов не найдено.\n\nЗапишитесь на сервис через наш сайт.`;
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
