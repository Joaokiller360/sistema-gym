import { BadRequestException } from '@nestjs/common';
import { parseWalletCode, WALLET_CODE_PREFIX } from './wallet.service';

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
