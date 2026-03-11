
ALTER TABLE public.portfolio
  ADD COLUMN IF NOT EXISTS car_details jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS work_list jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS mileage integer,
  ADD COLUMN IF NOT EXISTS work_duration text,
  ADD COLUMN IF NOT EXISTS parts_list jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS final_price integer,
  ADD COLUMN IF NOT EXISTS review_id uuid REFERENCES public.reviews(id) ON DELETE SET NULL;
