
-- Create is_owner function that checks by email
CREATE OR REPLACE FUNCTION public.is_owner(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = _user_id AND email = 'maxfor1997@gmail.com'
  );
$$;

-- Harden user_groups: only owner can INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "Admins manage groups" ON public.user_groups;

CREATE POLICY "Owner can manage groups"
ON public.user_groups
FOR ALL
TO authenticated
USING (public.is_owner(auth.uid()))
WITH CHECK (public.is_owner(auth.uid()));

-- Keep read access for authenticated
-- (already exists: "Authenticated can read groups")

-- Harden user_roles: only owner can manage
DROP POLICY IF EXISTS "Admins can manage user_roles" ON public.user_roles;

CREATE POLICY "Owner can manage user_roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.is_owner(auth.uid()))
WITH CHECK (public.is_owner(auth.uid()));

-- Keep bootstrap and self-view policies (already exist)

-- Harden role_permissions: only owner can manage
DROP POLICY IF EXISTS "Admins can manage permissions" ON public.role_permissions;

CREATE POLICY "Owner can manage permissions"
ON public.role_permissions
FOR ALL
TO authenticated
USING (public.is_owner(auth.uid()))
WITH CHECK (public.is_owner(auth.uid()));

-- Keep read access (already exists: "Authenticated can read permissions")

-- Harden users_registry: only owner full access (replace admin-only)
DROP POLICY IF EXISTS "Admins full access to users_registry" ON public.users_registry;

CREATE POLICY "Owner full access to users_registry"
ON public.users_registry
FOR ALL
TO authenticated
USING (public.is_owner(auth.uid()))
WITH CHECK (public.is_owner(auth.uid()));

-- Allow admins (non-owner) to still read and update users_registry
CREATE POLICY "Admins can read and update users_registry"
ON public.users_registry
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins can update users_registry"
ON public.users_registry
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
