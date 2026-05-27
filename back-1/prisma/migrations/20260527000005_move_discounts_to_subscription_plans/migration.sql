ALTER TABLE "plans" DROP COLUMN IF EXISTS "discountPercent";
ALTER TABLE "plans" DROP COLUMN IF EXISTS "discountActive";
ALTER TABLE "plans" DROP COLUMN IF EXISTS "yearlyPrice";

ALTER TABLE "subscription_plans" ADD COLUMN "discountPercent" INTEGER;
ALTER TABLE "subscription_plans" ADD COLUMN "discountActive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "subscription_plans" ADD COLUMN "yearlyPrice" INTEGER;
