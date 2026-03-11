
-- Fix user_group_members RLS: change from RESTRICTIVE to PERMISSIVE
-- The current RESTRICTIVE policies require ALL to pass, blocking admin from seeing other users' memberships

DROP POLICY IF EXISTS "Admins manage group members" ON public.user_group_members;
DROP POLICY IF EXISTS "Users can view own membership" ON public.user_group_members;

CREATE POLICY "Admins manage group members"
  ON public.user_group_members
  FOR ALL
  TO public
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own membership"
  ON public.user_group_members
  FOR SELECT
  TO public
  USING (auth.uid() = user_id);
