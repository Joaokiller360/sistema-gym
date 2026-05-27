ALTER TABLE "plans" ADD COLUMN "discountPercent" INTEGER;
ALTER TABLE "plans" ADD COLUMN "discountActive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "plans" ADD COLUMN "yearlyPrice" INTEGER;
