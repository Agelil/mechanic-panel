-- Add visible_to_groups column to wiki_articles
ALTER TABLE public.wiki_articles 
ADD COLUMN IF NOT EXISTS visible_to_groups text[] DEFAULT '{}';

-- Create function to check if user can view a wiki article
CREATE OR REPLACE FUNCTION public.can_view_wiki_article(_user_id uuid, _visible_to_groups text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- Empty array = visible to all
    COALESCE(array_length(_visible_to_groups, 1), 0) = 0
    -- Or user has manage_wiki permission (sees all)
    OR has_permission(_user_id, 'manage_wiki')
    -- Or user is member of one of the specified groups
    OR EXISTS (
      SELECT 1 FROM public.user_group_members ugm
      WHERE ugm.user_id = _user_id
      AND ugm.group_id::text = ANY(_visible_to_groups)
    );
$$;

-- Update RLS: replace the existing "Authenticated can read wiki" policy
DROP POLICY IF EXISTS "Authenticated can read wiki" ON public.wiki_articles;

CREATE POLICY "Authenticated can read wiki filtered by groups"
ON public.wiki_articles FOR SELECT
TO authenticated
USING (
  can_view_wiki_article(auth.uid(), visible_to_groups)
);