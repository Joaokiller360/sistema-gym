import { fromZonedTime } from 'date-fns-tz';

export const COUNTRY_TIMEZONES: Record<string, { label: string; timezone: string; utcOffset: string }> = {
  // América del Sur
  AR: { label: 'Argentina',           timezone: 'America/Argentina/Buenos_Aires', utcOffset: 'UTC-3'  },
  BO: { label: 'Bolivia',             timezone: 'America/La_Paz',                 utcOffset: 'UTC-4'  },
  BR: { label: 'Brasil',              timezone: 'America/Sao_Paulo',              utcOffset: 'UTC-3'  },
  CL: { label: 'Chile',               timezone: 'America/Santiago',               utcOffset: 'UTC-4'  },
  CO: { label: 'Colombia',            timezone: 'America/Bogota',                 utcOffset: 'UTC-5'  },
  EC: { label: 'Ecuador',             timezone: 'America/Guayaquil',              utcOffset: 'UTC-5'  },
  PY: { label: 'Paraguay',            timezone: 'America/Asuncion',               utcOffset: 'UTC-4'  },
  PE: { label: 'Perú',                timezone: 'America/Lima',                   utcOffset: 'UTC-5'  },
  UY: { label: 'Uruguay',             timezone: 'America/Montevideo',             utcOffset: 'UTC-3'  },
  VE: { label: 'Venezuela',           timezone: 'America/Caracas',               utcOffset: 'UTC-4'  },
  // América Central
  CR: { label: 'Costa Rica',          timezone: 'America/Costa_Rica',             utcOffset: 'UTC-6'  },
  CU: { label: 'Cuba',                timezone: 'America/Havana',                 utcOffset: 'UTC-5'  },
  DO: { label: 'República Dominicana',timezone: 'America/Santo_Domingo',          utcOffset: 'UTC-4'  },
  GT: { label: 'Guatemala',           timezone: 'America/Guatemala',              utcOffset: 'UTC-6'  },
  HN: { label: 'Honduras',            timezone: 'America/Tegucigalpa',            utcOffset: 'UTC-6'  },
  MX: { label: 'México',              timezone: 'America/Mexico_City',            utcOffset: 'UTC-6'  },
  NI: { label: 'Nicaragua',           timezone: 'America/Managua',                utcOffset: 'UTC-6'  },
  PA: { label: 'Panamá',              timezone: 'America/Panama',                 utcOffset: 'UTC-5'  },
  SV: { label: 'El Salvador',         timezone: 'America/El_Salvador',            utcOffset: 'UTC-6'  },
  PR: { label: 'Puerto Rico',         timezone: 'America/Puerto_Rico',            utcOffset: 'UTC-4'  },
  // América del Norte
  US: { label: 'Estados Unidos (Este)',timezone: 'America/New_York',             utcOffset: 'UTC-5'  },
  CA: { label: 'Canadá (Este)',        timezone: 'America/Toronto',               utcOffset: 'UTC-5'  },
  // Europa
  ES: { label: 'España',              timezone: 'Europe/Madrid',                  utcOffset: 'UTC+1'  },
  PT: { label: 'Portugal',            timezone: 'Europe/Lisbon',                  utcOffset: 'UTC+0'  },
};

export function getTimezone(country: string | null | undefined): string {
  if (!country) return 'UTC';
  return COUNTRY_TIMEZONES[country.toUpperCase()]?.timezone ?? 'UTC';
}

export function startOfDayUTC(dateStr: string, timezone: string): Date {
  return fromZonedTime(`${dateStr.slice(0, 10)}T00:00:00`, timezone);
}

export function endOfDayUTC(dateStr: string, timezone: string): Date {
  return fromZonedTime(`${dateStr.slice(0, 10)}T23:59:59.999`, timezone);
}

export function buildDateRangeFilter(startDate: string | undefined, endDate: string | undefined, timezone: string) {
  if (!startDate && !endDate) return undefined;
  const filter: any = {};
  if (startDate) filter.gte = startOfDayUTC(startDate, timezone);
  if (endDate)   filter.lte = endOfDayUTC(endDate, timezone);
  return filter;
}

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface DayHours {
  open: string;  // "HH:mm" en hora local del gym
  close: string; // "HH:mm" en hora local del gym
}

export type GymSchedule = Partial<Record<DayKey, DayHours | null>>;

export interface PlanDayAccess {
  from: string; // "HH:mm"
  to: string;   // "HH:mm"
}

export type PlanAccessSchedule = Partial<Record<DayKey, PlanDayAccess | null>>;

const DAY_MAP: Record<string, DayKey> = {
  Mon: 'mon', Tue: 'tue', Wed: 'wed', Thu: 'thu',
  Fri: 'fri', Sat: 'sat', Sun: 'sun',
};

function localTimeStr(date: Date, timezone: string): string {
  return date.toLocaleTimeString('en-US', { timeZone: timezone, hour12: false, hour: '2-digit', minute: '2-digit' });
}

function localDayKey(date: Date, timezone: string): DayKey {
  const abbr = date.toLocaleDateString('en-US', { timeZone: timezone, weekday: 'short' });
  return DAY_MAP[abbr] ?? 'mon';
}

export function isGymOpen(schedule: GymSchedule, timezone: string, at: Date = new Date()): boolean {
  const day = localDayKey(at, timezone);
  const hours = schedule[day];
  if (!hours) return false;
  const time = localTimeStr(at, timezone);
  return time >= hours.open && time <= hours.close;
}

export function isWithinPlanAccess(access: PlanAccessSchedule, timezone: string, at: Date = new Date()): boolean {
  const day = localDayKey(at, timezone);
  const slot = access[day];
  if (!slot) return false;
  const time = localTimeStr(at, timezone);
  return time >= slot.from && time <= slot.to;
}
