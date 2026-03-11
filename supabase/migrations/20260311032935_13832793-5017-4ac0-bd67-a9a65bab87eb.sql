
-- Allow authenticated users to INSERT their own record in users_registry
CREATE POLICY "Users can insert own registry"
ON public.users_registry
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to UPDATE their own record in users_registry
CREATE POLICY "Users can update own registry"
ON public.users_registry
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to SELECT their own record in users_registry
CREATE POLICY "Users can view own registry"
ON public.users_registry
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Update sync trigger to preserve phone if already set
CREATE OR REPLACE FUNCTION public.sync_profile_to_registry()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.users_registry (user_id, email, full_name, display_name, is_approved, is_blocked, telegram_chat_id, source)
  VALUES (NEW.user_id, NEW.email, NEW.full_name, NEW.display_name, NEW.is_approved, NEW.is_blocked, NEW.telegram_chat_id, 'auth')
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    display_name = EXCLUDED.display_name,
    is_approved = EXCLUDED.is_approved,
    is_blocked = EXCLUDED.is_blocked,
    telegram_chat_id = EXCLUDED.telegram_chat_id
  WHERE users_registry.user_id = EXCLUDED.user_id;
  RETURN NEW;
END;
$function$;
