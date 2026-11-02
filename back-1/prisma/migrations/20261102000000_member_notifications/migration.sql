-- Plan-level limits for gym → member notifications
ALTER TABLE "subscription_plans" ADD COLUMN "monthlyAnnouncementLimit" INTEGER DEFAULT 0;
ALTER TABLE "subscription_plans" ADD COLUMN "birthdayMessagesEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "subscription_plans" ADD COLUMN "expiryRemindersEnabled" BOOLEAN NOT NULL DEFAULT true;

-- Gym announcements sent to members (closures, holidays, renovations...)
ALTER TABLE "communications" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'GENERAL';
ALTER TABLE "communications" ADD COLUMN "sentCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "communications" ADD COLUMN "failedCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "communications" ADD COLUMN "sentById" TEXT;

CREATE INDEX "communications_gymId_sentAt_idx" ON "communications"("gymId", "sentAt");
