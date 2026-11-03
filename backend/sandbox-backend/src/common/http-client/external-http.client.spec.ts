import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  CircuitBreakerService,
  CircuitOpenError,
  CircuitState,
} from './circuit-breaker.service';
import { ExternalHttpClient } from './external-http.client';

const okResponse = (status = 200, body: unknown = { ok: true }) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const URL_X = 'https://example.test/x';

describe('ExternalHttpClient', () => {
  let client: ExternalHttpClient;
  let breakers: CircuitBreakerService;
  let fetchMock: jest.SpyInstance;

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(okResponse());

    const module: TestingModule = await Test.createTestingModule({
      providers: [CircuitBreakerService, ExternalHttpClient],
    }).compile();
    client = module.get(ExternalHttpClient);
    breakers = module.get(CircuitBreakerService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('HTTPメソッド', () => {
    it('get() は GET で呼ぶ', async () => {
      await client.get(URL_X);
      expect(fetchMock).toHaveBeenCalledWith(
        URL_X,
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('post() は POST で呼ぶ', async () => {
      await client.post(URL_X, {});
      expect(fetchMock).toHaveBeenCalledWith(
        URL_X,
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('put() は PUT で呼ぶ', async () => {
      await client.put(URL_X, {});
      expect(fetchMock).toHaveBeenCalledWith(
        URL_X,
        expect.objectContaining({ method: 'PUT' }),
      );
    });

    it('delete() は DELETE で呼ぶ', async () => {
      await client.delete(URL_X);
      expect(fetchMock).toHaveBeenCalledWith(
        URL_X,
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  describe('リクエストの組み立て', () => {
    const initOf = (): RequestInit => {
      const call = fetchMock.mock.calls[0] as [string, RequestInit];
      return call[1];
    };
    const headersOf = () => initOf().headers as Record<string, string>;

    it('Content-Type: application/json を付ける', async () => {
      await client.get(URL_X);
      expect(headersOf()['Content-Type']).toBe('application/json');
    });

    it('opts.headers を足せる', async () => {
      await client.get(URL_X, { headers: { Authorization: 'Bearer t' } });
      expect(headersOf()['Authorization']).toBe('Bearer t');
    });

    it('body を JSON 文字列にして送る', async () => {
      await client.post(URL_X, { a: 1 });
      expect(initOf().body).toBe('{"a":1}');
    });

    it('body を渡さなければ body は undefined', async () => {
      await client.get(URL_X);
      expect(initOf().body).toBeUndefined();
    });
  });

  describe('レスポンスの取り出し', () => {
    it('status とボディを返す', async () => {
      fetchMock.mockResolvedValue(okResponse(201, { id: 'x' }));
      const res = await client.post(URL_X, {});
      expect(res.status).toBe(201);
      expect(res.body).toEqual({ id: 'x' });
    });

    it('レスポンスヘッダーをオブジェクトで返す', async () => {
      const res = await client.get(URL_X);
      expect(res.headers['content-type']).toContain('application/json');
    });

    it('JSON として読めないボディは null になる', async () => {
      fetchMock.mockResolvedValue(new Response('not json', { status: 200 }));
      const res = await client.get(URL_X);
      expect(res.body).toBeNull();
    });
  });

  describe('タイムアウト', () => {
    it('timeoutMs を過ぎると abort する', async () => {
      jest.useFakeTimers();
      fetchMock.mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => {
              reject(new Error('aborted'));
            });
          }),
      );

      const promise = client.get('https://example.test/slow', {
        timeoutMs: 1_000,
      });
      const assertion = expect(promise).rejects.toThrow('aborted');
      jest.advanceTimersByTime(1_000);
      await assertion;

      jest.useRealTimers();
    });
  });

  describe('サーキットブレーカー', () => {
    const KEY = 'payment';
    const call = () => client.get(URL_X, { circuitBreakerKey: KEY });
    const failTimes = async (n: number) => {
      fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
      for (let i = 0; i < n; i++) {
        await expect(call()).rejects.toThrow('ECONNREFUSED');
      }
    };

    it('CLOSED のときは呼び出しを通す', async () => {
      await expect(call()).resolves.toMatchObject({ status: 200 });
      expect(breakers.getBreaker(KEY).getState()).toBe(CircuitState.Closed);
    });

    it('成功が続く限り CLOSED のまま', async () => {
      await call();
      await call();
      await call();
      expect(breakers.getBreaker(KEY).getState()).toBe(CircuitState.Closed);
    });

    it('連続失敗が閾値に達すると OPEN になる', async () => {
      await failTimes(5);
      expect(breakers.getBreaker(KEY).getState()).toBe(CircuitState.Open);
    });

    it('OPEN のときは fetch を呼ばずに CircuitOpenError を投げる', async () => {
      await failTimes(5);
      const before = fetchMock.mock.calls.length;

      await expect(call()).rejects.toBeInstanceOf(CircuitOpenError);
      expect(fetchMock.mock.calls.length).toBe(before);
    });

    it('HALF-OPEN で成功すると CLOSED に戻る', async () => {
      const breaker = breakers.getBreaker(KEY, { halfOpenAfterMs: 0 });
      await failTimes(5);
      expect(breaker.getState()).toBe(CircuitState.Open);

      fetchMock.mockResolvedValue(okResponse());
      await expect(call()).resolves.toMatchObject({ status: 200 });
      expect(breaker.getState()).toBe(CircuitState.Closed);
    });

    it('HALF-OPEN で失敗すると OPEN に戻る', async () => {
      const breaker = breakers.getBreaker(KEY, { halfOpenAfterMs: 0 });
      await failTimes(5);
      // halfOpenAfterMs=0 なので次の呼び出しで HALF-OPEN に入り、失敗して OPEN へ戻る
      await expect(call()).rejects.toThrow('ECONNREFUSED');
      expect(breaker.getState()).toBe(CircuitState.Open);
    });

    it('異なるキーは独立したサーキットを持つ', async () => {
      await failTimes(5);
      expect(breakers.getBreaker(KEY).getState()).toBe(CircuitState.Open);
      expect(breakers.getBreaker('notification').getState()).toBe(
        CircuitState.Closed,
      );
    });

    it('circuitBreakerKey を指定しなければブレーカーを経由しない', async () => {
      fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
      for (let i = 0; i < 10; i++) {
        await expect(client.get(URL_X)).rejects.toThrow('ECONNREFUSED');
      }
      // 10回失敗しても遮断されない（毎回 fetch まで届く）
      expect(fetchMock).toHaveBeenCalledTimes(10);
    });
  });
});
