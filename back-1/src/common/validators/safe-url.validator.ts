import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

const PRIVATE_IP_REGEX = /^(localhost|127\.|0\.0\.0\.0|::1$|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/i;

@ValidatorConstraint({ name: 'isSafeUrl', async: false })
class IsSafeUrlConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    try {
      const url = new URL(value);
      if (!['https:', 'http:'].includes(url.protocol)) return false;
      const host = url.hostname;
      if (PRIVATE_IP_REGEX.test(host)) return false;
      if (!host.includes('.')) return false;
      return true;
    } catch {
      return false;
    }
  }

  defaultMessage(): string {
    return 'URL must use http/https and cannot point to private/internal addresses';
  }
}

export function IsSafeUrl(options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      constraints: [],
      validator: IsSafeUrlConstraint,
    });
  };
}
