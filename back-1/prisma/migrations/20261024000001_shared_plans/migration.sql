-- Shared plans: one purchase covers several people, each with their own membership row
ALTER TABLE "plans" ADD COLUMN "maxMembers" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "memberships" ADD COLUMN "groupId" TEXT;
CREATE INDEX "memberships_groupId_idx" ON "memberships"("groupId");
