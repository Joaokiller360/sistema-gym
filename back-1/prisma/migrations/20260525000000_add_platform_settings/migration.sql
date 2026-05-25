-- CreateTable
CREATE TABLE IF NOT EXISTS "platform_settings" (
    "id" TEXT NOT NULL DEFAULT '1',
    "saasName" TEXT NOT NULL DEFAULT 'GymSystem',
    "logoUrl" TEXT,
    "creatorName" TEXT,
    "creatorUrl" TEXT,
    "footerText" TEXT,
    "footerLinks" JSONB NOT NULL DEFAULT '[]',
    "footerShowPoweredBy" BOOLEAN NOT NULL DEFAULT true,
    "heroTitle" TEXT,
    "heroSubtitle" TEXT,
    "heroCtaText" TEXT,
    "primaryColor" TEXT,
    "landingFeatures" JSONB NOT NULL DEFAULT '[]',
    "landingShowPlans" BOOLEAN NOT NULL DEFAULT true,
    "termsContent" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);
