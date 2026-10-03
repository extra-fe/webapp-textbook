import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
}
