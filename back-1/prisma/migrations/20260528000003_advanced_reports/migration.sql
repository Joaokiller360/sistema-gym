ALTER TABLE "subscription_plans" ADD COLUMN "advanced_reports_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "gyms" ADD COLUMN "advanced_reports_enabled" BOOLEAN NOT NULL DEFAULT false;
