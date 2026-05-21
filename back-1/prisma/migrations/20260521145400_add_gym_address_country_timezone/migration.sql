-- AlterTable
ALTER TABLE "gyms" ADD COLUMN     "address" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'UTC';
