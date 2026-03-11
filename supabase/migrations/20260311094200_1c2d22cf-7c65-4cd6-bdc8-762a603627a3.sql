-- Create wiki-images storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('wiki-images', 'wiki-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload wiki images
CREATE POLICY "Authenticated can upload wiki images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'wiki-images');

-- Public read access for wiki images
CREATE POLICY "Public can view wiki images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'wiki-images');

-- Authenticated can delete wiki images
CREATE POLICY "Authenticated can delete wiki images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'wiki-images');