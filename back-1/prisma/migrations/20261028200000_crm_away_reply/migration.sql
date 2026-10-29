-- CRM auto-reply while nobody is online
ALTER TABLE "platform_settings" ADD COLUMN "awayEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "platform_settings" ADD COLUMN "awayMessage" TEXT;
ALTER TABLE "platform_settings" ADD COLUMN "awayMode" TEXT NOT NULL DEFAULT 'presence';
ALTER TABLE "platform_settings" ADD COLUMN "crmSeenAt" TIMESTAMP(3);
ALTER TABLE "wa_conversations" ADD COLUMN "awayRepliedAt" TIMESTAMP(3);
