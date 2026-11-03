import type { Request } from 'express';
import { AppThrottlerGuard } from './throttler.guard';

/**
 * getTracker は protected なので、テストからはキャストして呼ぶ。
 * ThrottlerGuard の依存（storage など）は getTracker では使われないため、
 * コンストラクタ引数は undefined のままで構わない。
 */
const makeGuard = () => {
  const guard = Object.create(AppThrottlerGuard.prototype) as AppThrottlerGuard;
  return guard as AppThrottlerGuard & {
    getTracker: (req: Request) => Promise<string>;
  };
};

const makeReq = (
  remoteAddress: string | undefined,
  headers: Record<string, string> = {},
) => ({ headers, socket: { remoteAddress } }) as unknown as Request;

describe('AppThrottlerGuard', () => {
  const guard = makeGuard();

  it('トラッカーキーに TCP 接続元 IP を使う', async () => {
    await expect(guard.getTracker(makeReq('203.0.113.9'))).resolves.toBe(
      '203.0.113.9',
    );
  });

  it('X-Forwarded-For を偽装してもキーは変わらない', async () => {
    // クライアントが任意に書けるヘッダーなので、ここを見てはいけない
    const spoofed = makeReq('203.0.113.9', {
      'x-forwarded-for': '198.51.100.1',
    });

    await expect(guard.getTracker(spoofed)).resolves.toBe('203.0.113.9');
  });

  it('送るたびに X-Forwarded-For を変えても同じキーになる', async () => {
    const keys = await Promise.all(
      ['1.1.1.1', '2.2.2.2', '3.3.3.3'].map((xff) =>
        guard.getTracker(makeReq('203.0.113.9', { 'x-forwarded-for': xff })),
      ),
    );

    expect(new Set(keys).size).toBe(1);
  });

  it('接続元 IP が取れないときは unknown にする', async () => {
    await expect(guard.getTracker(makeReq(undefined))).resolves.toBe('unknown');
  });
});
