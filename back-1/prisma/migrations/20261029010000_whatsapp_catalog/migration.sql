-- The CRM sells from the WhatsApp Business catalog (Meta) instead of its own table
DROP TABLE IF EXISTS "crm_products";

-- Meta catalog linked to the number, for single-product and product-list messages
ALTER TABLE "platform_settings" ADD COLUMN "waCatalogId" TEXT;
