
-- Clean up encrypted test data that can't be decrypted (key lost)
-- Replace enc:v1: prefixed values with data from the clients table where possible,
-- or with placeholder for truly lost records

-- First, update the two completed appointments linked to client "Иван Иванов" (+79992220505)
UPDATE public.appointments 
SET name = 'Иван Иванов', phone = '+79992220505'
WHERE client_id = 'a62ef49b-e7a3-4b7d-9c6a-04ed92fd9b05'
  AND name LIKE 'enc:v1:%';

-- For all remaining encrypted records (test data with lost keys), 
-- set readable placeholder values
UPDATE public.appointments
SET name = 'Тест (данные утеряны)', phone = '+70000000000'
WHERE name LIKE 'enc:v1:%';
