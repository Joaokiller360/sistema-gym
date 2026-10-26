-- Per-user interface language for the gym panel ("es" | "en")
ALTER TABLE "users" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'es';
