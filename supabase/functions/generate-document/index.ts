import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Simple HTML-to-PDF via a base64 encoded template
// We generate HTML and convert to PDF using a simple approach
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const { appointment_id, doc_type } = body;
    // doc_type: 'acceptance_act' | 'work_order' | 'completion_act'

    const db = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get appointment data
    const { data: appt, error: apptError } = await db
      .from('appointments')
      .select('*')
      .eq('id', appointment_id)
      .maybeSingle();

    if (apptError || !appt) {
      return new Response(JSON.stringify({ error: 'Appointment not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const now = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
    const dateOnly = new Date().toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' });

    const services = Array.isArray(appt.services) ? appt.services as { name: string; price_from: number; price_to?: number }[] : [];

    const DOC_TITLES: Record<string, string> = {
      acceptance_act: 'АКТ ПРИЁМКИ АВТОМОБИЛЯ',
      work_order: 'ЗАКАЗ-НАРЯД',
      completion_act: 'АКТ ВЫПОЛНЕННЫХ РАБОТ',
    };

    const title = DOC_TITLES[doc_type] || 'ДОКУМЕНТ';
    const docNumber = `${doc_type.toUpperCase().slice(0, 2)}-${Date.now().toString().slice(-6)}`;

    const servicesRows = services.length > 0
      ? services.map((s, i) =>
          `<tr>
            <td style="padding:8px 12px;border-bottom:1px solid #2a2a2a;font-size:13px;">${i + 1}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #2a2a2a;font-size:13px;">${s.name}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #2a2a2a;font-size:13px;text-align:right;">${s.price_from.toLocaleString('ru-RU')} руб.</td>
          </tr>`
        ).join('')
      : `<tr><td colspan="3" style="padding:12px;text-align:center;color:#888;font-size:13px;">${appt.service_type || 'Комплексный ремонт'}</td></tr>`;

    const total = appt.total_price
      ? `<tr style="background:#1a1a1a;">
           <td colspan="2" style="padding:10px 12px;font-weight:bold;font-size:14px;">ИТОГО</td>
           <td style="padding:10px 12px;text-align:right;color:#FF6B00;font-weight:bold;font-size:14px;">${appt.total_price.toLocaleString('ru-RU')} руб.</td>
         </tr>`
      : '';

    const signatureBlock = doc_type === 'acceptance_act'
      ? `<div style="margin-top:40px;display:flex;gap:60px;">
           <div>
             <div style="border-top:1px solid #555;padding-top:8px;font-size:12px;color:#888;">Мастер-приёмщик</div>
           </div>
           <div>
             <div style="border-top:1px solid #555;padding-top:8px;font-size:12px;color:#888;">Клиент (подпись / дата)</div>
           </div>
         </div>`
      : `<div style="margin-top:40px;display:flex;gap:60px;">
           <div>
             <div style="border-top:1px solid #555;padding-top:8px;font-size:12px;color:#888;">Исполнитель</div>
           </div>
           <div>
             <div style="border-top:1px solid #555;padding-top:8px;font-size:12px;color:#888;">Заказчик (подпись / дата)</div>
           </div>
         </div>`;

    const htmlContent = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width"/>
<title>${title}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0a0a0a; color: #f5f5f5; font-family: 'Arial', sans-serif; padding: 40px; }
  .header { border-bottom: 3px solid #FF6B00; padding-bottom: 20px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-start; }
  .logo { font-size: 32px; font-weight: 900; letter-spacing: 4px; color: #f5f5f5; }
  .logo span { color: #FF6B00; }
  .doc-title { font-size: 22px; font-weight: 700; letter-spacing: 3px; color: #FF6B00; margin-top: 16px; }
  .doc-number { font-size: 12px; color: #888; font-family: monospace; margin-top: 4px; }
  .section { margin-bottom: 24px; }
  .section-title { font-size: 11px; color: #FF6B00; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 12px; border-left: 3px solid #FF6B00; padding-left: 10px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .field { background: #111; padding: 10px 14px; }
  .field-label { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
  .field-value { font-size: 14px; font-weight: 500; }
  table { width: 100%; border-collapse: collapse; background: #0f0f0f; }
  th { background: #1a1a1a; padding: 10px 12px; text-align: left; font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; }
  .footer { margin-top: 30px; padding-top: 16px; border-top: 1px solid #2a2a2a; font-size: 11px; color: #555; }
  .highlight { color: #FF6B00; font-weight: bold; }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="logo">СЕРВИС<span>-</span>ТОЧКА</div>
    <div style="font-size:11px;color:#888;margin-top:6px;font-family:monospace;">г. Санкт-Петербург · +7 (812) 123-45-67</div>
  </div>
  <div style="text-align:right;">
    <div class="doc-title">${title}</div>
    <div class="doc-number">№ ${docNumber} · ${dateOnly}</div>
  </div>
</div>

<div class="section">
  <div class="section-title">Данные клиента</div>
  <div class="grid">
    <div class="field">
      <div class="field-label">ФИО клиента</div>
      <div class="field-value">${appt.name}</div>
    </div>
    <div class="field">
      <div class="field-label">Телефон</div>
      <div class="field-value">${appt.phone}</div>
    </div>
  </div>
</div>

<div class="section">
  <div class="section-title">Данные автомобиля</div>
  <div class="grid">
    <div class="field">
      <div class="field-label">Марка / Модель</div>
      <div class="field-value">${appt.car_make}</div>
    </div>
    <div class="field">
      <div class="field-label">Гос. номер</div>
      <div class="field-value">${appt.license_plate || '—'}</div>
    </div>
    ${appt.car_vin ? `<div class="field">
      <div class="field-label">VIN</div>
      <div class="field-value" style="font-family:monospace;letter-spacing:2px;">${appt.car_vin}</div>
    </div>` : ''}
    ${appt.mileage ? `<div class="field">
      <div class="field-label">Пробег</div>
      <div class="field-value">${appt.mileage.toLocaleString('ru-RU')} км</div>
    </div>` : ''}
  </div>
</div>

<div class="section">
  <div class="section-title">Перечень работ / услуг</div>
  <table>
    <thead>
      <tr>
        <th style="width:40px;">№</th>
        <th>Наименование работ</th>
        <th style="width:150px;text-align:right;">Стоимость</th>
      </tr>
    </thead>
    <tbody>
      ${servicesRows}
      ${total}
    </tbody>
  </table>
</div>

${appt.message ? `<div class="section">
  <div class="section-title">Комментарий</div>
  <div style="background:#111;padding:12px;font-size:13px;color:#ccc;">${appt.message}</div>
</div>` : ''}

${signatureBlock}

<div class="footer">
  <span class="highlight">Сервис-Точка</span> · Санкт-Петербург · Документ сформирован: ${now} МСК
</div>
</body>
</html>`;

    // Save HTML as a document (we'll use client-side jsPDF to convert)
    // For server-side, we save the HTML and return it for client rendering
    const fileName = `${doc_type}_${appointment_id.slice(-6)}_${Date.now()}.html`;
    const htmlBytes = new TextEncoder().encode(htmlContent);

    const { error: uploadError } = await db.storage
      .from('documents')
      .upload(fileName, htmlBytes, {
        contentType: 'text/html',
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = db.storage.from('documents').getPublicUrl(fileName);

    // Save document record
    const { data: docRecord } = await db
      .from('appointment_documents')
      .insert({
        appointment_id,
        doc_type,
        file_url: publicUrl,
        file_name: DOC_TITLES[doc_type] || title,
      })
      .select()
      .single();

    // Send document link via Telegram if client has telegram
    const { data: tgUser } = await db
      .from('telegram_users')
      .select('chat_id, phone')
      .eq('phone', appt.phone)
      .maybeSingle();

    if (tgUser?.chat_id) {
      const { data: settings } = await db.from('settings').select('key, value').eq('key', 'telegram_bot_token').maybeSingle();
      const botToken = settings?.value;
      if (botToken) {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: tgUser.chat_id,
            text: `📄 <b>${DOC_TITLES[doc_type]}</b>\n\nДля вашего автомобиля <b>${appt.car_make}</b> создан документ.\n\n<a href="${publicUrl}">📎 Открыть документ</a>`,
            parse_mode: 'HTML',
          }),
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      document: docRecord,
      file_url: publicUrl,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Generate document error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
