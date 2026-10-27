-- Numbers saved as local ("0986660737") can't be dialed by WhatsApp: prefix the gym's country code
WITH dial(code, prefix) AS (VALUES
  ('AR', '549'), ('BO', '591'), ('BR', '55'), ('CL', '56'), ('CO', '57'), ('CR', '506'),
  ('CU', '53'), ('EC', '593'), ('SV', '503'), ('GT', '502'), ('HN', '504'), ('MX', '52'),
  ('NI', '505'), ('PA', '507'), ('PY', '595'), ('PE', '51'), ('UY', '598'), ('VE', '58'),
  ('ES', '34'), ('PT', '351'), ('FR', '33'), ('DE', '49'), ('IT', '39'), ('GB', '44'), ('AU', '61')
)
UPDATE "gyms" g
SET "whatsappPhone" = dial.prefix || ltrim(g."whatsappPhone", '0')
FROM dial
WHERE g."whatsappPhone" LIKE '0%' AND upper(g."country") = dial.code;

-- Move each gym's thread to the fixed number, unless one already exists for it
UPDATE "wa_conversations" c
SET "phone" = g."whatsappPhone"
FROM "gyms" g
WHERE c."gymId" = g."id"
  AND c."phone" LIKE '0%'
  AND g."whatsappPhone" NOT LIKE '0%'
  AND NOT EXISTS (SELECT 1 FROM "wa_conversations" o WHERE o."phone" = g."whatsappPhone");
