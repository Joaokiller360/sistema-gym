-- AlterTable
ALTER TABLE "gyms" DROP COLUMN "storeEnabled";

-- AlterTable
ALTER TABLE "plans" ADD COLUMN "storeEnabled" BOOLEAN NOT NULL DEFAULT false;
