import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EtapaProjeto } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { OrgPortalService } from './orgPortal.service';

const dbProject = {
  id: 1,
  title: 'Painel das Feiras',
  agreedDeliverable: null,
  teams: 2,
  startDate: null,
  endDate: null,
  outcomeSummary: null,
  outcomeAdoption: null,
  milestones: [{ step: EtapaProjeto.PARCIAL, dueAt: new Date(), doneAt: null }],
  course: {
    name: 'Desenvolvimento de Software',
    code: 'IF682',
    semester: '2026.2',
    professor: {
      name: 'Paola',
      department: 'CIn',
      phone: null,
      user: { email: 'paola@ufpe.br' },
    },
  },
  demand: { id: 10, title: 'Painel das Feiras' },
};

describe('OrgPortalService', () => {
  let service: OrgPortalService;

  const prisma = {
    partner: { findUnique: jest.fn() },
    project: { findMany: jest.fn(), findFirst: jest.fn() },
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    prisma.partner.findUnique.mockResolvedValue({ id: 5 });
    const module = await Test.createTestingModule({
      providers: [
        OrgPortalService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(OrgPortalService);
  });

  it('espelha o projeto com o contato do docente e etapas traduzidas', async () => {
    prisma.project.findFirst.mockResolvedValue(dbProject);
    const result = await service.findOne('2', 1);

    expect(result.professor).toEqual({
      name: 'Paola',
      department: 'CIn',
      phone: null,
      email: 'paola@ufpe.br',
    });
    expect(result.milestones[0].step).toBe('midterm');
  });

  it('nunca seleciona a anotação pedagógica das etapas', async () => {
    prisma.project.findMany.mockResolvedValue([dbProject]);
    await service.findAll('2');

    type FindManyArgs = {
      select: { milestones: { select: Record<string, boolean> } };
    };
    const [[{ select }]] = prisma.project.findMany.mock.calls as [
      [FindManyArgs],
    ];
    expect(select.milestones.select).not.toHaveProperty('note');
    expect(select.milestones.select).toEqual({
      step: true,
      dueAt: true,
      doneAt: true,
    });
  });

  it('só enxerga projetos das demandas da própria organização', async () => {
    prisma.project.findFirst.mockResolvedValue(null);
    await expect(service.findOne('2', 1)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.project.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1, demand: { partnerId: 5 } },
      }),
    );
  });
});
