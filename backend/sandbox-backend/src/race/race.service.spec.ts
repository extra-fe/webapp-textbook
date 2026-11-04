jest.mock('../generated/prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({})),
  Prisma: {
    PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
      code: string;
      clientVersion: string;
      constructor(
        message: string,
        { code, clientVersion }: { code: string; clientVersion: string },
      ) {
        super(message);
        this.code = code;
        this.clientVersion = clientVersion;
      }
    },
    TransactionIsolationLevel: { ReadCommitted: 'ReadCommitted' },
  },
}));

import {
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import { RaceService } from './race.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRaceDto } from './dto/create-race.dto';

const mockRace = {
  id: 'aaaaaaaa-0000-0000-0000-000000000001',
  date: '1993-11-14T00:00:00.000Z',
  name: 'エリザベス女王杯',
  venue: '京都',
  version: 0,
  createdAt: new Date(),
  createdBy: 'bbbbbbbb-0000-0000-0000-000000000002',
  updatedAt: new Date(),
  updatedBy: 'bbbbbbbb-0000-0000-0000-000000000002',
  entries: [],
};

// $transaction は渡されたコールバックを tx (race モックを持つオブジェクト) で即時実行する
const makeTxClient = () => ({
  race: {
    updateMany: jest.fn(),
    findUnique: jest.fn(),
  },
});

let txClient = makeTxClient();

const $transactionMock = jest.fn() as jest.MockedFunction<
  (fn: (tx: any) => any) => any
>;

const mockPrismaService = {
  race: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
  },
  $transaction: $transactionMock,
};

describe('RaceService', () => {
  let service: RaceService;
  let module: TestingModule;

  beforeEach(async () => {
    jest.clearAllMocks();
    txClient = makeTxClient();
    // clearAllMocks で実装が消えるため毎回デフォルト実装を再設定する
    $transactionMock.mockImplementation(
      (fn: (tx: typeof txClient) => unknown) => fn(txClient),
    );

    module = await Test.createTestingModule({
      providers: [
        RaceService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<RaceService>(RaceService);
  });

  afterEach(async () => {
    await module?.close();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return array of races', async () => {
      mockPrismaService.race.findMany.mockResolvedValue([mockRace]);

      const result = await service.findAll();

      expect(result).toEqual([mockRace]);
      expect(mockPrismaService.race.findMany).toHaveBeenCalledWith({
        orderBy: { date: 'desc' },
        include: { entries: { orderBy: { horseNumber: 'asc' } } },
      });
    });

    it('should return empty array when no races exist', async () => {
      mockPrismaService.race.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return single race by id', async () => {
      mockPrismaService.race.findUnique.mockResolvedValue(mockRace);

      const result = await service.findOne(
        'aaaaaaaa-0000-0000-0000-000000000001',
      );

      expect(result).toEqual(mockRace);
      expect(mockPrismaService.race.findUnique).toHaveBeenCalledWith({
        where: { id: 'aaaaaaaa-0000-0000-0000-000000000001' },
        // 2.2節のとおり馬番順に並べて返す
        include: { entries: { orderBy: { horseNumber: 'asc' } } },
      });
    });

    it('should throw UnprocessableEntityException when race not found', async () => {
      mockPrismaService.race.findUnique.mockResolvedValue(null);

      const missingId = 'ffffffff-0000-0000-0000-000000000000';
      await expect(service.findOne(missingId)).rejects.toThrow(
        `Race with id ${missingId} not found`,
      );
    });
  });

  describe('create', () => {
    it('should create a race with entries', async () => {
      const createDto: CreateRaceDto = {
        date: '1993-11-14T00:00:00.000Z',
        name: 'エリザベス女王杯',
        venue: '京都',
        entries: [
          {
            frameNumber: 1,
            horseNumber: 1,
            horseName: 'ホクトベガ',
            sex: '牝',
            age: '4',
            jockey: '加藤和宏',
            trainer: '中野隆良',
          },
        ],
      };
      mockPrismaService.race.create.mockResolvedValue({
        ...mockRace,
        entries: createDto.entries,
      });

      const result = await service.create(
        createDto,
        'bbbbbbbb-0000-0000-0000-000000000002',
      );

      expect(result).toMatchObject({ name: 'エリザベス女王杯' });
      expect(mockPrismaService.race.create).toHaveBeenCalledWith({
        data: {
          date: createDto.date,
          name: createDto.name,
          venue: createDto.venue,
          createdBy: 'bbbbbbbb-0000-0000-0000-000000000002',
          updatedBy: 'bbbbbbbb-0000-0000-0000-000000000002',
          entries: { create: createDto.entries },
        },
        include: { entries: true },
      });
    });
  });

  describe('update (楽観ロック)', () => {
    it('version が一致する場合は更新してレースを返す', async () => {
      const updatedRace = { ...mockRace, name: '天皇賞（秋）', version: 1 };
      txClient.race.updateMany.mockResolvedValue({ count: 1 });
      txClient.race.findUnique.mockResolvedValue(updatedRace);

      const result = await service.update(
        'aaaaaaaa-0000-0000-0000-000000000001',
        0,
        { name: '天皇賞（秋）' },
        'bbbbbbbb-0000-0000-0000-000000000002',
      );

      expect(txClient.race.updateMany).toHaveBeenCalledWith({
        where: { id: 'aaaaaaaa-0000-0000-0000-000000000001', version: 0 },
        data: {
          name: '天皇賞（秋）',
          updatedBy: 'bbbbbbbb-0000-0000-0000-000000000002',
          version: { increment: 1 },
        },
      });
      expect(result).toEqual(updatedRace);
    });

    it('version 不一致（他者が先に更新）の場合は ConflictException を投げる', async () => {
      txClient.race.updateMany.mockResolvedValue({ count: 0 });
      // id は存在するが version が違う
      txClient.race.findUnique.mockResolvedValue(mockRace);

      await expect(
        service.update(
          'aaaaaaaa-0000-0000-0000-000000000001',
          99,
          { name: '天覧競馬' },
          'bbbbbbbb-0000-0000-0000-000000000002',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('id が存在しない場合は UnprocessableEntityException を投げる', async () => {
      txClient.race.updateMany.mockResolvedValue({ count: 0 });
      txClient.race.findUnique.mockResolvedValue(null);

      await expect(
        service.update(
          'ffffffff-0000-0000-0000-000000000000',
          0,
          { name: '幻のレース' },
          'bbbbbbbb-0000-0000-0000-000000000002',
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('$transaction コールバック内で例外が起きた場合はトランザクション全体がロールバックされる', async () => {
      const error = new Error('unexpected DB error');
      $transactionMock.mockRejectedValueOnce(error);

      await expect(
        service.update(
          'aaaaaaaa-0000-0000-0000-000000000001',
          0,
          { name: 'エラー' },
          'bbbbbbbb-0000-0000-0000-000000000002',
        ),
      ).rejects.toThrow('unexpected DB error');
      // $transaction は 1 回だけ呼ばれ、リトライなし（P2034 でないため）
      expect($transactionMock).toHaveBeenCalledTimes(1);
    });

    it('P2034 (deadlock) が発生した場合は最大 3 回リトライして成功する', async () => {
      const deadlock = new Prisma.PrismaClientKnownRequestError(
        'Transaction failed due to a write conflict or a deadlock.',
        { code: 'P2034', clientVersion: '6.0.0' },
      );
      const updatedRace = { ...mockRace, name: '有馬記念', version: 1 };

      // 1 回目・2 回目は deadlock、3 回目は成功
      $transactionMock
        .mockRejectedValueOnce(deadlock)
        .mockRejectedValueOnce(deadlock)
        .mockResolvedValueOnce(updatedRace);

      const result = await service.update(
        'aaaaaaaa-0000-0000-0000-000000000001',
        0,
        { name: '有馬記念' },
        'bbbbbbbb-0000-0000-0000-000000000002',
      );

      expect(result).toEqual(updatedRace);
      expect($transactionMock).toHaveBeenCalledTimes(3);
    });

    it('P2034 が maxRetries 回連続した場合はエラーを再 throw する', async () => {
      const deadlock = new Prisma.PrismaClientKnownRequestError(
        'Transaction failed due to a write conflict or a deadlock.',
        { code: 'P2034', clientVersion: '6.0.0' },
      );
      $transactionMock.mockRejectedValue(deadlock);

      await expect(
        service.update(
          'aaaaaaaa-0000-0000-0000-000000000001',
          0,
          { name: '有馬記念' },
          'bbbbbbbb-0000-0000-0000-000000000002',
        ),
      ).rejects.toThrow(deadlock);
      // デフォルト maxRetries=3: 3 回試みてすべて失敗
      expect($transactionMock).toHaveBeenCalledTimes(3);
    });
  });
});
