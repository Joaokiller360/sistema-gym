-- Syncs migrations with schema.prisma (changes previously applied only via db push).
-- Idempotent so it is safe on databases that already have some of these objects.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "AccessRequestStatus" AS ENUM ('PENDING', 'CONTACTED', 'DISMISSED', 'CONVERTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Rename snake_case column from 20260528000003_advanced_reports to match the Prisma field
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'gyms' AND column_name = 'advanced_reports_enabled')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'gyms' AND column_name = 'advancedReportsEnabled') THEN
    ALTER TABLE "gyms" RENAME COLUMN "advanced_reports_enabled" TO "advancedReportsEnabled";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'subscription_plans' AND column_name = 'advanced_reports_enabled')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'subscription_plans' AND column_name = 'advancedReportsEnabled') THEN
    ALTER TABLE "subscription_plans" RENAME COLUMN "advanced_reports_enabled" TO "advancedReportsEnabled";
  END IF;
END $$;

ALTER TABLE "gyms" DROP COLUMN IF EXISTS "advanced_reports_enabled";
ALTER TABLE "gyms" ADD COLUMN IF NOT EXISTS "advancedReportsEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "subscription_plans" DROP COLUMN IF EXISTS "advanced_reports_enabled";
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "advancedReportsEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "visibleOnLanding" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "groupId" TEXT;

-- AlterTable
ALTER TABLE "platform_settings" ADD COLUMN IF NOT EXISTS "availableSlots" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE IF NOT EXISTS "attendance_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "access_requests" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "country" VARCHAR(10),
    "callingCode" VARCHAR(8),
    "postalCode" VARCHAR(20),
    "preferredDate" TIMESTAMP(3) NOT NULL,
    "status" "AccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "convertedAt" TIMESTAMP(3),
    "convertedById" TEXT,
    "convertedGymId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "admin_communications" (
    "id" TEXT NOT NULL,
    "subject" VARCHAR(150) NOT NULL,
    "body" TEXT NOT NULL,
    "filter" VARCHAR(10) NOT NULL,
    "recipientIds" TEXT[],
    "senderName" VARCHAR(60),
    "sentById" TEXT,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_communications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "attendance_groups_gymId_idx" ON "attendance_groups"("gymId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "access_requests_status_idx" ON "access_requests"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "admin_communications_sentAt_idx" ON "admin_communications"("sentAt" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "attendances_groupId_idx" ON "attendances"("groupId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "attendances" ADD CONSTRAINT "attendances_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "attendance_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "admin_communications" ADD CONSTRAINT "admin_communications_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
