import { describe, expect, it, vi } from 'vitest';
import { resolveOrCreateAsset } from '@/lib/transactions/asset';

describe('shared asset metadata', () => {
  it('ignores caller profile fields, normalizes ticker and infers server defaults', async () => {
    const upsert = vi.fn();
    const input = { ticker: ' 0700.hk ', name: '=1+1', market: 'FAKE', currency: 'ZZZ' };
    await resolveOrCreateAsset({ asset: { upsert } } as unknown as Parameters<typeof resolveOrCreateAsset>[0], input);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { ticker: '0700.HK' },
      create: { ticker: '0700.HK', name: '0700.HK', market: 'HK', currency: 'HKD' },
      update: {},
    }));
  });
  it('rejects invalid ticker before any shared write', async () => {
    const upsert = vi.fn();
    await expect(resolveOrCreateAsset({ asset: { upsert } } as unknown as Parameters<typeof resolveOrCreateAsset>[0], { ticker: '=1+1' })).rejects.toThrow('Invalid asset ticker');
    expect(upsert).not.toHaveBeenCalled();
  });
});
