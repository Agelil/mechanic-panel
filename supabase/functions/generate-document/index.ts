import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const { appointment_id, doc_type } = body;

    const db = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

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

    // Load org settings
    const { data: settingsRows } = await db.from('settings').select('key, value').in('key', [
      'company_name', 'company_inn', 'company_ogrn', 'company_address', 'company_phone', 'company_city'
    ]);
    const cfg: Record<string, string> = {};
    (settingsRows || []).forEach((r: any) => { cfg[r.key] = r.value || ''; });

    const companyName = cfg.company_name || 'Сервис-Точка';
    const companyInn = cfg.company_inn || '';
    const companyOgrn = cfg.company_ogrn || '';
    const companyAddress = cfg.company_address || 'г. Санкт-Петербург';
    const companyPhone = cfg.company_phone || '';

    const dateOnly = new Date().toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' });
    const now = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
    const docNumber = `${doc_type.toUpperCase().slice(0, 2)}-${Date.now().toString().slice(-6)}`;

    const DOC_TITLES: Record<string, string> = {
      acceptance_act: 'АКТ ПРИЁМКИ АВТОМОБИЛЯ',
      work_order: 'ЗАКАЗ-НАРЯД',
      completion_act: 'АКТ ВЫПОЛНЕННЫХ РАБОТ',
    };
    const title = DOC_TITLES[doc_type] || 'ДОКУМЕНТ';

    // Use work_items for detailed breakdown, fall back to services
    const workItems: { id: string; name: string; qty: number; unit_price: number; is_part: boolean }[] =
      Array.isArray(appt.work_items) && appt.work_items.length > 0
        ? appt.work_items
        : [];

    const works = workItems.filter((w: any) => !w.is_part);
    const parts = workItems.filter((w: any) => w.is_part);

    const fmt = (n: number) => {
      return new Intl.NumberFormat('ru-RU').format(n);
    };

    const buildRows = (items: any[], startIdx: number) =>
      items.map((item: any, i: number) => {
        const lineTotal = (item.qty || 1) * (item.unit_price || 0);
        return `<tr>
          <td>${startIdx + i + 1}</td>
          <td>${item.name || '—'}</td>
          <td class="center">${item.qty || 1}</td>
          <td class="right">${fmt(item.unit_price || 0)}</td>
          <td class="right">${fmt(lineTotal)}</td>
        </tr>`;
      }).join('');

    // Fallback: if no work_items, use services array
    const fallbackServices: { name: string; price_from: number }[] =
      Array.isArray(appt.services) ? appt.services : [];

    const hasDetailedItems = works.length > 0 || parts.length > 0;

    let tableBody = '';
    if (hasDetailedItems) {
      if (works.length > 0) {
        tableBody += `<tr class="group-header"><td colspan="5">Работы</td></tr>`;
        tableBody += buildRows(works, 0);
        const worksTotal = works.reduce((s: number, w: any) => s + (w.qty || 1) * (w.unit_price || 0), 0);
        tableBody += `<tr class="subtotal"><td colspan="4">Итого работы</td><td class="right">${fmt(worksTotal)}</td></tr>`;
      }
      if (parts.length > 0) {
        tableBody += `<tr class="group-header"><td colspan="5">Запчасти и материалы</td></tr>`;
        tableBody += buildRows(parts, works.length);
        const partsTotal = parts.reduce((s: number, w: any) => s + (w.qty || 1) * (w.unit_price || 0), 0);
        tableBody += `<tr class="subtotal"><td colspan="4">Итого запчасти</td><td class="right">${fmt(partsTotal)}</td></tr>`;
      }
    } else if (fallbackServices.length > 0) {
      tableBody += fallbackServices.map((s: any, i: number) =>
        `<tr><td>${i + 1}</td><td>${s.name}</td><td class="center">1</td><td class="right">${fmt(s.price_from || 0)}</td><td class="right">${fmt(s.price_from || 0)}</td></tr>`
      ).join('');
    } else {
      tableBody = `<tr><td colspan="5" class="center" style="padding:16px;color:#999;">${appt.service_type || 'Комплексный ремонт'}</td></tr>`;
    }

    // Total price
    const totalPrice = appt.total_price || (Number(appt.services_cost || 0) + Number(appt.parts_cost || 0));

    const htmlContent = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} № ${docNumber}</title>
<style>
  @page { size: A4; margin: 15mm 20mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
    font-size: 13px;
    color: #1a1a1a;
    background: #fff;
    padding: 30px 40px;
    line-height: 1.5;
  }
  .no-print { margin-bottom: 20px; text-align: center; }
  .no-print button {
    background: #FF6B00; color: #fff; border: none; padding: 10px 32px;
    font-size: 15px; cursor: pointer; font-weight: 600; border-radius: 4px;
  }
  .no-print button:hover { background: #e05f00; }

  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #FF6B00; padding-bottom: 16px; margin-bottom: 20px; }
  .company-name { font-size: 24px; font-weight: 800; letter-spacing: 2px; }
  .company-name span { color: #FF6B00; }
  .company-sub { font-size: 11px; color: #777; margin-top: 4px; }
  .doc-title { font-size: 20px; font-weight: 700; color: #FF6B00; letter-spacing: 2px; text-align: right; }
  .doc-meta { font-size: 11px; color: #777; text-align: right; margin-top: 4px; }

  .section { margin-bottom: 18px; }
  .section-label { font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #FF6B00; font-weight: 700; border-left: 3px solid #FF6B00; padding-left: 10px; margin-bottom: 10px; }
  .fields { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .field { border: 1px solid #e0e0e0; padding: 8px 12px; }
  .field-label { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #999; margin-bottom: 2px; }
  .field-value { font-size: 13px; font-weight: 500; }

  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th { background: #f5f5f5; padding: 8px 10px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #777; border-bottom: 2px solid #ddd; }
  td { padding: 7px 10px; border-bottom: 1px solid #eee; font-size: 12px; }
  .center { text-align: center; }
  .right { text-align: right; }
  .group-header td { background: #fafafa; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #555; padding: 10px; }
  .subtotal td { font-weight: 600; border-top: 1px solid #ccc; background: #fafafa; }
  .grand-total td { font-weight: 800; font-size: 14px; background: #fff3e6; border-top: 2px solid #FF6B00; }

  .comment { background: #f9f9f9; border: 1px solid #e0e0e0; padding: 10px 14px; font-size: 12px; color: #555; }

  .signatures { display: flex; justify-content: space-between; margin-top: 40px; gap: 40px; }
  .sig-block { flex: 1; }
  .sig-line { border-bottom: 1px solid #333; height: 40px; margin-bottom: 4px; }
  .sig-label { font-size: 10px; color: #777; }
  .stamp-area { text-align: center; font-size: 10px; color: #bbb; margin-top: 10px; }

  .legal-note { margin-top: 24px; padding: 10px 14px; border: 1px solid #e0e0e0; background: #fafafa; font-size: 10px; color: #777; line-height: 1.6; }

  .footer { margin-top: 20px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 10px; color: #999; display: flex; justify-content: space-between; }

  @media print {
    body { padding: 0; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>

<div class="no-print">
  <button onclick="window.print()">🖨 Распечатать / Сохранить PDF</button>
</div>

<div class="header">
  <div>
    <div class="company-name">${companyName.replace('-', '<span>-</span>')}</div>
    <div class="company-sub">${companyAddress}${companyPhone ? ' · ' + companyPhone : ''}</div>
    ${companyInn ? `<div class="company-sub">ИНН: ${companyInn}${companyOgrn ? ' · ОГРН: ' + companyOgrn : ''}</div>` : ''}
  </div>
  <div>
    <div class="doc-title">${title}</div>
    <div class="doc-meta">№ ${docNumber} от ${dateOnly}</div>
  </div>
</div>

<div class="section">
  <div class="section-label">Данные клиента</div>
  <div class="fields">
    <div class="field">
      <div class="field-label">ФИО клиента</div>
      <div class="field-value">${appt.name || '—'}</div>
    </div>
    <div class="field">
      <div class="field-label">Телефон</div>
      <div class="field-value">${appt.phone || '—'}</div>
    </div>
  </div>
</div>

<div class="section">
  <div class="section-label">Данные автомобиля</div>
  <div class="fields">
    <div class="field">
      <div class="field-label">Марка / Модель</div>
      <div class="field-value">${appt.car_make || '—'}</div>
    </div>
    <div class="field">
      <div class="field-label">Гос. номер</div>
      <div class="field-value">${appt.license_plate || '—'}</div>
    </div>
    ${appt.car_vin ? `<div class="field"><div class="field-label">VIN</div><div class="field-value" style="font-family:monospace;letter-spacing:2px;">${appt.car_vin}</div></div>` : ''}
    ${appt.mileage ? `<div class="field"><div class="field-label">Пробег</div><div class="field-value">${fmt(appt.mileage)} км</div></div>` : ''}
  </div>
</div>

<div class="section">
  <div class="section-label">Перечень работ и запчастей</div>
  <table>
    <thead>
      <tr>
        <th style="width:35px;">№</th>
        <th>Наименование</th>
        <th style="width:50px;" class="center">Кол.</th>
        <th style="width:100px;" class="right">Цена</th>
        <th style="width:110px;" class="right">Сумма</th>
      </tr>
    </thead>
    <tbody>
      ${tableBody}
      ${totalPrice > 0 ? `<tr class="grand-total"><td colspan="4">ИТОГО К ОПЛАТЕ</td><td class="right">${fmt(totalPrice)} руб.</td></tr>` : ''}
    </tbody>
  </table>
</div>

${appt.message ? `<div class="section"><div class="section-label">Комментарий</div><div class="comment">${appt.message}</div></div>` : ''}

<div class="legal-note">
  Данный документ является основанием для оплаты и подтверждением выполненных работ.
  Гарантия на выполненные работы предоставляется в соответствии с законодательством РФ.
  Все претензии по качеству принимаются в течение гарантийного срока при условии соблюдения правил эксплуатации.
</div>

<div class="signatures">
  <div class="sig-block">
    <div style="font-size:11px;font-weight:600;margin-bottom:4px;">Исполнитель (Менеджер):</div>
    <div class="sig-line"></div>
    <div class="sig-label">Подпись / ФИО / Дата</div>
    <div class="stamp-area">М.П.</div>
  </div>
  <div class="sig-block">
    <div style="font-size:11px;font-weight:600;margin-bottom:4px;">Заказчик (Клиент):</div>
    <div class="sig-line"></div>
    <div class="sig-label">Подпись / ФИО / Дата</div>
    <div style="font-size:10px;color:#777;margin-top:8px;">Работу принял, претензий по качеству и объёму не имею.</div>
  </div>
</div>

<div class="footer">
  <span>${companyName}${companyInn ? ' · ИНН ' + companyInn : ''}${companyOgrn ? ' · ОГРН ' + companyOgrn : ''}</span>
  <span>Документ сформирован: ${now}</span>
</div>

</body>
</html>`;

    // Return HTML directly for client-side print
    return new Response(JSON.stringify({
      success: true,
      html: htmlContent,
      title: title,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
    });

  } catch (err) {
    console.error('Generate document error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
