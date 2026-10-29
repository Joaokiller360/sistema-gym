-- Per-contact switch to skip the 1-minute undo queue
ALTER TABLE "wa_conversations" ADD COLUMN "instantSend" BOOLEAN NOT NULL DEFAULT false;

-- Editable canned replies (were hardcoded in the front)
CREATE TABLE "crm_quick_replies" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_quick_replies_pkey" PRIMARY KEY ("id")
);

INSERT INTO "crm_quick_replies" ("id", "label", "text", "position", "updatedAt") VALUES
  ('qr-saludo', 'Saludo', '¡Hola! Gracias por escribirnos. ¿En qué te podemos ayudar?', 0, CURRENT_TIMESTAMP),
  ('qr-lo-reviso', 'Lo reviso', 'Dale, lo reviso y te escribo en un rato.', 1, CURRENT_TIMESTAMP),
  ('qr-mejorar-plan', 'Mejorar plan', 'Podemos pasarte a un plan con más socios hoy mismo. ¿Querés que te cuente las opciones?', 2, CURRENT_TIMESTAMP),
  ('qr-resuelto', 'Resuelto', 'Listo, ya quedó resuelto. Cualquier otra cosa escribinos 🙌.', 3, CURRENT_TIMESTAMP);
