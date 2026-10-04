import {
  ConflictException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ErrorCode } from '../common/errors/error-code.enum';
import { PrismaService } from '../prisma/prisma.service';
import { withTransactionRetry } from '../prisma/with-transaction-retry';
import { CreateRaceDto } from './dto/create-race.dto';
import { UpdateRaceDto } from './dto/update-race.dto';

/** リソース未存在は 404 ではなく 422 で返す。never なので呼び出し側で到達不能になる */
function raceNotFound(id: string): never {
  throw new UnprocessableEntityException({
    message: `Race with id ${id} not found`,
    code: ErrorCode.NOT_FOUND, // 422 の既定は NOT_FOUND だが明示する
  });
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
    if (!race) raceNotFound(id);
    return race;
  }

  async create(createRaceDto: CreateRaceDto, operatorId: string) {
    const { entries, ...raceData } = createRaceDto;
    // @@unique 違反（P2002）は PrismaExceptionFilter が 409 に変換するので catch しない
    return await this.prisma.race.create({
      data: {
        ...raceData,
        createdBy: operatorId,
        updatedBy: operatorId,
        entries: { create: entries },
      },
      include: { entries: true },
    });
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
          if (!exists) raceNotFound(id);
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
    if (result.count === 0) raceNotFound(id);
  }
}
