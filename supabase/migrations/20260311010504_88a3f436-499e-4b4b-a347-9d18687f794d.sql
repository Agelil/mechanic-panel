-- Add work_items column to appointments for detailed work/service line items with qty and unit price
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS work_items jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Add separate cost breakdown fields
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS parts_cost integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS services_cost integer NOT NULL DEFAULT 0;
