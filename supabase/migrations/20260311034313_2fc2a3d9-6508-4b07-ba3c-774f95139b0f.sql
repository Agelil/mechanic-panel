
-- Create customer_cars table
CREATE TABLE public.customer_cars (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  brand_model TEXT NOT NULL,
  vin TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customer_cars ENABLE ROW LEVEL SECURITY;

-- Client can CRUD own cars
CREATE POLICY "Users can view own cars"
  ON public.customer_cars FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cars"
  ON public.customer_cars FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cars"
  ON public.customer_cars FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own cars"
  ON public.customer_cars FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can manage all cars
CREATE POLICY "Admins can manage all cars"
  ON public.customer_cars FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
