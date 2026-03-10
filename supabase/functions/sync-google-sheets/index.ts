import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const STATUS_LABELS: Record<string, string> = {
  new: 'Новая',
  processing: 'В работе',
  parts_ordered: 'Запчасти заказаны',
  parts_arrived: 'Запчасти прибыли',
  ready: 'Готово',
  completed: 'Завершено',
  cancelled: 'Отменено',
};

async function getGoogleAccessToken(serviceAccountKey: string): Promise<string> {
  const key = JSON.parse(serviceAccountKey);
  const now = Math.floor(Date.now() / 1000);
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }));

  // Import private key
  const pemKey = key.private_key.replace(/\\n/g, '\n');
  const binaryKey = pemToArrayBuffer(pemKey);
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  );

  const signingInput = `${header}.${payload}`;
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );
  const jwt = `${signingInput}.${btoa(String.fromCharCode(...new Uint8Array(signature)))}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, '');
  const binary = atob(b64);
  const buf = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
  return buf;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const { type, appointment } = body; // type: 'created' | 'updated'

    const db = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get settings
    const { data: settingsRows } = await db
      .from('settings')
      .select('key, value')
      .in('key', ['google_sheets_id', 'google_sheets_enabled', 'google_service_account']);

    const settings: Record<string, string> = {};
    settingsRows?.forEach((s: { key: string; value: string | null }) => {
      settings[s.key] = s.value || '';
    });

    if (settings['google_sheets_enabled'] !== 'true') {
      return new Response(JSON.stringify({ skipped: 'disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sheetId = settings['google_sheets_id'];
    const serviceAccountKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');

    if (!sheetId || !serviceAccountKey) {
      return new Response(JSON.stringify({ error: 'Missing sheet ID or service account key' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accessToken = await getGoogleAccessToken(serviceAccountKey);

    // Format appointment data as row
    const services = Array.isArray(appointment.services)
      ? appointment.services.map((s: { name: string }) => s.name).join(', ')
      : appointment.service_type || '';

    const rowData = [
      appointment.id,
      new Date(appointment.created_at).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }),
      appointment.name,
      appointment.phone,
      appointment.car_make,
      appointment.car_vin || '',
      services,
      appointment.total_price ? `${appointment.total_price.toLocaleString('ru-RU')} руб.` : '',
      STATUS_LABELS[appointment.status] || appointment.status,
      appointment.message || '',
    ];

    if (type === 'created') {
      // Append row to sheet
      const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Заявки!A:J:append?valueInputOption=USER_ENTERED`;
      const appendRes = await fetch(appendUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [rowData] }),
      });

      const appendData = await appendRes.json();
      const updatedRange = appendData.updates?.updatedRange;

      // Log sync
      await db.from('sheets_sync_log').insert({
        appointment_id: appointment.id,
        action: 'created',
        success: appendRes.ok,
        error_message: appendRes.ok ? null : JSON.stringify(appendData),
      });

      return new Response(JSON.stringify({ success: appendRes.ok, range: updatedRange }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (type === 'updated') {
      // Find existing row by appointment ID in column A, then update status (column I)
      const findUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Заявки!A:A`;
      const findRes = await fetch(findUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      const findData = await findRes.json();
      const rows: string[][] = findData.values || [];
      const rowIndex = rows.findIndex((r: string[]) => r[0] === appointment.id);

      if (rowIndex > 0) {
        // Update entire row (rowIndex is 0-based, sheets is 1-based, add 1 for header)
        const sheetRow = rowIndex + 1;
        const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Заявки!A${sheetRow}:J${sheetRow}?valueInputOption=USER_ENTERED`;
        const updateRes = await fetch(updateUrl, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values: [rowData] }),
        });

        const updateData = await updateRes.json();
        await db.from('sheets_sync_log').insert({
          appointment_id: appointment.id,
          action: 'updated',
          row_index: sheetRow,
          success: updateRes.ok,
          error_message: updateRes.ok ? null : JSON.stringify(updateData),
        });

        return new Response(JSON.stringify({ success: updateRes.ok, row: sheetRow }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else {
        // Row not found, append instead
        const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Заявки!A:J:append?valueInputOption=USER_ENTERED`;
        await fetch(appendUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values: [rowData] }),
        });

        return new Response(JSON.stringify({ success: true, note: 'appended_as_not_found' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ error: 'unknown_type' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Sheets sync error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
