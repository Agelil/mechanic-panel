
-- ============================================
-- СЕРВИС-ТОЧКА v2: Extended Schema
-- ============================================

-- 1. PROMOTIONS TABLE
CREATE TABLE public.promotions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  discount_value TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Promotions are publicly readable" ON public.promotions
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage promotions" ON public.promotions
  FOR ALL USING (auth.role() = 'authenticated');

-- 2. CLIENTS TABLE
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  name TEXT,
  car_history JSONB DEFAULT '[]'::jsonb,
  bonus_points INTEGER NOT NULL DEFAULT 0,
  telegram_chat_id TEXT,
  telegram_username TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage clients" ON public.clients
  FOR ALL USING (auth.role() = 'authenticated');

-- 3. TELEGRAM_USERS TABLE (for bot subscribers/broadcast)
CREATE TABLE public.telegram_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id TEXT NOT NULL UNIQUE,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage telegram users" ON public.telegram_users
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Anyone can insert telegram users" ON public.telegram_users
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update telegram users" ON public.telegram_users
  FOR UPDATE USING (true);

-- 4. EXTEND APPOINTMENTS TABLE
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS services JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS total_price INTEGER,
  ADD COLUMN IF NOT EXISTS car_vin TEXT,
  ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS client_notified BOOLEAN NOT NULL DEFAULT false;

-- Update status constraint to include new values
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_status_check
  CHECK (status IN ('new', 'processing', 'parts_ordered', 'parts_arrived', 'ready', 'completed', 'cancelled'));

-- 5. TRIGGERS
CREATE TRIGGER update_promotions_updated_at
  BEFORE UPDATE ON public.promotions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. STORAGE for appointment photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('appointment-photos', 'appointment-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Appointment photos are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'appointment-photos');

CREATE POLICY "Authenticated users can upload appointment photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'appointment-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete appointment photos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'appointment-photos' AND auth.role() = 'authenticated');

-- 7. Add notification_type to settings
INSERT INTO public.settings (key, value, description) VALUES
  ('notification_type', 'both', 'Тип уведомлений: master (мастеру), client (клиенту), both (обоим)')
ON CONFLICT (key) DO NOTHING;

-- 8. SEED SAMPLE PROMOTIONS
INSERT INTO public.promotions (title, description, discount_value, is_active) VALUES
  ('ТО со скидкой 20%', 'Пройдите техническое обслуживание автомобиля со скидкой 20% до конца месяца. Включает замену масла, фильтров и диагностику.', '20%', true),
  ('Бесплатная диагностика', 'При любом ремонте на сумму от 5 000 руб. — компьютерная диагностика в подарок.', 'Бесплатно', true),
  ('Шиномонтаж 4 = цена 3', 'При замене 4 шин — стоимость монтажа и балансировки 4-й в подарок. Акция действует каждую пятницу.', '25%', true)
ON CONFLICT DO NOTHING;
