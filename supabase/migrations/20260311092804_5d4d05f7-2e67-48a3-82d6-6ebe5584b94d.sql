
-- Add scheduled_at for calendar positioning and is_paid for payment tracking
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS scheduled_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS is_paid boolean NOT NULL DEFAULT false;
