-- WhatsApp number + last alerted member-limit threshold for plan-limit notifications
ALTER TABLE "gyms" ADD COLUMN "whatsappPhone" TEXT;
ALTER TABLE "gyms" ADD COLUMN "memberLimitAlertLevel" INTEGER NOT NULL DEFAULT 0;
