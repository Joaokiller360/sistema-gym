-- Message packs: gyms buy WhatsApp messages beyond their plan's monthly limit
CREATE TYPE "MessagePackBilling" AS ENUM ('ONCE', 'MONTHLY');
CREATE TYPE "MessagePurchaseStatus" AS ENUM ('PENDING', 'ACTIVE', 'CANCELLED', 'REJECTED');

ALTER TABLE "subscription_plans" ADD COLUMN "messagePacksEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "gyms" ADD COLUMN "messageCredits" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "message_packs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "messages" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "billing" "MessagePackBilling" NOT NULL DEFAULT 'ONCE',
    "planKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_packs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "message_pack_purchases" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "messages" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "billing" "MessagePackBilling" NOT NULL,
    "status" "MessagePurchaseStatus" NOT NULL DEFAULT 'PENDING',
    "method" "PaymentMethod",
    "requestedById" TEXT,
    "paidAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gymId" TEXT NOT NULL,
    "packId" TEXT,

    CONSTRAINT "message_pack_purchases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "message_usage" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "fromCredits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gymId" TEXT NOT NULL,

    CONSTRAINT "message_usage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "messaging_config" (
    "id" TEXT NOT NULL DEFAULT '1',
    "costPerMessage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messaging_config_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "message_pack_purchases_gymId_status_idx" ON "message_pack_purchases"("gymId", "status");
CREATE INDEX "message_pack_purchases_status_idx" ON "message_pack_purchases"("status");
CREATE INDEX "message_usage_gymId_createdAt_idx" ON "message_usage"("gymId", "createdAt");
CREATE INDEX "message_usage_createdAt_idx" ON "message_usage"("createdAt");

ALTER TABLE "message_pack_purchases" ADD CONSTRAINT "message_pack_purchases_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "gyms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "message_pack_purchases" ADD CONSTRAINT "message_pack_purchases_packId_fkey" FOREIGN KEY ("packId") REFERENCES "message_packs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "message_usage" ADD CONSTRAINT "message_usage_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "gyms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Announcements already sent become usage rows, so this month's totals stay right
INSERT INTO "message_usage" ("id", "kind", "count", "createdAt", "gymId")
SELECT gen_random_uuid()::text, 'ANNOUNCEMENT', "recipientCount", "sentAt", "gymId"
FROM "communications"
WHERE "recipientCount" > 0;
