
CREATE TABLE public.wiki_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'Общее',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wiki_articles ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read
CREATE POLICY "Authenticated can read wiki"
  ON public.wiki_articles FOR SELECT
  TO authenticated
  USING (true);

-- Admins and users with manage_wiki permission can do everything
CREATE POLICY "Admins manage wiki"
  ON public.wiki_articles FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers manage wiki"
  ON public.wiki_articles FOR ALL
  TO authenticated
  USING (has_permission(auth.uid(), 'manage_wiki'))
  WITH CHECK (has_permission(auth.uid(), 'manage_wiki'));

-- Update timestamp trigger
CREATE TRIGGER update_wiki_articles_updated_at
  BEFORE UPDATE ON public.wiki_articles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
