CREATE TYPE "DemoRequestStatus" AS ENUM ('PENDING', 'CONTACTED', 'DISMISSED');

CREATE TABLE "demo_requests" (
  "id"                 TEXT NOT NULL,
  "name"               TEXT NOT NULL,
  "email"              TEXT NOT NULL,
  "phone"              TEXT,
  "gymName"            TEXT NOT NULL,
  "planId"             TEXT NOT NULL,
  "planLabel"          TEXT NOT NULL,
  "status"             "DemoRequestStatus" NOT NULL DEFAULT 'PENDING',
  "ip"                 TEXT,
  "statusChangedById"  TEXT,
  "statusChangedAt"    TIMESTAMP(3),
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL,
  CONSTRAINT "demo_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "demo_requests_status_idx" ON "demo_requests"("status");

ALTER TABLE "subscription_plans" ADD COLUMN "demoEnabled" BOOLEAN NOT NULL DEFAULT false;
