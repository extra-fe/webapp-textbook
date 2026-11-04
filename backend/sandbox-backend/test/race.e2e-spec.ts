import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { ZodValidationPipe } from 'nestjs-zod';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filter';
import { SystemClock } from '../src/common/clock/clock';

type RaceBody = {
  id: string;
  name: string;
  entries: Array<{ horseName: string }>;
};

const MOCK_USER_ID = '00000000-0000-0000-0000-000000000001';

async function setupDb(prisma: PrismaService) {
  await prisma.user.upsert({
    where: { id: MOCK_USER_ID },
    update: {},
    create: {
      id: MOCK_USER_ID,
      externalId: 'mock-user-id-123',
      provider: 'keycloak',
      email: 'test@example.com',
      name: 'Mock User',
      roles: {
        create: [{ role: 'admin' }, { role: 'operator' }, { role: 'viewer' }],
      },
    },
  });
}

async function cleanDb(prisma: PrismaService) {
  await prisma.entry.deleteMany();
  await prisma.race.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.user.deleteMany();
}

const baseRace = {
  date: '1993-11-14T00:00:00.000Z',
  name: 'エリザベス女王杯',
  venue: '京都',
  createdBy: MOCK_USER_ID,
  updatedBy: MOCK_USER_ID,
};

const singleEntry = {
  frameNumber: 1,
  horseNumber: 1,
  horseName: 'ホクトベガ',
  sex: '牝',
  age: '4',
  jockey: '加藤和宏',
  trainer: '中野隆良',
};

describe('Race (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ZodValidationPipe());
    const clock = new SystemClock();
    app.useGlobalFilters(
      new GlobalExceptionFilter(clock),
      new PrismaExceptionFilter(clock),
    );
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await cleanDb(prisma);
    await app.close();
  });

  beforeEach(async () => {
    await cleanDb(prisma);
    await setupDb(prisma);
  });

  describe('RaceService (実 DB)', () => {
    it('create → findOne でデータが取得できること', async () => {
      const created = await prisma.race.create({
        data: {
          ...baseRace,
          entries: { create: [singleEntry] },
        },
        include: { entries: true },
      });

      const found = await prisma.race.findUnique({
        where: { id: created.id },
        include: { entries: true },
      });

      expect(found).not.toBeNull();
      expect(found!.name).toBe(baseRace.name);
      expect(found!.venue).toBe(baseRace.venue);
      expect(found!.entries).toHaveLength(1);
      expect(found!.entries[0].horseName).toBe(singleEntry.horseName);
    });

    it('findAll が複数レースを正しく返すこと', async () => {
      await prisma.race.create({
        data: { ...baseRace, entries: { create: [singleEntry] } },
      });
      await prisma.race.create({
        data: {
          date: '1994-11-13T00:00:00.000Z',
          name: 'エリザベス女王杯',
          venue: '京都',
          createdBy: MOCK_USER_ID,
          updatedBy: MOCK_USER_ID,
          entries: { create: [] },
        },
      });

      const races = await prisma.race.findMany({ include: { entries: true } });

      expect(races).toHaveLength(2);
    });

    it('存在しない ID で findUnique すると null が返ること', async () => {
      const result = await prisma.race.findUnique({
        where: { id: 'ffffffff-0000-0000-0000-000000000000' },
      });
      expect(result).toBeNull();
    });
  });

  describe('GET /api/races', () => {
    it('200 と空配列を返すこと（レース未登録時）', () => {
      return request(app.getHttpServer())
        .get('/api/races')
        .expect(200)
        .expect([]);
    });

    it('登録済みレース一覧を返すこと', async () => {
      await prisma.race.create({
        data: { ...baseRace, entries: { create: [singleEntry] } },
      });

      const res = await request(app.getHttpServer())
        .get('/api/races')
        .expect(200);
      const body = res.body as unknown as RaceBody[];

      expect(body).toHaveLength(1);
      expect(body[0].name).toBe(baseRace.name);
      expect(body[0].entries).toHaveLength(1);
    });
  });

  describe('GET /api/races/:id', () => {
    it('存在するレースを 200 で返すこと', async () => {
      const race = await prisma.race.create({
        data: { ...baseRace, entries: { create: [singleEntry] } },
        include: { entries: true },
      });

      const res = await request(app.getHttpServer())
        .get(`/api/races/${race.id}`)
        .expect(200);
      const body = res.body as unknown as RaceBody;

      expect(body.id).toBe(race.id);
      expect(body.name).toBe(baseRace.name);
      expect(body.entries).toHaveLength(1);
    });

    it('存在しない ID には 422 を返すこと', () => {
      return request(app.getHttpServer())
        .get('/api/races/ffffffff-0000-0000-0000-000000000000')
        .expect(422);
    });
  });

  describe('POST /api/races', () => {
    it('レースを作成して 201 を返すこと', async () => {
      const body = { ...baseRace, entries: [singleEntry] };

      const res = await request(app.getHttpServer())
        .post('/api/races')
        .send(body)
        .expect(201);
      const created = res.body as unknown as RaceBody;

      expect(created.name).toBe(baseRace.name);
      expect(created.entries).toHaveLength(1);
      expect(created.entries[0].horseName).toBe(singleEntry.horseName);

      const saved = await prisma.race.findUnique({
        where: { id: created.id },
      });
      expect(saved).not.toBeNull();
    });

    it('同一 date/name/venue の重複登録は 409 を返すこと', async () => {
      await prisma.race.create({ data: { ...baseRace } });

      return request(app.getHttpServer())
        .post('/api/races')
        .send({ ...baseRace, entries: [] })
        .expect(409);
    });
  });

  describe('PATCH /api/races/:id', () => {
    it('version が一致すれば 200、同じ version の再送は 409 を返すこと', async () => {
      const created = await prisma.race.create({ data: { ...baseRace } });

      await request(app.getHttpServer())
        .patch(`/api/races/${created.id}?version=0`)
        .send({ name: '更新後' })
        .expect(200);

      // 同じ version をもう一度使う＝他者が先に更新した状況
      await request(app.getHttpServer())
        .patch(`/api/races/${created.id}?version=0`)
        .send({ name: 'さらに更新' })
        .expect(409);

      const saved = await prisma.race.findUnique({ where: { id: created.id } });
      expect(saved!.name).toBe('更新後');
      expect(saved!.version).toBe(1);
    });
  });
});
