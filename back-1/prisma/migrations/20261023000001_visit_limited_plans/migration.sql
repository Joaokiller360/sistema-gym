-- Visit-limited plans: a plan can include N gym days; each attended day consumes one
ALTER TABLE "plans" ADD COLUMN "visitLimit" INTEGER;

ALTER TABLE "memberships" ADD COLUMN "visitsTotal" INTEGER;
ALTER TABLE "memberships" ADD COLUMN "visitsUsed" INTEGER NOT NULL DEFAULT 0;

-- Which membership a check-in consumed (null for unlimited plans / repeat entries the same day)
ALTER TABLE "attendances" ADD COLUMN "membershipId" TEXT;
CREATE INDEX "attendances_membershipId_idx" ON "attendances"("membershipId");
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;
