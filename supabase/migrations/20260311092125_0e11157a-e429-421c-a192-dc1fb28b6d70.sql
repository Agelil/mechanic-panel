
-- Create storage bucket for order documents
INSERT INTO storage.buckets (id, name, public) VALUES ('order-documents', 'order-documents', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for the bucket
CREATE POLICY "Authenticated users can upload order documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'order-documents');

CREATE POLICY "Authenticated users can view order documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'order-documents');

CREATE POLICY "Authenticated users can delete order documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'order-documents');

-- Add DELETE policy to appointment_documents for cleanup
CREATE POLICY "Admins can delete documents"
ON public.appointment_documents FOR DELETE TO authenticated
USING (auth.role() = 'authenticated');
