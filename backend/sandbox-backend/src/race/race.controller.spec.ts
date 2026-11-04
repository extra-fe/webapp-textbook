jest.mock('../generated/prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({})),
  Prisma: {},
}));

import { Test, TestingModule } from '@nestjs/testing';
import { RaceController } from './race.controller';
import { RaceService } from './race.service';
import { ConditionalAuthGuard } from 'src/auth/guards/conditional-auth.guard';
import { CreateRaceDto } from './dto/create-race.dto';

const mockRace = {
  id: 'aaaaaaaa-0000-0000-0000-000000000001',
  date: '1993-11-14T00:00:00.000Z',
  name: 'エリザベス女王杯',
  venue: '京都',
  entries: [],
};

const mockRaceService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
};

describe('RaceController', () => {
  let controller: RaceController;
  let module: TestingModule;

  beforeEach(async () => {
    jest.clearAllMocks();

    module = await Test.createTestingModule({
      controllers: [RaceController],
      providers: [{ provide: RaceService, useValue: mockRaceService }],
    })
      .overrideGuard(ConditionalAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<RaceController>(RaceController);
  });

  afterEach(async () => {
    await module?.close();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return array of races', async () => {
      mockRaceService.findAll.mockResolvedValue([mockRace]);

      const result = await controller.findAll();

      expect(result).toEqual([mockRace]);
      expect(mockRaceService.findAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('findOne', () => {
    it('should return single race', async () => {
      mockRaceService.findOne.mockResolvedValue(mockRace);

      const result = await controller.findOne(
        'aaaaaaaa-0000-0000-0000-000000000001',
      );

      expect(result).toEqual(mockRace);
      expect(mockRaceService.findOne).toHaveBeenCalledWith(
        'aaaaaaaa-0000-0000-0000-000000000001',
      );
    });
  });

  describe('create', () => {
    it('should create and return race', async () => {
      const createDto: CreateRaceDto = {
        date: '1993-11-14T00:00:00.000Z',
        name: 'エリザベス女王杯',
        venue: '京都',
        entries: [],
      };
      mockRaceService.create.mockResolvedValue(mockRace);

      const result = await controller.create(
        createDto,
        'bbbbbbbb-0000-0000-0000-000000000002',
      );

      expect(result).toEqual(mockRace);
      expect(mockRaceService.create).toHaveBeenCalledWith(
        createDto,
        'bbbbbbbb-0000-0000-0000-000000000002',
      );
    });
  });
});
