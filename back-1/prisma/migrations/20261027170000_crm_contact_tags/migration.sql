-- Team-given name and tags for CRM contacts (e.g. numbers that aren't a gym yet)
ALTER TABLE "wa_conversations" ADD COLUMN "alias" TEXT;
ALTER TABLE "wa_conversations" ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
