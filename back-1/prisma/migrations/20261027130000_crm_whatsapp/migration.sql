-- CRM inbox: WhatsApp conversations with gym owners
CREATE TYPE "WaDirection" AS ENUM ('IN', 'OUT');
CREATE TYPE "CrmStatus" AS ENUM ('OPEN', 'PENDING', 'CLOSED');

CREATE TABLE "wa_conversations" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "contactName" TEXT,
    "status" "CrmStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastInboundAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "gymId" TEXT,
    CONSTRAINT "wa_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "wa_messages" (
    "id" TEXT NOT NULL,
    "direction" "WaDirection" NOT NULL,
    "body" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'text',
    "waMessageId" TEXT,
    "status" TEXT,
    "error" TEXT,
    "sentById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conversationId" TEXT NOT NULL,
    CONSTRAINT "wa_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wa_conversations_phone_key" ON "wa_conversations"("phone");
CREATE INDEX "wa_conversations_gymId_idx" ON "wa_conversations"("gymId");
CREATE INDEX "wa_conversations_status_lastMessageAt_idx" ON "wa_conversations"("status", "lastMessageAt");
CREATE UNIQUE INDEX "wa_messages_waMessageId_key" ON "wa_messages"("waMessageId");
CREATE INDEX "wa_messages_conversationId_createdAt_idx" ON "wa_messages"("conversationId", "createdAt");

ALTER TABLE "wa_conversations" ADD CONSTRAINT "wa_conversations_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "gyms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "wa_messages" ADD CONSTRAINT "wa_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "wa_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
