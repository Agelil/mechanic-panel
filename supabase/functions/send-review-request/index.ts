import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// This function is called by a cron job every 5 minutes
// It checks for review_requests that are scheduled and not yet sent
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const db = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get bot token and yandex maps url
    const { data: settingsRows } = await db
      .from('settings')
      .select('key, value')
      .in('key', ['telegram_bot_token', 'yandex_maps_url']);

    const settings: Record<string, string> = {};
    settingsRows?.forEach((s: { key: string; value: string | null }) => { settings[s.key] = s.value || ''; });

    const botToken = settings['telegram_bot_token'];
    const yandexMapsUrl = settings['yandex_maps_url'] || 'https://yandex.ru/maps';

    if (!botToken) {
      return new Response(JSON.stringify({ skipped: 'no_bot_token' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const now = new Date();

    // Find pending review requests that are due
    const { data: pendingRequests } = await db
      .from('review_requests')
      .select('*, appointments!inner(id, name, phone, car_make, service_type)')
      .eq('sent', false)
      .lte('scheduled_for', now.toISOString())
      .limit(20);

    let sent = 0;

    for (const req_item of (pendingRequests || [])) {
      const appt = req_item.appointments;

      // Find telegram chat_id for this phone
      const { data: tgUser } = await db
        .from('telegram_users')
        .select('chat_id')
        .eq('phone', appt.phone)
        .maybeSingle();

      if (!tgUser?.chat_id) {
        // Mark as sent anyway to avoid retrying forever
        await db.from('review_requests').update({ sent: true, sent_at: now.toISOString() }).eq('id', req_item.id);
        continue;
      }

      // Send review request with inline keyboard (1-5 stars)
      const reviewUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/handle-review`;
      const inlineKeyboard = {
        inline_keyboard: [[
          { text: '⭐ 1', callback_data: `review_${req_item.appointment_id}_1` },
          { text: '⭐ 2', callback_data: `review_${req_item.appointment_id}_2` },
          { text: '⭐ 3', callback_data: `review_${req_item.appointment_id}_3` },
          { text: '⭐ 4', callback_data: `review_${req_item.appointment_id}_4` },
          { text: '⭐ 5', callback_data: `review_${req_item.appointment_id}_5` },
        ]],
      };

      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: tgUser.chat_id,
          text: `⭐ <b>Оцените качество нашей работы!</b>\n\nСпасибо, что доверились <b>Сервис-Точка</b>.\n🚗 Ваш автомобиль: <b>${appt.car_make}</b>\n\nПоставьте оценку от 1 до 5 — это займёт 10 секунд и поможет нам становиться лучше:`,
          parse_mode: 'HTML',
          reply_markup: inlineKeyboard,
        }),
      });

      if (res.ok) {
        await db.from('review_requests').update({ sent: true, sent_at: now.toISOString() }).eq('id', req_item.id);
        sent++;
        await new Promise(r => setTimeout(r, 100)); // rate limit
      }
    }

    return new Response(JSON.stringify({ success: true, processed: sent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Review request cron error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
