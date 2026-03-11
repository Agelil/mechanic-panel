
-- Create bonus_transactions table for auditing all bonus operations
CREATE TABLE public.bonus_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  amount integer NOT NULL,
  type text NOT NULL CHECK (type IN ('accrual', 'spend', 'manual_add', 'manual_deduct', 'cancel')),
  description text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bonus_transactions ENABLE ROW LEVEL SECURITY;

-- Admins and managers can do everything
CREATE POLICY "Admins can manage bonus_transactions"
  ON public.bonus_transactions FOR ALL
  TO public
  USING (auth.role() = 'authenticated');

-- Insert initial settings for bonus system
INSERT INTO public.settings (key, value, description)
VALUES
  ('bonus_percentage', '5', 'Процент начисления бонусов от суммы чека'),
  ('max_bonus_payment_percentage', '30', 'Максимальный % суммы чека, который можно оплатить бонусами')
ON CONFLICT (key) DO NOTHING;
