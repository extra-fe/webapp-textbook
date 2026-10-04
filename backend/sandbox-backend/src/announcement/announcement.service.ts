import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ErrorCode } from '../common/errors/error-code.enum';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';

@Injectable()
export class AnnouncementService {
  constructor(private readonly prisma: PrismaService) {}

  /** 掲載期間中のお知らせだけを返す */
  findActive(now: Date = new Date()) {
    return this.prisma.announcement.findMany({
      where: { startsAt: { lte: now }, endsAt: { gte: now } },
      orderBy: { startsAt: 'desc' },
      select: {
        id: true,
        title: true,
        body: true,
        level: true,
        startsAt: true,
        endsAt: true,
      },
    });
  }

  findAll() {
    return this.prisma.announcement.findMany({ orderBy: { startsAt: 'asc' } });
  }

  private async findOneOrThrow(id: string) {
    const announcement = await this.prisma.announcement.findUnique({
      where: { id },
    });
    if (!announcement) {
      throw new UnprocessableEntityException({
        message: `Announcement with id ${id} not found`,
        code: ErrorCode.NOT_FOUND,
      });
    }
    return announcement;
  }

  create(dto: CreateAnnouncementDto) {
    return this.prisma.announcement.create({
      data: {
        title: dto.title,
        body: dto.body,
        level: dto.level ?? 'info',
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
      },
    });
  }

  async update(id: string, dto: Partial<CreateAnnouncementDto>) {
    await this.findOneOrThrow(id);
    return this.prisma.announcement.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.body !== undefined && { body: dto.body }),
        ...(dto.level !== undefined && { level: dto.level }),
        ...(dto.startsAt !== undefined && { startsAt: new Date(dto.startsAt) }),
        ...(dto.endsAt !== undefined && { endsAt: new Date(dto.endsAt) }),
      },
    });
  }

  async remove(id: string) {
    await this.findOneOrThrow(id);
    await this.prisma.announcement.delete({ where: { id } });
  }
}
