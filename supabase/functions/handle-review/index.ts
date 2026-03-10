import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Handles Telegram callback queries from review inline keyboard
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const db = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: settingsRows } = await db
      .from('settings')
      .select('key, value')
      .in('key', ['telegram_bot_token', 'yandex_maps_url']);

    const settings: Record<string, string> = {};
    settingsRows?.forEach((s: { key: string; value: string | null }) => { settings[s.key] = s.value || ''; });

    const botToken = settings['telegram_bot_token'];
    const yandexMapsUrl = settings['yandex_maps_url'] || 'https://yandex.ru/maps';

    if (!botToken) return new Response('ok', { headers: corsHeaders });

    // Handle callback_query (star rating button press)
    if (body.callback_query) {
      const cbq = body.callback_query;
      const chatId = String(cbq.from.id);
      const data = cbq.data || '';
      const firstName = cbq.from?.first_name || '';

      // Parse: review_{appointment_id}_{rating}
      const match = data.match(/^review_([a-f0-9-]+)_(\d)$/);
      if (match) {
        const appointmentId = match[1];
        const rating = parseInt(match[2]);

        // Get appointment
        const { data: appt } = await db
          .from('appointments')
          .select('id, name, phone, car_make')
          .eq('id', appointmentId)
          .maybeSingle();

        // Save review
        await db.from('reviews').upsert({
          appointment_id: appointmentId,
          phone: appt?.phone,
          telegram_chat_id: chatId,
          client_name: appt?.name || firstName,
          rating,
          is_published: rating >= 4, // auto-publish 4-5 stars
        }, { onConflict: 'appointment_id' });

        // Answer callback query (remove loading state)
        await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callback_query_id: cbq.id,
            text: rating >= 4 ? '🙏 Спасибо за высокую оценку!' : '📝 Спасибо! Расскажите подробнее.',
          }),
        });

        const sendMsg = async (text: string, replyMarkup?: Record<string, unknown>) => {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text,
              parse_mode: 'HTML',
              ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
            }),
          });
        };

        const stars = '⭐'.repeat(rating) + '☆'.repeat(5 - rating);

        if (rating >= 4) {
          // Happy path: invite to Yandex Maps
          await sendMsg(
            `${stars}\n\n🎉 <b>Спасибо за оценку ${rating}/5!</b>\n\nМы очень рады, что вы остались довольны нашей работой. Если у вас есть пара минут — оставьте отзыв на Яндекс.Картах, это очень помогает нам!`,
            {
              inline_keyboard: [[
                { text: '📍 Оставить отзыв на Яндекс.Картах', url: yandexMapsUrl },
              ]],
            }
          );
        } else {
          // Negative feedback: ask for details
          await sendMsg(
            `${stars}\n\n😔 <b>Нам жаль, что вы поставили ${rating}/5.</b>\n\nМы хотим исправить ситуацию. Пожалуйста, расскажите что пошло не так — отправьте следующим сообщением, и мы обязательно свяжемся с вами.`,
          );

          // Mark this chat as expecting feedback
          await db.from('telegram_users').update({
            // Using a simple flag via username field trick — store state in DB
          }).eq('chat_id', chatId);

          // Save state for next message handling
          await db.from('telegram_sessions').upsert({
            telegram_id: cbq.from.id,
            first_name: firstName,
            auth_date: Math.floor(Date.now() / 1000),
            hash: 'pending_feedback',
            session_token: `feedback_${appointmentId}`,
          }, { onConflict: 'telegram_id' });
        }
      }

      return new Response('ok', { headers: corsHeaders });
    }

    // Handle text messages (negative feedback follow-up)
    if (body.message?.text) {
      const msg = body.message;
      const chatId = String(msg.chat.id);
      const text = msg.text || '';
      const firstName = msg.from?.first_name || '';

      // Check if this user has a pending feedback session
      const { data: session } = await db
        .from('telegram_sessions')
        .select('session_token, telegram_id')
        .eq('telegram_id', msg.from.id)
        .maybeSingle();

      if (session?.session_token?.startsWith('feedback_')) {
        const appointmentId = session.session_token.replace('feedback_', '');

        // Update review with feedback text
        await db.from('reviews')
          .update({ feedback: text })
          .eq('appointment_id', appointmentId);

        // Notify admin via Telegram
        const { data: masterSettings } = await db
          .from('settings')
          .select('value')
          .eq('key', 'telegram_chat_id')
          .maybeSingle();

        if (masterSettings?.value) {
          const { data: appt } = await db
            .from('appointments')
            .select('name, phone, car_make')
            .eq('id', appointmentId)
            .maybeSingle();

          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: masterSettings.value,
              text: `⚠️ <b>НЕГАТИВНЫЙ ОТЗЫВ</b>\n\n👤 ${appt?.name || firstName} (${appt?.phone || chatId})\n🚗 ${appt?.car_make || '—'}\n\n💬 "${text}"\n\n<i>Требует ответа!</i>`,
              parse_mode: 'HTML',
            }),
          });
        }

        // Clear pending state
        await db.from('telegram_sessions')
          .update({ session_token: 'done', hash: 'done' })
          .eq('telegram_id', msg.from.id);

        // Thank user
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: '🙏 <b>Спасибо за обратную связь!</b>\n\nМы передадим ваш отзыв руководству. С вами свяжутся в ближайшее время для решения вопроса.',
            parse_mode: 'HTML',
          }),
        });
      }
    }

    return new Response('ok', { headers: corsHeaders });
  } catch (err) {
    console.error('Review handler error:', err);
    return new Response('ok', { headers: corsHeaders });
  }
});
