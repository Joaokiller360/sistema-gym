CREATE TABLE "news_posts" (
  "id"          TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "title"       TEXT NOT NULL,
  "body"        TEXT NOT NULL,
  "imageUrl"    TEXT,
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "news_posts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tutorials" (
  "id"          TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "title"       TEXT NOT NULL,
  "description" TEXT,
  "videoUrl"    TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tutorials_pkey" PRIMARY KEY ("id")
);
