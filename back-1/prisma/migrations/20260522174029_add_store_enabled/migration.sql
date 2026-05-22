-- AlterTable
ALTER TABLE "gyms" ADD COLUMN     "storeEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "subscription_plans" ADD COLUMN     "storeEnabled" BOOLEAN NOT NULL DEFAULT false;
