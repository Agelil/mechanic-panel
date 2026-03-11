-- Fix 1: Bootstrap RLS — allow users to insert their own role IF no admins exist yet
CREATE OR REPLACE FUNCTION public.admin_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer FROM public.user_roles WHERE role = 'admin';
$$;

-- Update user_roles policy: keep admin management, add bootstrap
DROP POLICY IF EXISTS "Admins can manage user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Bootstrap first admin" ON public.user_roles;

CREATE POLICY "Admins can manage user_roles"
ON public.user_roles
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow any authenticated user to set themselves as admin when no admins exist yet
CREATE POLICY "Bootstrap first admin"
ON public.user_roles
FOR INSERT
WITH CHECK (auth.uid() = user_id AND public.admin_count() = 0);

-- Fix 2: Expand settings with site config defaults
INSERT INTO public.settings (key, value, description)
VALUES
  ('site_name',         'Сервис-Точка',         'Название автосервиса'),
  ('site_phone',        '+7 (999) 000-00-00',   'Основной телефон'),
  ('site_phone_2',      '',                      'Дополнительный телефон'),
  ('site_address',      'г. Москва, ул. Примерная, 1', 'Адрес сервиса'),
  ('site_email',        '',                      'Email для связи'),
  ('site_hours',        'Пн-Сб: 9:00–19:00',    'Режим работы'),
  ('site_hours_sun',    'Вс: выходной',          'Режим работы в воскресенье'),
  ('social_vk',         '',                      'Ссылка ВКонтакте'),
  ('social_instagram',  '',                      'Ссылка Instagram'),
  ('social_whatsapp',   '',                      'Номер WhatsApp (только цифры, с кодом страны)'),
  ('social_telegram_channel', '',               'Ссылка на Telegram-канал'),
  ('yandex_maps_url',   '',                      'Ссылка на Яндекс.Карты для отзывов'),
  ('module_reviews',    'true',                  'Показывать раздел Отзывы на сайте'),
  ('module_portfolio',  'true',                  'Показывать раздел Портфолио на сайте'),
  ('module_booking',    'true',                  'Разрешить онлайн-запись'),
  ('module_cabinet',    'true',                  'Включить личный кабинет клиента'),
  ('telegram_bot_username', '',                  'Username бота без @ (для Telegram Login Widget)'),
  ('meta_description',  'Профессиональный автосервис. Быстро, надёжно, с гарантией.', 'SEO-описание сайта'),
  ('meta_keywords',     'автосервис, ремонт авто, шиномонтаж',  'SEO-ключевые слова')
ON CONFLICT (key) DO NOTHING;