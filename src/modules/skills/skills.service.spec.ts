import { Test } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { SkillsService } from './skills.service';

describe('SkillsService', () => {
  const findMany = jest.fn<Promise<{ name: string }[]>, [unknown]>();
  let service: SkillsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        SkillsService,
        { provide: PrismaService, useValue: { skill: { findMany } } },
      ],
    }).compile();
    service = module.get(SkillsService);
  });

  it('devolve só os nomes, em ordem alfabética', async () => {
    findMany.mockResolvedValue([{ name: 'Design' }, { name: 'React' }]);

    await expect(service.catalog()).resolves.toEqual(['Design', 'React']);
    expect(findMany).toHaveBeenCalledWith({
      select: { name: true },
      orderBy: { name: 'asc' },
    });
  });
});
