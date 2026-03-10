
-- ============================================================
-- 1. USER_GROUPS table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_groups (
  id              UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT,
  telegram_chat_id TEXT,
  permissions     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage groups"
  ON public.user_groups FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can read groups"
  ON public.user_groups FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE TRIGGER update_user_groups_updated_at
  BEFORE UPDATE ON public.user_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. USER_GROUP_MEMBERS linking table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_group_members (
  id          UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL,
  group_id    UUID NOT NULL REFERENCES public.user_groups(id) ON DELETE CASCADE,
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, group_id)
);

ALTER TABLE public.user_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage group members"
  ON public.user_group_members FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own membership"
  ON public.user_group_members FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================
-- 3. Update profiles: add telegram_chat_id and display_name
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT,
  ADD COLUMN IF NOT EXISTS display_name TEXT;

-- ============================================================
-- 4. ENUM types (safe creation)
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.supply_type AS ENUM ('part', 'tool', 'consumable');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.supply_urgency AS ENUM ('urgent', 'planned');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.supply_status AS ENUM ('pending', 'approved', 'ordered', 'received', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 5. SUPPLY_ORDERS table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.supply_orders (
  id              UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  master_id       UUID,
  master_name     TEXT NOT NULL,
  supply_type     public.supply_type NOT NULL DEFAULT 'part',
  item_name       TEXT NOT NULL,
  quantity        INTEGER NOT NULL DEFAULT 1,
  unit            TEXT DEFAULT 'шт.',
  urgency         public.supply_urgency NOT NULL DEFAULT 'planned',
  appointment_id  UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  notes           TEXT,
  status          public.supply_status NOT NULL DEFAULT 'pending',
  notified        BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.supply_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can insert supply orders"
  ON public.supply_orders FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Masters view own, admins view all supply orders"
  ON public.supply_orders FOR SELECT
  USING (
    master_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  );

CREATE POLICY "Admins update supply orders"
  ON public.supply_orders FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR master_id = auth.uid()
  );

CREATE TRIGGER update_supply_orders_updated_at
  BEFORE UPDATE ON public.supply_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 6. Seed default groups
-- ============================================================
INSERT INTO public.user_groups (name, description, permissions) VALUES
(
  'Администраторы',
  'Полный доступ ко всем функциям системы',
  '{"notify_new_appointments":true,"notify_status_changes":true,"notify_supply_orders":true,"view_prices":true,"edit_prices":true,"manage_users":true}'::jsonb
),
(
  'Мастера',
  'Работа с заявками, фото приёмки, заявки на снабжение',
  '{"notify_new_appointments":true,"notify_status_changes":false,"notify_supply_orders":false,"view_prices":false,"edit_prices":false,"manage_users":false}'::jsonb
),
(
  'Снабженцы',
  'Получение уведомлений о заявках на запчасти и инструменты',
  '{"notify_new_appointments":false,"notify_status_changes":false,"notify_supply_orders":true,"view_prices":true,"edit_prices":false,"manage_users":false}'::jsonb
)
ON CONFLICT DO NOTHING;
