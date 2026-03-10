import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, phone, car_make, service_type, message } = await req.json();

    // Get Telegram credentials from settings table
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: settingsData } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['telegram_bot_token', 'telegram_chat_id']);

    const settingsMap: Record<string, string> = {};
    settingsData?.forEach((s: { key: string; value: string | null }) => {
      settingsMap[s.key] = s.value || '';
    });

    const botToken = settingsMap['telegram_bot_token'];
    const chatId = settingsMap['telegram_chat_id'];

    if (!botToken || !chatId) {
      console.log('Telegram not configured, skipping notification');
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const now = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
    const text = `🔧 <b>Новая заявка — Сервис-Точка</b>

👤 <b>Клиент:</b> ${name}
📞 <b>Телефон:</b> ${phone}
🚗 <b>Автомобиль:</b> ${car_make}
🔧 <b>Услуга:</b> ${service_type}${message ? `\n💬 <b>Комментарий:</b> ${message}` : ''}

🕐 <i>${now} (МСК)</i>`;

    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    });

    const tgData = await tgRes.json();

    if (!tgRes.ok) {
      console.error('Telegram API error:', tgData);
      return new Response(JSON.stringify({ success: false, error: tgData }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Edge function error:', err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
