-- CRM via Zernio: link each conversation to its Zernio inbox thread
ALTER TABLE "wa_conversations" ADD COLUMN "externalId" TEXT;

CREATE UNIQUE INDEX "wa_conversations_externalId_key" ON "wa_conversations"("externalId");
