import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class SkillsService {
  constructor(private readonly prisma: PrismaService) {}

  async catalog(): Promise<string[]> {
    const skills = await this.prisma.skill.findMany({
      select: { name: true },
      orderBy: { name: 'asc' },
    });
    return skills.map((skill) => skill.name);
  }
}
