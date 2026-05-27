-- Drop default case-sensitive unique index if prisma created one
DROP INDEX IF EXISTS "members_gymId_firstName_lastName_key";

-- Case-insensitive unique index using lower()
CREATE UNIQUE INDEX "members_gymId_firstName_lastName_key"
  ON "members" ("gymId", lower("firstName"), lower("lastName"));
