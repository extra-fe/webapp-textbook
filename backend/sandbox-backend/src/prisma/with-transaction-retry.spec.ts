import { Logger } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { withTransactionRetry } from './with-transaction-retry';

const knownError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError(`mock ${code}`, {
    code,
    clientVersion: 'test',
  });

describe('withTransactionRetry', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('P2034 が2回続いたあと成功すると3回目で完了する', async () => {
    const fn = jest
      .fn<Promise<string>, []>()
      .mockRejectedValueOnce(knownError('P2034'))
      .mockRejectedValueOnce(knownError('P2034'))
      .mockResolvedValueOnce('ok');

    await expect(withTransactionRetry(fn)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('P2034 が続くと maxRetries 回で諦めて投げ直す', async () => {
    const fn = jest
      .fn<Promise<string>, []>()
      .mockRejectedValue(knownError('P2034'));

    await expect(withTransactionRetry(fn, 3)).rejects.toThrow('mock P2034');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('P2034 以外はリトライせず1回で投げ直す', async () => {
    const fn = jest
      .fn<Promise<string>, []>()
      .mockRejectedValue(knownError('P2002'));

    await expect(withTransactionRetry(fn)).rejects.toThrow('mock P2002');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
