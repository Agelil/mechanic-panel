
-- ============================================================
-- 1. PROFILES TABLE (with approval status for access control)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL UNIQUE,
  email         TEXT,
  full_name     TEXT,
  is_approved   BOOLEAN NOT NULL DEFAULT false,
  is_blocked    BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins and managers can manage all profiles"
  ON public.profiles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. SECURITY AUDIT LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id            UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID,
  user_email    TEXT,
  action        TEXT NOT NULL,
  target_table  TEXT,
  target_id     TEXT,
  ip_address    TEXT,
  details       JSONB,
  created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit log"
  ON public.security_audit_log FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can insert audit log"
  ON public.security_audit_log FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================================
-- 3. FUNCTION: auto-create profile on user signup (auth trigger)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, is_approved, is_blocked)
  VALUES (
    NEW.id,
    NEW.email,
    false,
    false
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ============================================================
-- 4. FUNCTION: check if user is approved
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_user_approved(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_approved AND NOT is_blocked FROM public.profiles WHERE user_id = _user_id),
    false
  );
$$;

-- ============================================================
-- 5. Pre-approve existing users who already have roles
-- ============================================================
INSERT INTO public.profiles (user_id, email, is_approved, is_blocked)
SELECT 
  ur.user_id,
  NULL,
  true,
  false
FROM public.user_roles ur
ON CONFLICT (user_id) DO UPDATE SET is_approved = true;
