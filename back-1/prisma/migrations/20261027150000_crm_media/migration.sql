-- CRM: keep a local copy of inbound WhatsApp media (Meta drops it after a while)
ALTER TABLE "wa_messages" ADD COLUMN "mediaUrl" TEXT;
