-- Quote-replies between CRM messages
ALTER TABLE "wa_messages" ADD COLUMN "replyToId" TEXT;
ALTER TABLE "wa_messages" ADD CONSTRAINT "wa_messages_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "wa_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
