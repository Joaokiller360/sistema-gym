import { BadRequestException } from '@nestjs/common';
import {
  parseScanRef,
  parseWalletCode,
  WALLET_CODE_PREFIX,
} from './wallet.service';

describe('parseWalletCode', () => {
  const token = 'a'.repeat(16) + '0123456789abcdef';

  it('accepts the prefixed code written into the pass', () => {
    expect(parseWalletCode(`${WALLET_CODE_PREFIX}${token}`)).toBe(token);
  });

  it('accepts the bare token, any case and surrounding whitespace', () => {
    expect(parseWalletCode(`  ${token.toUpperCase()}\n`)).toBe(token);
    expect(parseWalletCode(`gymos-${token}`)).toBe(token);
  });

  it('rejects anything that is not a 32-char hex token', () => {
    for (const bad of [
      '',
      'GYMOS-',
      'GYMOS-xyz',
      token.slice(1),
      `${token}0`,
      `https://evil.test/${token}`,
    ]) {
      expect(() => parseWalletCode(bad)).toThrow(BadRequestException);
    }
  });
});

describe('parseScanRef', () => {
  const token = 'a'.repeat(16) + '0123456789abcdef';
  const memberId = '3f2b6c1e-8d4a-4b7f-9c2e-1a5d6e7f8a9b';

  it('treats a UUID as a member id (staff picked the member by name)', () => {
    expect(parseScanRef(memberId)).toEqual({ memberId });
    expect(parseScanRef(` ${memberId.toUpperCase()} `)).toEqual({ memberId });
  });

  it('treats everything else as a wallet code', () => {
    expect(parseScanRef(`${WALLET_CODE_PREFIX}${token}`)).toEqual({ token });
    expect(parseScanRef(token)).toEqual({ token });
  });

  it('still rejects text that is neither', () => {
    expect(() => parseScanRef('Juan Pérez')).toThrow(BadRequestException);
  });
});
