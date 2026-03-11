import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SiteSettings {
  site_name: string;
  site_phone: string;
  site_phone_2: string;
  site_address: string;
  site_email: string;
  site_hours: string;
  site_hours_sun: string;
  social_vk: string;
  social_telegram_channel: string;
  social_instagram: string;
  social_whatsapp: string;
  module_booking: boolean;
  module_reviews: boolean;
  module_portfolio: boolean;
  module_cabinet: boolean;
  allow_registration: boolean;
  meta_description: string;
  meta_keywords: string;
  yandex_maps_url: string;
}

const DEFAULTS: SiteSettings = {
  site_name: "Сервис-Точка",
  site_phone: "+7 (812) 123-45-67",
  site_phone_2: "",
  site_address: "Санкт-Петербург, ул. Примерная, 42",
  site_email: "",
  site_hours: "Пн–Сб: 9:00–20:00",
  site_hours_sun: "Вс: выходной",
  social_vk: "",
  social_telegram_channel: "",
  social_instagram: "",
  social_whatsapp: "",
  module_booking: true,
  module_reviews: true,
  module_portfolio: true,
  module_cabinet: true,
  allow_registration: true,
  meta_description: "Профессиональный автосервис. Быстро, надёжно, с гарантией.",
  meta_keywords: "автосервис, ремонт авто",
  yandex_maps_url: "",
};

// Singleton cache
let cachedSettings: SiteSettings | null = null;
let fetchPromise: Promise<SiteSettings> | null = null;

async function fetchSettings(): Promise<SiteSettings> {
  if (fetchPromise) return fetchPromise;
  const promise = new Promise<SiteSettings>((resolve) => {
    supabase
      .from("settings")
      .select("key, value")
      .then(({ data }) => {
        const result = { ...DEFAULTS };
        if (data) {
          data.forEach(({ key, value }) => {
            if (value === null || value === undefined) return;
            const k = key as keyof SiteSettings;
            if (typeof DEFAULTS[k] === "boolean") {
              (result as Record<string, unknown>)[k] = value === "true" || value === "1";
            } else {
              (result as Record<string, unknown>)[k] = value;
            }
          });
        }
        cachedSettings = result;
        fetchPromise = null;
        resolve(result);
      });
  });
  fetchPromise = promise;
  return promise;
}

export function useSiteSettings() {
  const [settings, setSettings] = useState<SiteSettings>(cachedSettings ?? DEFAULTS);
  const [loading, setLoading] = useState(!cachedSettings);

  useEffect(() => {
    if (cachedSettings) {
      setSettings(cachedSettings);
      setLoading(false);
      return;
    }
    fetchSettings().then((s) => {
      setSettings(s);
      setLoading(false);
    });
  }, []);

  return { settings, loading };
}

// Invalidate cache (called after settings save)
export function invalidateSiteSettingsCache() {
  cachedSettings = null;
  fetchPromise = null;
}
