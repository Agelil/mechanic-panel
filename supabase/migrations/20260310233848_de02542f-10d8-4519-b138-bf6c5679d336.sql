
-- =============================================
-- 1. ADD FIELDS TO APPOINTMENTS (license plate, mileage)
-- =============================================
ALTER TABLE public.appointments 
  ADD COLUMN IF NOT EXISTS license_plate TEXT,
  ADD COLUMN IF NOT EXISTS mileage INTEGER,
  ADD COLUMN IF NOT EXISTS acceptance_photos JSONB DEFAULT '[]'::jsonb;

-- =============================================
-- 2. APPOINTMENT DOCUMENTS (PDF storage)
-- =============================================
CREATE TABLE IF NOT EXISTS public.appointment_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL, -- 'acceptance_act' | 'work_order' | 'completion_act'
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.appointment_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage documents"
  ON public.appointment_documents FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "Anyone can view documents"
  ON public.appointment_documents FOR SELECT
  USING (true);

-- =============================================
-- 3. REVIEWS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  phone TEXT,
  telegram_chat_id TEXT,
  client_name TEXT,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  review_requested_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage reviews"
  ON public.reviews FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "Published reviews are public"
  ON public.reviews FOR SELECT
  USING (is_published = true);

CREATE POLICY "Anyone can insert reviews"
  ON public.reviews FOR INSERT
  WITH CHECK (true);

-- =============================================
-- 4. REVIEW REQUESTS LOG (to avoid double-sending)
-- =============================================
CREATE TABLE IF NOT EXISTS public.review_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  sent BOOLEAN NOT NULL DEFAULT false,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(appointment_id)
);

ALTER TABLE public.review_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage review requests"
  ON public.review_requests FOR ALL
  USING (auth.role() = 'authenticated');

-- =============================================
-- 5. TELEGRAM AUTH TABLE (for client cabinet)
-- =============================================
CREATE TABLE IF NOT EXISTS public.telegram_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_id BIGINT NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  username TEXT,
  photo_url TEXT,
  phone TEXT,
  auth_date BIGINT NOT NULL,
  hash TEXT NOT NULL,
  session_token TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_active TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can upsert their own session"
  ON public.telegram_sessions FOR ALL
  USING (true);

-- =============================================
-- 6. SETTINGS for Yandex Maps URL and review config
-- =============================================
INSERT INTO public.settings (key, value, description) VALUES
  ('yandex_maps_url', '', 'Ссылка на страницу сервиса в Яндекс.Картах для отзывов'),
  ('review_delay_hours', '2', 'Задержка перед отправкой запроса оценки (в часах)')
ON CONFLICT (key) DO NOTHING;

-- =============================================
-- 7. STORAGE BUCKET for PDFs and acceptance photos
-- =============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('acceptance-photos', 'acceptance-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Documents are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'documents');

CREATE POLICY "Authenticated can upload documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'documents' AND auth.role() = 'authenticated');

CREATE POLICY "Acceptance photos are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'acceptance-photos');

CREATE POLICY "Authenticated can upload acceptance photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'acceptance-photos' AND auth.role() = 'authenticated');
