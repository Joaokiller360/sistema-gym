const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function centsToDecimal(cents: number | string | undefined | null): number | undefined {
  if (cents === undefined || cents === null || cents === '') return undefined;
  const n = Number(cents);
  if (isNaN(n)) return undefined;
  return Math.round(n) / 100;
}

export interface ProrateResult {
  daysConsumed: number;
  daysRemaining: number;
  dailyRate: number;
  creditAmount: number;
  newPlanPrice: number;
  creditApplied: number;
  amountDue: number;
}

export interface ProrateInput {
  oldPlanPrice: number;
  oldPlanDurationDays: number;
  periodStart: Date;
  newPlanPrice: number;
  changeDate?: Date;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calculateProration(input: ProrateInput): ProrateResult {
  const { oldPlanPrice, oldPlanDurationDays, periodStart, newPlanPrice } = input;
  const changeDate = input.changeDate ?? new Date();

  const daysConsumed = Math.max(
    0,
    Math.floor((changeDate.getTime() - periodStart.getTime()) / MS_PER_DAY),
  );

  const daysRemaining = Math.max(0, oldPlanDurationDays - daysConsumed);
  const dailyRate = oldPlanDurationDays > 0 ? round2(oldPlanPrice / oldPlanDurationDays) : 0;
  const creditAmount = round2(dailyRate * daysRemaining);
  const creditApplied = round2(Math.min(creditAmount, newPlanPrice));
  const amountDue = round2(Math.max(0, newPlanPrice - creditApplied));

  return {
    daysConsumed,
    daysRemaining,
    dailyRate,
    creditAmount,
    newPlanPrice,
    creditApplied,
    amountDue,
  };
}
