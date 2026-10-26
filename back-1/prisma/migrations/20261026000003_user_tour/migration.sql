-- AlterTable
ALTER TABLE "users" ADD COLUMN "tourCompletedAt" TIMESTAMP(3);

-- Existing users already know the panel; only accounts created from now on get the guided tour.
UPDATE "users" SET "tourCompletedAt" = NOW();
