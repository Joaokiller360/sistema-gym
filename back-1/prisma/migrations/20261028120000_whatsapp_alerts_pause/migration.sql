-- Manual pause for automatic WhatsApp alerts (CRM toggle)
ALTER TABLE "platform_settings" ADD COLUMN "whatsappAlertsPaused" BOOLEAN NOT NULL DEFAULT false;
