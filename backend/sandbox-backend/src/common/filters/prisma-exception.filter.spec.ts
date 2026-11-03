import { Logger } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import type { Clock } from '../clock/clock';
import type { ErrorResponseBody } from '../errors/error-response.dto';
import { PrismaExceptionFilter } from './prisma-exception.filter';

const FIXED_TIME = '2024-01-15T12:00:00.000Z';
const fixedClock: Clock = { now: () => new Date(FIXED_TIME) };

const capturedBodies: ErrorResponseBody[] = [];
const mockJson = jest.fn((body: ErrorResponseBody) =>
  capturedBodies.push(body),
);
const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
const mockResponse = { status: mockStatus };
const mockRequest = { method: 'POST', url: '/api/races' };

const makeHost = () =>
  ({
    switchToHttp: () => ({
      getResponse: () => mockResponse,
      getRequest: () => mockRequest,
    }),
  }) as never;

const knownError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError(`prisma error ${code}`, {
    code,
    clientVersion: 'test',
  });

const getResponseBody = () => capturedBodies[capturedBodies.length - 1];

describe('PrismaExceptionFilter', () => {
  let filter: PrismaExceptionFilter;

  // フィルタ自身が warn を出すのでテスト結果が読めなくなる。黙らせておく
  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    filter = new PrismaExceptionFilter(fixedClock);
    jest.clearAllMocks();
    capturedBodies.length = 0;
  });

  it('P2002（一意制約違反）→ 409 CONFLICT', () => {
    filter.catch(knownError('P2002'), makeHost());

    expect(mockStatus).toHaveBeenCalledWith(409);
    const body = getResponseBody();
    expect(body.statusCode).toBe(409);
    expect(body.code).toBe('CONFLICT');
    expect(body.timestamp).toBe(FIXED_TIME);
  });

  it('P2025（レコード未存在）→ 422 NOT_FOUND（404 は使わない）', () => {
    filter.catch(knownError('P2025'), makeHost());

    expect(mockStatus).toHaveBeenCalledWith(422);
    expect(getResponseBody().code).toBe('NOT_FOUND');
  });

  it('P2003（外部キー制約違反）→ 400 BAD_REQUEST', () => {
    filter.catch(knownError('P2003'), makeHost());

    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(getResponseBody().code).toBe('BAD_REQUEST');
  });

  // 変換表に無いコードは 500 に落とす。DB 由来の文言をそのまま返さない
  it('未知のコード → 500 INTERNAL_SERVER_ERROR', () => {
    filter.catch(knownError('P9999'), makeHost());

    expect(mockStatus).toHaveBeenCalledWith(500);
    const body = getResponseBody();
    expect(body.code).toBe('INTERNAL_SERVER_ERROR');
    expect(body.message).toBe('Internal server error');
  });
});
