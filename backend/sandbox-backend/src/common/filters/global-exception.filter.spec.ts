import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';
import type { ErrorResponseBody } from '../errors/error-response.dto';
import type { Clock } from '../clock/clock';

const FIXED_TIME = '2024-01-15T12:00:00.000Z';
const fixedClock: Clock = { now: () => new Date(FIXED_TIME) };

type ResponseBody = ErrorResponseBody & Record<string, unknown>;
const capturedBodies: ResponseBody[] = [];

const mockJson = jest.fn((body: ResponseBody) => capturedBodies.push(body));
const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
const mockResponse = { status: mockStatus };
const mockRequest = {
  method: 'GET',
  url: '/test',
  requestId: 'test-request-id',
};

const makeHost = () =>
  ({
    switchToHttp: () => ({
      getResponse: () => mockResponse,
      getRequest: () => mockRequest,
    }),
  }) as never;

function getResponseBody(): ResponseBody {
  return capturedBodies[capturedBodies.length - 1];
}

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;

  // 想定外の例外のテストでフィルタ自身がスタックトレースを出す。
  // テスト結果が読めなくなるので黙らせておく。
  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    filter = new GlobalExceptionFilter(fixedClock);
    jest.clearAllMocks();
    capturedBodies.length = 0;
  });

  describe('HttpException', () => {
    it('string body → ErrorResponse 形式で返す', () => {
      filter.catch(
        new HttpException('Not Found', HttpStatus.UNPROCESSABLE_ENTITY),
        makeHost(),
      );

      expect(mockStatus).toHaveBeenCalledWith(422);
      const body = getResponseBody();
      expect(body.statusCode).toBe(422);
      expect(body.code).toBe('NOT_FOUND');
      expect(body.message).toBe('Not Found');
      expect(body.requestId).toBeDefined();
      expect(body.timestamp).toBe(FIXED_TIME);
    });

    it('object body（ValidationPipe 形式）→ code / requestId / timestamp を追記して返す', () => {
      filter.catch(
        new HttpException(
          {
            statusCode: 400,
            message: ['name must be string'],
            error: 'Bad Request',
          },
          HttpStatus.BAD_REQUEST,
        ),
        makeHost(),
      );

      expect(mockStatus).toHaveBeenCalledWith(400);
      const body = getResponseBody();
      expect(body.code).toBeDefined();
      expect(body.requestId).toBeDefined();
      expect(body.timestamp).toBe(FIXED_TIME);
    });

    it('401 → code が UNAUTHORIZED', () => {
      filter.catch(
        new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED),
        makeHost(),
      );
      expect(getResponseBody().code).toBe('UNAUTHORIZED');
    });

    it('403 → code が FORBIDDEN', () => {
      filter.catch(
        new HttpException('Forbidden', HttpStatus.FORBIDDEN),
        makeHost(),
      );
      expect(getResponseBody().code).toBe('FORBIDDEN');
    });

    it('409 → code が CONFLICT', () => {
      filter.catch(
        new HttpException('Conflict', HttpStatus.CONFLICT),
        makeHost(),
      );
      expect(getResponseBody().code).toBe('CONFLICT');
    });

    // 4.4 節のスロットリングで必ず発生する。埋めていないと statusCode は 429 なのに
    // code が INTERNAL_SERVER_ERROR という矛盾したレスポンスになる。
    it('429 → code が TOO_MANY_REQUESTS', () => {
      filter.catch(
        new HttpException(
          'ThrottlerException: Too Many Requests',
          HttpStatus.TOO_MANY_REQUESTS,
        ),
        makeHost(),
      );
      expect(getResponseBody().statusCode).toBe(429);
      expect(getResponseBody().code).toBe('TOO_MANY_REQUESTS');
    });

    // 呼び出し側が statusCode を含めずに throw しても、統一フォーマットの必須項目は埋める。
    it('statusCode を含まない object body でも statusCode を埋める', () => {
      filter.catch(
        new HttpException(
          { message: 'Race with id abc not found', code: 'NOT_FOUND' },
          HttpStatus.UNPROCESSABLE_ENTITY,
        ),
        makeHost(),
      );
      expect(getResponseBody().statusCode).toBe(422);
      expect(getResponseBody().code).toBe('NOT_FOUND');
    });

    // アプリのコードでは 404 を投げないが、ルート未一致のときは NestJS 自身が返す。
    it('404（ルート未一致）→ code が NOT_FOUND', () => {
      filter.catch(
        new HttpException(
          {
            message: 'Cannot GET /api/no-such-route',
            error: 'Not Found',
            statusCode: 404,
          },
          HttpStatus.NOT_FOUND,
        ),
        makeHost(),
      );
      expect(getResponseBody().code).toBe('NOT_FOUND');
    });
  });

  // body-parser (raw-body) が BODY_SIZE_LIMIT 超過時に投げる例外。
  // HttpException ではないため、放置すると未捕捉例外扱いで 500 に丸められる。

  describe('未捕捉例外', () => {
    const originalEnv = process.env.NODE_ENV;
    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('本番環境 → 汎用 500 のみ返す', () => {
      process.env.NODE_ENV = 'production';
      filter.catch(new Error('db crash'), makeHost());

      expect(mockStatus).toHaveBeenCalledWith(500);
      const body = getResponseBody();
      expect(body.statusCode).toBe(500);
      expect(body.code).toBe('INTERNAL_SERVER_ERROR');
      expect(body.timestamp).toBe(FIXED_TIME);
      expect(body['stack']).toBeUndefined();
    });

    it('Error 以外の例外も 500 で返す', () => {
      filter.catch('string exception', makeHost());
      expect(mockStatus).toHaveBeenCalledWith(500);
    });
  });

  // body-parser のように、ルーティングより手前で動くミドルウェアが投げるもの。
  // HttpException ではないが status を持っているので、500 に丸めない。
  describe('ミドルウェア層が投げた素のエラー', () => {
    const withStatus = (status: number, message: string) =>
      Object.assign(new Error(message), { status });

    it('413（ボディが大きすぎる）はそのまま 413 で返す', () => {
      filter.catch(withStatus(413, 'request entity too large'), makeHost());

      expect(mockStatus).toHaveBeenCalledWith(413);
      const body = getResponseBody();
      expect(body.statusCode).toBe(413);
      expect(body.code).toBe('PAYLOAD_TOO_LARGE');
      expect(body.message).toBe('request entity too large');
    });

    it('statusCode プロパティでも拾う', () => {
      filter.catch(
        Object.assign(new Error('too large'), { statusCode: 413 }),
        makeHost(),
      );
      expect(mockStatus).toHaveBeenCalledWith(413);
    });

    // 対応表に無い 4xx は BAD_REQUEST に寄せる（INTERNAL_SERVER_ERROR にしない）
    it('対応表に無い 4xx は BAD_REQUEST で返す', () => {
      filter.catch(withStatus(415, 'unsupported media type'), makeHost());

      expect(mockStatus).toHaveBeenCalledWith(415);
      expect(getResponseBody().code).toBe('BAD_REQUEST');
    });

    // 5xx を名乗るものは信用しない。詳細を外に出さず 500 に丸める
    it('5xx を持つエラーは 500 に丸める', () => {
      filter.catch(withStatus(503, 'upstream down'), makeHost());

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(getResponseBody().message).toBe('Internal server error');
    });
  });
});
