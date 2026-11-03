import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { withTransactionRetry } from '../prisma/with-transaction-retry';
import { CreateRaceDto } from './dto/create-race.dto';
import { UpdateRaceDto } from './dto/update-race.dto';

/** Prisma のユニーク制約違反かを判定する。P2002 は Prisma が定めた
 *  エラーコードで、一意制約違反を表す（Prisma は定数を公開していない） */
function isUniqueConstraintError(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'
  );
}

@Injectable()
export class RaceService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    // entries は include でまとめて引く（1件ずつ引くと N+1 になる）
    return this.prisma.race.findMany({
      orderBy: { date: 'desc' },
      include: { entries: { orderBy: { horseNumber: 'asc' } } },
    });
  }

  async findOne(id: string) {
    const race = await this.prisma.race.findUnique({
      where: { id },
      include: { entries: { orderBy: { horseNumber: 'asc' } } },
    });
    if (!race) throw new NotFoundException(`Race with id ${id} not found`);
    return race;
  }

  async create(createRaceDto: CreateRaceDto, operatorId: string) {
    const { entries, ...raceData } = createRaceDto;
    try {
      return await this.prisma.race.create({
        data: {
          ...raceData,
          createdBy: operatorId,
          updatedBy: operatorId,
          entries: { create: entries },
        },
        include: { entries: true },
      });
    } catch (e) {
      // @@unique([date, name, venue]) 違反。第4章でこの変換は例外フィルタに移す
      if (isUniqueConstraintError(e)) {
        throw new ConflictException(
          '同じ日付・レース名・競馬場のレースが既に存在します',
        );
      }
      throw e;
    }
  }

  async update(
    id: string,
    version: number,
    updateRaceDto: UpdateRaceDto,
    operatorId: string,
  ) {
    // 更新が競合してデッドロック（P2034）になっても最大3回リトライする
    return withTransactionRetry(() =>
      this.prisma.$transaction(async (tx) => {
        // version 一致時のみ更新。同時更新が起きると片方は count === 0 になる
        const result = await tx.race.updateMany({
          where: { id, version },
          data: {
            ...updateRaceDto,
            updatedBy: operatorId,
            version: { increment: 1 },
          },
        });

        if (result.count === 0) {
          const exists = await tx.race.findUnique({ where: { id } });
          if (!exists)
            throw new NotFoundException(`Race with id ${id} not found`);
          throw new ConflictException(
            `Race with id ${id} was updated by another request. Reload and retry.`,
          );
        }

        return tx.race.findUnique({
          where: { id },
          include: { entries: true },
        });
      }),
    );
  }

  async remove(id: string) {
    // entries は onDelete: Cascade で自動的に消える
    const result = await this.prisma.race.deleteMany({ where: { id } });
    if (result.count === 0)
      throw new NotFoundException(`Race with id ${id} not found`);
  }
}
