import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// This function receives Telegram webhook updates and processes bot commands
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const update = await req.json();
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Get bot token
    const { data: settings } = await db.from('settings').select('key, value').in('key', ['telegram_bot_token']);
    const settingsMap: Record<string, string> = {};
    settings?.forEach((s: { key: string; value: string | null }) => { settingsMap[s.key] = s.value || ''; });
    const botToken = settingsMap['telegram_bot_token'];

    if (!botToken || !update.message) {
      return new Response('ok', { headers: corsHeaders });
    }

    const msg = update.message;
    const chatId = String(msg.chat.id);
    const text = msg.text || '';
    const username = msg.from?.username;
    const firstName = msg.from?.first_name || '';

    // Register user
    await db.from('telegram_users').upsert({
      chat_id: chatId,
      username,
      first_name: firstName,
      last_name: msg.from?.last_name,
    }, { onConflict: 'chat_id' });

    const sendMsg = async (replyText: string) => {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: replyText, parse_mode: 'HTML' }),
      });
    };

    // /start
    if (text === '/start') {
      await sendMsg(`👋 Привет, <b>${firstName}</b>!\n\nЯ бот автосервиса <b>Сервис-Точка</b>.\n\nЧтобы узнать статус вашего ремонта, отправьте команду:\n/status [номер телефона]\n\nПример: <code>/status +79001234567</code>\n\n🌐 Наш сайт и запись: сервис-точка.рф`);
      return new Response('ok', { headers: corsHeaders });
    }

    // /status [phone]
    if (text.startsWith('/status')) {
      const phone = text.replace('/status', '').trim();
      if (!phone) {
        await sendMsg('📞 Укажите номер телефона:\n/status +79001234567');
        return new Response('ok', { headers: corsHeaders });
      }

      // Save phone to telegram_users
      await db.from('telegram_users').update({ phone }).eq('chat_id', chatId);
      // Upsert clients
      await db.from('clients').upsert({ phone, telegram_chat_id: chatId }, { onConflict: 'phone' });

      // Find appointment
      const { data: appt } = await db.from('appointments')
        .select('*')
        .eq('phone', phone)
        .not('status', 'in', '("completed","cancelled")')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const STATUS_LABELS: Record<string, string> = {
        new: '🆕 Новая заявка',
        processing: '🔧 В работе',
        parts_ordered: '📦 Заказаны запчасти',
        parts_arrived: '✅ Запчасти прибыли',
        ready: '🎉 Готово! Можно забирать',
        completed: '✅ Завершено',
        cancelled: '❌ Отменено',
      };

      if (appt) {
        const statusLabel = STATUS_LABELS[appt.status] || appt.status;
        await sendMsg(`🔍 <b>Статус вашего ремонта:</b>\n\n🚗 ${appt.car_make}\n🔧 ${appt.service_type || 'Комплексный ремонт'}\n📌 Статус: <b>${statusLabel}</b>\n\nМы уведомим вас, когда статус изменится.`);
      } else {
        await sendMsg(`ℹ️ По номеру <b>${phone}</b> активных заказов не найдено.\n\nЗапишитесь через сайт или позвоните: +7 (812) 123-45-67`);
      }
      return new Response('ok', { headers: corsHeaders });
    }

    // /help или любое сообщение
    await sendMsg(`💬 Доступные команды:\n/start — начало работы\n/status [телефон] — статус ремонта\n\n📞 Связаться с нами: +7 (812) 123-45-67`);

    return new Response('ok', { headers: corsHeaders });
  } catch (err) {
    console.error('Bot webhook error:', err);
    return new Response('ok', { headers: corsHeaders });
  }
});
