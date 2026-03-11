
-- Allow anyone to read settings (needed for public features like allow_registration)
CREATE POLICY "Settings are publicly readable"
  ON public.settings
  FOR SELECT
  TO public
  USING (true);
