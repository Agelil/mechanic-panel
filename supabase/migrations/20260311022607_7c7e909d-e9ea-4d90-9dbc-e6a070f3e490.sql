
-- Create users_registry table for admin user management
CREATE TABLE public.users_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  email text,
  full_name text,
  display_name text,
  phone text,
  telegram_chat_id text,
  is_approved boolean NOT NULL DEFAULT false,
  is_blocked boolean NOT NULL DEFAULT false,
  role text,
  source text NOT NULL DEFAULT 'auth',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.users_registry ENABLE ROW LEVEL SECURITY;

-- Admin has full access
CREATE POLICY "Admins full access to users_registry"
  ON public.users_registry FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Managers can SELECT
CREATE POLICY "Managers can view users_registry"
  ON public.users_registry FOR SELECT
  USING (public.has_role(auth.uid(), 'manager'::app_role));

-- Sync existing profiles into users_registry
INSERT INTO public.users_registry (user_id, email, full_name, display_name, is_approved, is_blocked, telegram_chat_id, source, created_at)
SELECT p.user_id, p.email, p.full_name, p.display_name, p.is_approved, p.is_blocked, p.telegram_chat_id, 'auth', p.created_at
FROM public.profiles p
ON CONFLICT (user_id) DO NOTHING;

-- Sync roles
UPDATE public.users_registry ur
SET role = (SELECT ur2.role::text FROM public.user_roles ur2 WHERE ur2.user_id = ur.user_id LIMIT 1)
WHERE ur.user_id IS NOT NULL;

-- Auto-update updated_at
CREATE TRIGGER update_users_registry_updated_at
  BEFORE UPDATE ON public.users_registry
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to sync new profiles to users_registry
CREATE OR REPLACE FUNCTION public.sync_profile_to_registry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users_registry (user_id, email, full_name, display_name, is_approved, is_blocked, telegram_chat_id, source)
  VALUES (NEW.user_id, NEW.email, NEW.full_name, NEW.display_name, NEW.is_approved, NEW.is_blocked, NEW.telegram_chat_id, 'auth')
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    display_name = EXCLUDED.display_name,
    is_approved = EXCLUDED.is_approved,
    is_blocked = EXCLUDED.is_blocked,
    telegram_chat_id = EXCLUDED.telegram_chat_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_profile_to_registry_trigger
  AFTER INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_to_registry();
