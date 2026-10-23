import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  BadGatewayException,
} from '@nestjs/common';

/** Subset of the WalletWallet pass payload we use (free-tier fields only). */
export interface WalletPassField {
  label: string;
  value: string;
  changeMessage?: string;
}

export interface CreatePassInput {
  barcodeValue: string;
  barcodeFormat: 'QR';
  barcodeAltText?: string;
  logoText: string;
  organizationName: string;
  description: string;
  primaryFields: WalletPassField[];
  secondaryFields?: WalletPassField[];
  backFields?: WalletPassField[];
  colorPreset?: 'dark' | 'blue' | 'green' | 'red' | 'purple' | 'orange';
  sharingProhibited?: boolean;
}

export interface CreatePassResult {
  serialNumber: string;
  shareUrl: string;
  googleSaveUrl: string | null;
}

const LIMITS = {
  label: 64,
  value: 256,
  logoText: 64,
  organizationName: 64,
  description: 128,
  barcodeAltText: 128,
};

function clip(value: string, max: number) {
  return value.length > max ? value.slice(0, max - 1) + '…' : value;
}

function clipFields(fields?: WalletPassField[]) {
  return fields?.map((f) => ({
    ...f,
    label: clip(f.label, LIMITS.label),
    value: clip(f.value, LIMITS.value),
  }));
}

/**
 * Thin client for https://api.walletwallet.dev — issues Apple/Google Wallet passes.
 * Configure with WALLETWALLET_API_KEY (ww_live_…) and optionally WALLETWALLET_API_URL.
 */
@Injectable()
export class WalletWalletClient {
  private readonly logger = new Logger(WalletWalletClient.name);
  private readonly baseUrl = (
    process.env.WALLETWALLET_API_URL ?? 'https://api.walletwallet.dev'
  ).replace(/\/$/, '');

  get isConfigured() {
    return !!process.env.WALLETWALLET_API_KEY;
  }

  private headers() {
    const key = process.env.WALLETWALLET_API_KEY;
    if (!key)
      throw new ServiceUnavailableException(
        'Los pases de Wallet no están configurados (falta WALLETWALLET_API_KEY)',
      );
    return {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    };
  }

  private toBody(input: CreatePassInput) {
    return {
      ...input,
      logoText: clip(input.logoText, LIMITS.logoText),
      organizationName: clip(input.organizationName, LIMITS.organizationName),
      description: clip(input.description, LIMITS.description),
      barcodeAltText: input.barcodeAltText
        ? clip(input.barcodeAltText, LIMITS.barcodeAltText)
        : undefined,
      primaryFields: clipFields(input.primaryFields),
      secondaryFields: clipFields(input.secondaryFields),
      backFields: clipFields(input.backFields),
    };
  }

  async createPass(input: CreatePassInput): Promise<CreatePassResult> {
    const res = await fetch(`${this.baseUrl}/api/passes`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(this.toBody(input)),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, any>;

    if (!res.ok) {
      this.logger.warn(
        `createPass failed (${res.status}): ${json?.error ?? 'unknown error'}`,
      );
      if (res.status === 429)
        throw new BadGatewayException(
          'Se alcanzó el límite mensual de pases de WalletWallet',
        );
      throw new BadGatewayException(
        json?.error
          ? `WalletWallet: ${json.error}`
          : 'No se pudo generar el pase de Wallet',
      );
    }

    return {
      serialNumber: String(json.serialNumber),
      shareUrl: String(json.shareUrl),
      googleSaveUrl: json.googleSaveUrl ? String(json.googleSaveUrl) : null,
    };
  }

  /**
   * Replaces a pass's content (PUT sends the full spec) and pushes it to devices.
   * Never throws: a failed update only leaves the pass showing stale info.
   */
  async updatePass(serialNumber: string, input: CreatePassInput): Promise<boolean> {
    try {
      const res = await fetch(
        `${this.baseUrl}/api/passes/${encodeURIComponent(serialNumber)}`,
        {
          method: 'PUT',
          headers: this.headers(),
          body: JSON.stringify(this.toBody(input)),
        },
      );
      if (!res.ok) {
        this.logger.warn(`updatePass ${serialNumber} failed (${res.status})`);
        return false;
      }
      return true;
    } catch (e) {
      this.logger.warn(
        `updatePass ${serialNumber} error: ${(e as Error).message}`,
      );
      return false;
    }
  }

  /** Revokes a pass on both wallets. Never throws: a stale pass only fails to resolve on scan. */
  async revokePass(serialNumber: string): Promise<boolean> {
    try {
      const res = await fetch(
        `${this.baseUrl}/api/passes/${encodeURIComponent(serialNumber)}`,
        {
          method: 'DELETE',
          headers: this.headers(),
        },
      );
      if (!res.ok && res.status !== 404) {
        this.logger.warn(`revokePass ${serialNumber} failed (${res.status})`);
        return false;
      }
      return true;
    } catch (e) {
      this.logger.warn(
        `revokePass ${serialNumber} error: ${(e as Error).message}`,
      );
      return false;
    }
  }
}
