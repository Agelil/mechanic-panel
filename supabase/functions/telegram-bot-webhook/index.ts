import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const update = await req.json();
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

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
    const contact = msg.contact;

    const sendMsg = async (replyText: string, replyMarkup?: Record<string, unknown>) => {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: replyText,
          parse_mode: 'HTML',
          ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
        }),
      });
    };

    const sendContactRequest = async () => {
      await sendMsg(
        '📱 <b>Верификация по номеру телефона</b>\n\nДля доступа к истории ремонтов нажмите кнопку ниже и поделитесь контактом:',
        {
          keyboard: [[{ text: '📱 Поделиться контактом', request_contact: true }]],
          resize_keyboard: true,
          one_time_keyboard: true,
        }
      );
    };

    // Register/update user in telegram_users
    await db.from('telegram_users').upsert({
      chat_id: chatId,
      username,
      first_name: firstName,
      last_name: msg.from?.last_name,
    }, { onConflict: 'chat_id' });

    // Handle shared contact (phone verification)
    if (contact && contact.phone_number) {
      const phone = contact.phone_number.replace(/\s+/g, '').replace(/^8/, '+7');

      await db.from('telegram_users').update({ phone }).eq('chat_id', chatId);

      const { data: client } = await db.from('clients').select('id, name, phone, bonus_points').eq('phone', phone).maybeSingle();
      const { data: appt } = await db.from('appointments')
        .select('*')
        .eq('phone', phone)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (client || appt) {
        await db.from('clients').upsert({
          phone,
          telegram_chat_id: chatId,
          telegram_username: username,
          name: client?.name || firstName,
        }, { onConflict: 'phone' });

        const STATUS_LABELS: Record<string, string> = {
          new: '🆕 Новая заявка', processing: '🔧 В работе',
          parts_ordered: '📦 Заказаны запчасти', parts_arrived: '✅ Запчасти прибыли',
          ready: '🎉 Готово! Можно забирать', completed: '✅ Завершено', cancelled: '❌ Отменено',
        };

        let verifyMsg = `✅ <b>Верификация пройдена!</b>\n\nДобро пожаловать, <b>${client?.name || firstName}</b>!\n\n`;
        if (client?.bonus_points) {
          verifyMsg += `🎁 <b>Ваши бонусные баллы:</b> ${client.bonus_points}\n\n`;
        }
        if (appt) {
          const statusLabel = STATUS_LABELS[appt.status] || appt.status;
          verifyMsg += `🚗 <b>Последний заказ:</b>\n${appt.car_make}\n📌 Статус: <b>${statusLabel}</b>\n\n`;
        }
        verifyMsg += `Используйте /history для просмотра всех заявок\n/bonus для проверки бонусных баллов`;

        await sendMsg(verifyMsg, { remove_keyboard: true });
      } else {
        await sendMsg(
          `❓ Номер <b>${phone}</b> не найден в нашей базе.\n\nЕсли вы оставляли заявку с другим номером, используйте /status [номер]\nДля записи посетите наш сайт.`,
          { remove_keyboard: true }
        );
      }
      return new Response('ok', { headers: corsHeaders });
    }

    const STATUS_LABELS: Record<string, string> = {
      new: '🆕 Новая заявка', processing: '🔧 В работе',
      parts_ordered: '📦 Заказаны запчасти', parts_arrived: '✅ Запчасти прибыли',
      ready: '🎉 Готово! Можно забирать', completed: '✅ Завершено', cancelled: '❌ Отменено',
    };

    // Check if user is verified
    const { data: tgUser } = await db.from('telegram_users').select('phone').eq('chat_id', chatId).maybeSingle();
    const isVerified = !!tgUser?.phone;

    // /start — handle deep link for account linking
    if (text.startsWith('/start')) {
      const payload = text.replace('/start', '').trim();

      // Handle link_<user_id> deep link
      if (payload.startsWith('link_')) {
        const userId = payload.replace('link_', '');
        if (userId && userId.length > 10) {
          // Save telegram_chat_id to profiles and users_registry
          await db.from('profiles').update({ telegram_chat_id: chatId }).eq('user_id', userId);
          await db.from('users_registry').update({ telegram_chat_id: chatId }).eq('user_id', userId);

          // Also get phone from users_registry and update clients table
          const { data: regData } = await db.from('users_registry').select('phone, full_name').eq('user_id', userId).maybeSingle();
          if (regData?.phone) {
            await db.from('clients').upsert({
              phone: regData.phone,
              telegram_chat_id: chatId,
              telegram_username: username,
              name: regData.full_name || firstName,
            }, { onConflict: 'phone' });

            // Also update telegram_users with phone for bot verification
            await db.from('telegram_users').update({ phone: regData.phone }).eq('chat_id', chatId);
          }

          await sendMsg(
            `✅ <b>Telegram успешно привязан!</b>\n\n` +
            `Теперь вы будете получать уведомления о статусе ремонта прямо в Telegram.\n\n` +
            `/status — статус ремонта\n/history — история заказов\n/bonus — бонусные баллы`
          );
          return new Response('ok', { headers: corsHeaders });
        }
      }

      // Normal /start
      await sendMsg(`👋 Привет, <b>${firstName}</b>!\n\nЯ бот автосервиса <b>Сервис-Точка</b>.\n\n${
        isVerified
          ? '✅ Вы верифицированы.\n\n/status — статус ремонта\n/history — история заказов\n/bonus — бонусные баллы'
          : '🔐 Для доступа к истории ремонтов нажмите /verify и поделитесь номером телефона.'
      }\n\n📞 Записаться: +7 (812) 123-45-67`);
      return new Response('ok', { headers: corsHeaders });
    }

    // /verify
    if (text === '/verify') {
      if (isVerified) {
        await sendMsg('✅ Вы уже верифицированы! Используйте /status для проверки статуса ремонта.');
      } else {
        await sendContactRequest();
      }
      return new Response('ok', { headers: corsHeaders });
    }

    // /status
    if (text.startsWith('/status')) {
      const phoneArg = text.replace('/status', '').trim();
      const phone = phoneArg || tgUser?.phone;

      if (!phone) {
        await sendMsg('📞 Укажите номер телефона:\n/status +79001234567\n\nИли пройдите верификацию: /verify');
        return new Response('ok', { headers: corsHeaders });
      }

      const { data: appt } = await db.from('appointments')
        .select('*')
        .eq('phone', phone)
        .not('status', 'in', '("completed","cancelled")')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (appt) {
        const statusLabel = STATUS_LABELS[appt.status] || appt.status;
        const services = Array.isArray(appt.services) && appt.services.length > 0
          ? appt.services.map((s: { name: string }) => s.name).join(', ')
          : appt.service_type || 'Комплексный ремонт';
        await sendMsg(`🔍 <b>Статус вашего ремонта:</b>\n\n🚗 ${appt.car_make}\n🔧 ${services}\n📌 Статус: <b>${statusLabel}</b>\n\nМы уведомим вас, когда статус изменится.`);
      } else {
        await sendMsg(`ℹ️ По номеру <b>${phone}</b> активных заказов не найдено.\n\nЗапишитесь через сайт или позвоните: +7 (812) 123-45-67`);
      }
      return new Response('ok', { headers: corsHeaders });
    }

    // /history
    if (text === '/history') {
      if (!isVerified) {
        await sendMsg('🔐 Для просмотра истории пройдите верификацию: /verify');
        return new Response('ok', { headers: corsHeaders });
      }

      const { data: appts } = await db.from('appointments')
        .select('car_make, service_type, services, status, created_at')
        .eq('phone', tgUser.phone)
        .order('created_at', { ascending: false })
        .limit(5);

      if (!appts || appts.length === 0) {
        await sendMsg('📋 История заказов пуста.');
        return new Response('ok', { headers: corsHeaders });
      }

      const lines = appts.map((a: { car_make: string; service_type: string; services: unknown; status: string; created_at: string }) => {
        const date = new Date(a.created_at).toLocaleDateString('ru-RU');
        const svcArr = Array.isArray(a.services) ? a.services : [];
        const svc = svcArr.length > 0
          ? (svcArr as { name: string }[]).map((s) => s.name).join(', ')
          : a.service_type;
        return `📅 ${date} — ${a.car_make}\n   🔧 ${svc}\n   📌 ${STATUS_LABELS[a.status] || a.status}`;
      });

      await sendMsg(`📋 <b>История последних 5 заказов:</b>\n\n${lines.join('\n\n')}`);
      return new Response('ok', { headers: corsHeaders });
    }

    // /bonus
    if (text === '/bonus') {
      if (!isVerified) {
        await sendMsg('🔐 Для просмотра бонусов пройдите верификацию: /verify');
        return new Response('ok', { headers: corsHeaders });
      }

      const { data: client } = await db.from('clients').select('bonus_points, name').eq('phone', tgUser.phone).maybeSingle();
      if (client) {
        await sendMsg(`🎁 <b>Ваши бонусные баллы</b>\n\n👤 ${client.name || 'Клиент'}\n💎 Баллов: <b>${client.bonus_points}</b>\n\n1 балл = 1 рубль скидки`);
      } else {
        await sendMsg('ℹ️ Бонусный счёт не найден. Обратитесь к мастеру.');
      }
      return new Response('ok', { headers: corsHeaders });
    }

    // Default / help
    await sendMsg(`💬 <b>Доступные команды:</b>\n/start — начало\n/verify — верификация по телефону\n/status — статус ремонта\n/history — история заказов\n/bonus — бонусные баллы\n\n📞 +7 (812) 123-45-67`);

    return new Response('ok', { headers: corsHeaders });
  } catch (err) {
    console.error('Bot webhook error:', err);
    return new Response('ok', { headers: corsHeaders });
  }
});
