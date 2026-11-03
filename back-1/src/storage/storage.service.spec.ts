import type { NextFunction, Request, Response } from 'express';
import { StorageService } from './storage.service';

describe('StorageService.serve', () => {
  const env = { ...process.env };
  beforeAll(() => {
    // Dummy values: serve() only runs when S3 is configured; no request reaches it here
    process.env.S3_ENDPOINT = 'http://127.0.0.1:1';
    process.env.S3_ACCESS_KEY = 'test';
    process.env.S3_SECRET_KEY = 'test';
  });
  afterAll(() => {
    process.env = env;
  });

  it('passes malformed percent-encoding on instead of throwing', async () => {
    const storage = new StorageService();
    const next = jest.fn() as unknown as NextFunction;
    const req = { method: 'GET', path: '/%E0%A4%A' } as unknown as Request;
    await expect(
      storage.serve(req, {} as Response, next),
    ).resolves.toBeUndefined();
    expect(next).toHaveBeenCalledWith();
  });

  it('ignores keys outside the allowed folders', async () => {
    const storage = new StorageService();
    const next = jest.fn() as unknown as NextFunction;
    const req = { method: 'GET', path: '/..%2F.env' } as unknown as Request;
    await storage.serve(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });
});
