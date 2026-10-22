ALTER TABLE "plans" DROP COLUMN IF EXISTS "discountPercent";
ALTER TABLE "plans" DROP COLUMN IF EXISTS "discountActive";
ALTER TABLE "plans" DROP COLUMN IF EXISTS "yearlyPrice";

ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "discountPercent" INTEGER;
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "discountActive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "yearlyPrice" INTEGER;
