import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

const MONEY_FIELDS = new Set([
  'price', 'amount', 'cost', 'total', 'unitPrice',
  'finalPrice', 'discountSaving',
  'yearlyPrice', 'yearlyFinalPrice', 'yearlySaving', 'yearlyMonthlyEquivalent',
]);

function transformValue(data: any): any {
  if (data === null || data === undefined) return data;
  if (Array.isArray(data)) return data.map(transformValue);
  if (data instanceof Date) return data;
  if (typeof data === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (MONEY_FIELDS.has(key) && typeof value === 'number') {
        result[key] = value / 100;
      } else {
        result[key] = transformValue(value);
      }
    }
    return result;
  }
  return data;
}

@Injectable()
export class MoneyTransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map(transformValue));
  }
}
