
-- =============================================
-- 1. SERVICE CATEGORIES
-- =============================================
CREATE TABLE public.service_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categories are publicly readable"
  ON public.service_categories FOR SELECT USING (true);

CREATE POLICY "Admins can manage categories"
  ON public.service_categories FOR ALL
  USING (auth.role() = 'authenticated');

-- Add category_id FK to services
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.service_categories(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_services_category_id ON public.services(category_id);

-- =============================================
-- 2. USER ROLES & PERMISSIONS (RBAC)
-- =============================================
CREATE TYPE public.app_role AS ENUM ('admin', 'master', 'manager');

CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- Get highest role for user
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::TEXT FROM public.user_roles WHERE user_id = _user_id ORDER BY
    CASE role WHEN 'admin' THEN 1 WHEN 'manager' THEN 2 WHEN 'master' THEN 3 END
  LIMIT 1;
$$;

-- Policies for user_roles
CREATE POLICY "Admins can manage user_roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own role"
  ON public.user_roles FOR SELECT
  USING (user_id = auth.uid());

-- =============================================
-- 3. PERMISSIONS TABLE (extensible)
-- =============================================
CREATE TABLE public.role_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role public.app_role NOT NULL,
  permission TEXT NOT NULL,
  UNIQUE (role, permission)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read permissions"
  ON public.role_permissions FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage permissions"
  ON public.role_permissions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Seed default permissions
INSERT INTO public.role_permissions (role, permission) VALUES
  ('admin', 'view_dashboard'), ('admin', 'view_appointments'), ('admin', 'edit_appointments'),
  ('admin', 'view_services'), ('admin', 'edit_services'), ('admin', 'view_portfolio'),
  ('admin', 'edit_portfolio'), ('admin', 'view_promotions'), ('admin', 'edit_promotions'),
  ('admin', 'view_clients'), ('admin', 'edit_clients'), ('admin', 'view_settings'),
  ('admin', 'edit_settings'), ('admin', 'view_categories'), ('admin', 'edit_categories'),
  ('master', 'view_dashboard'), ('master', 'view_appointments'), ('master', 'edit_appointments'),
  ('manager', 'view_dashboard'), ('manager', 'view_appointments'),
  ('manager', 'view_services'), ('manager', 'edit_services'),
  ('manager', 'view_portfolio'), ('manager', 'edit_portfolio'),
  ('manager', 'view_promotions'), ('manager', 'edit_promotions'),
  ('manager', 'view_categories'), ('manager', 'edit_categories');

-- Function to check permission
CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _permission TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    INNER JOIN public.user_roles ur ON ur.role = rp.role
    WHERE ur.user_id = _user_id AND rp.permission = _permission
  );
$$;

-- =============================================
-- 4. GOOGLE SHEETS SYNC LOG
-- =============================================
CREATE TABLE public.sheets_sync_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  row_index INTEGER,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  success BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT
);

ALTER TABLE public.sheets_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view sync log"
  ON public.sheets_sync_log FOR ALL
  USING (auth.role() = 'authenticated');

-- =============================================
-- 5. SETTINGS: allow_registration & google_sheets keys
-- =============================================
INSERT INTO public.settings (key, value, description)
VALUES 
  ('allow_registration', 'false', 'Разрешить регистрацию новых пользователей'),
  ('google_sheets_id', '', 'ID Google таблицы для синхронизации заявок'),
  ('google_sheets_enabled', 'false', 'Включить синхронизацию с Google Таблицами')
ON CONFLICT (key) DO NOTHING;
