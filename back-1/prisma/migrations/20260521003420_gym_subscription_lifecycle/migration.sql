-- CreateEnum
CREATE TYPE "GymSubscriptionStatus" AS ENUM ('ACTIVE', 'GRACE', 'SUSPENDED');

-- AlterTable
ALTER TABLE "gyms" ADD COLUMN     "subscriptionExpiresAt" TIMESTAMP(3),
ADD COLUMN     "subscriptionGraceEndsAt" TIMESTAMP(3),
ADD COLUMN     "subscriptionStatus" "GymSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "subscription_plans" ADD COLUMN     "durationDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "graceDays" INTEGER NOT NULL DEFAULT 5;

-- CreateTable
CREATE TABLE "gym_billing_payments" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "notes" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gymId" TEXT NOT NULL,

    CONSTRAINT "gym_billing_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "gym_billing_payments_gymId_idx" ON "gym_billing_payments"("gymId");

-- AddForeignKey
ALTER TABLE "gym_billing_payments" ADD CONSTRAINT "gym_billing_payments_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "gyms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
