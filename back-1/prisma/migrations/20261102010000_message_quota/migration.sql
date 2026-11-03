-- Security audit fix: the monthly quota counts WhatsApp messages (one per recipient), not announcements
ALTER TABLE "subscription_plans" RENAME COLUMN "monthlyAnnouncementLimit" TO "monthlyMessageLimit";

ALTER TABLE "communications" ADD COLUMN "recipientCount" INTEGER NOT NULL DEFAULT 0;
UPDATE "communications" SET "recipientCount" = COALESCE(cardinality("recipientIds"), 0);
