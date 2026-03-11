
-- Extend role_permissions with all granular action permissions
-- First clear existing role_permissions to re-seed cleanly
TRUNCATE public.role_permissions;

-- ── ADMIN: full access ────────────────────────────────────────────
INSERT INTO public.role_permissions (role, permission) VALUES
-- Dashboard
('admin', 'view_dashboard'),
-- Appointments
('admin', 'view_appointments'),
('admin', 'edit_appointments'),
('admin', 'delete_appointments'),
('admin', 'view_appointment_price'),
('admin', 'edit_appointment_status'),
('admin', 'edit_appointment_services'),
-- Supply
('admin', 'view_supply'),
('admin', 'create_supply_order'),
('admin', 'edit_supply_order'),
('admin', 'delete_supply_order'),
('admin', 'approve_supply_order'),
-- Services & Categories
('admin', 'view_services'),
('admin', 'edit_services'),
('admin', 'delete_services'),
('admin', 'edit_service_price'),
('admin', 'view_categories'),
('admin', 'edit_categories'),
('admin', 'delete_categories'),
-- Portfolio
('admin', 'view_portfolio'),
('admin', 'edit_portfolio'),
('admin', 'delete_portfolio'),
('admin', 'publish_portfolio'),
-- Promotions
('admin', 'view_promotions'),
('admin', 'edit_promotions'),
('admin', 'delete_promotions'),
-- Clients
('admin', 'view_clients'),
('admin', 'edit_clients'),
('admin', 'delete_clients'),
('admin', 'view_client_history'),
-- Reviews
('admin', 'view_reviews'),
('admin', 'edit_reviews'),
('admin', 'publish_reviews'),
('admin', 'delete_reviews'),
-- Users & Access
('admin', 'view_users'),
('admin', 'edit_users'),
('admin', 'approve_user'),
('admin', 'block_user'),
('admin', 'assign_role'),
-- Settings
('admin', 'view_settings'),
('admin', 'edit_settings'),
('admin', 'edit_contacts'),
('admin', 'edit_telegram_settings'),
('admin', 'edit_integrations'),
-- System
('admin', 'view_system'),
('admin', 'view_audit_log'),
-- Groups
('admin', 'view_groups'),
('admin', 'edit_groups'),
('admin', 'delete_groups'),
-- Permissions matrix
('admin', 'view_permissions'),
('admin', 'edit_permissions'),
-- Revenue
('admin', 'view_revenue'),
('admin', 'view_prices');

-- ── MANAGER: operations without destructive/financial admin ──────
INSERT INTO public.role_permissions (role, permission) VALUES
('manager', 'view_dashboard'),
('manager', 'view_appointments'),
('manager', 'edit_appointments'),
('manager', 'edit_appointment_status'),
('manager', 'edit_appointment_services'),
('manager', 'view_appointment_price'),
('manager', 'view_supply'),
('manager', 'create_supply_order'),
('manager', 'edit_supply_order'),
('manager', 'approve_supply_order'),
('manager', 'view_services'),
('manager', 'edit_services'),
('manager', 'edit_service_price'),
('manager', 'view_categories'),
('manager', 'edit_categories'),
('manager', 'view_portfolio'),
('manager', 'edit_portfolio'),
('manager', 'publish_portfolio'),
('manager', 'view_promotions'),
('manager', 'edit_promotions'),
('manager', 'view_clients'),
('manager', 'edit_clients'),
('manager', 'view_client_history'),
('manager', 'view_reviews'),
('manager', 'publish_reviews'),
('manager', 'view_users'),
('manager', 'view_settings'),
('manager', 'view_revenue'),
('manager', 'view_prices');

-- ── MASTER: view + own work only ─────────────────────────────────
INSERT INTO public.role_permissions (role, permission) VALUES
('master', 'view_dashboard'),
('master', 'view_appointments'),
('master', 'edit_appointment_status'),
('master', 'view_supply'),
('master', 'create_supply_order');
