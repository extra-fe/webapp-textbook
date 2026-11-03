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

  it('P2002 はリトライせず1回で投げ直す', async () => {
    const fn = jest
      .fn<Promise<string>, []>()
      .mockRejectedValue(knownError('P2002'));

    await expect(withTransactionRetry(fn)).rejects.toThrow('mock P2002');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('Prisma 以外の例外もリトライせず1回で投げ直す', async () => {
    const fn = jest
      .fn<Promise<string>, []>()
      .mockRejectedValue(new Error('boom'));

    await expect(withTransactionRetry(fn)).rejects.toThrow('boom');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('成功したら1回しか呼ばない', async () => {
    const fn = jest.fn<Promise<string>, []>().mockResolvedValue('ok');

    await expect(withTransactionRetry(fn)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('maxRetries が1なら P2034 でもリトライしない', async () => {
    const fn = jest
      .fn<Promise<string>, []>()
      .mockRejectedValue(knownError('P2034'));

    await expect(withTransactionRetry(fn, 1)).rejects.toThrow('mock P2034');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
