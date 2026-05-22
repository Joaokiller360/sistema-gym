-- Convertir price/amount de Decimal a Int (centavos)
-- Multiplicar x100 para preservar datos: 20.00 -> 2000

ALTER TABLE "plans"
  ALTER COLUMN "price" TYPE INTEGER USING ROUND("price" * 100)::INTEGER;

ALTER TABLE "payments"
  ALTER COLUMN "amount" TYPE INTEGER USING ROUND("amount" * 100)::INTEGER;

ALTER TABLE "subscription_plans"
  ALTER COLUMN "price" TYPE INTEGER USING ROUND("price" * 100)::INTEGER;

ALTER TABLE "gym_billing_payments"
  ALTER COLUMN "amount" TYPE INTEGER USING ROUND("amount" * 100)::INTEGER;

-- Nuevas columnas de horario
ALTER TABLE "gyms" ADD COLUMN IF NOT EXISTS "schedule" JSONB;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "accessSchedule" JSONB;
