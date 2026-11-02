import { normalizePhone } from './whatsapp.service';

/** ISO country → calling code (same list as front-1/src/lib/phone.ts) */
const DIAL_CODES: Record<string, string> = {
  AR: '54',
  BO: '591',
  BR: '55',
  CL: '56',
  CO: '57',
  CR: '506',
  CU: '53',
  EC: '593',
  SV: '503',
  GT: '502',
  HN: '504',
  MX: '52',
  NI: '505',
  PA: '507',
  PY: '595',
  PE: '51',
  PR: '1',
  DO: '1',
  UY: '598',
  VE: '58',
  US: '1',
  CA: '1',
  ES: '34',
  PT: '351',
  FR: '33',
  DE: '49',
  IT: '39',
  GB: '44',
  AU: '61',
};

/**
 * Member phones are free text: "+593 98 666 0737", "0986660737", "98 666 0737".
 * Numbers with "+" (or that already start with the gym's calling code) are used as-is;
 * local ones get the gym country's code. Returns E.164 digits or null.
 */
export function memberWhatsapp(
  raw: string | null | undefined,
  gymCountry: string | null | undefined,
): string | null {
  const value = (raw ?? '').trim();
  if (!value) return null;
  if (value.startsWith('+') || value.startsWith('00')) {
    return normalizePhone(value.replace(/^00/, ''));
  }
  const digits = value.replace(/\D/g, '');
  const dial = gymCountry ? DIAL_CODES[gymCountry.toUpperCase()] : undefined;
  if (!dial) return normalizePhone(digits);
  // Already international without the "+" (e.g. 593986660737)
  if (digits.startsWith(dial) && digits.length >= dial.length + 8) {
    return normalizePhone(digits);
  }
  let local = digits.replace(/^0+/, '');
  // Argentine mobiles on WhatsApp carry a 9 after the country code (54 9 11…)
  if (dial === '54' && !local.startsWith('9')) local = `9${local}`;
  return normalizePhone(dial + local);
}

/** Runs `fn` over `items` with at most `limit` calls in flight. */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    },
  );
  await Promise.all(workers);
  return out;
}
