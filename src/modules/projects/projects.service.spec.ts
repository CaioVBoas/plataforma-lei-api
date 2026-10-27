import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EtapaProjeto, NivelCurso } from '@prisma/client';
import { BusinessRuleException } from '../../common/exceptions/businessRule.exception';
import { PrismaService } from '../../database/prisma.service';
import { Adoption, MilestoneStep } from './projects.steps';
import { ProjectsService } from './projects.service';

const ETAPAS = [
  EtapaProjeto.PLANO,
  EtapaProjeto.KICKOFF,
  EtapaProjeto.SIGAA,
  EtapaProjeto.PARCIAL,
  EtapaProjeto.FINAL,
  EtapaProjeto.ENCERRAMENTO,
];

const future = (days: number) => new Date(Date.now() + days * 86_400_000);

const calendar = {
  startsAt: future(-30),
  endsAt: future(120),
  linkDeadline: future(30),
  midtermAt: future(60),
  finalAt: future(100),
};

const baseDemand = {
  id: 10,
  title: 'Painel das Feiras',
  level: NivelCurso.INTERMEDIARIO,
  reservedByProfessorId: 7,
  project: null,
};

const baseCourse = {
  id: 3,
  professorId: 7,
  semester: '2026.2',
  enrolledStudents: 35,
  teamSize: 5,
  projectCapacity: 3,
  expectedLevel: NivelCurso.INTERMEDIARIO,
};

/** Projeto do docente com as etapas informadas já concluídas. */
const projectWith = (done: EtapaProjeto[] = []) => ({
  id: 1,
  demandId: 10,
  course: baseCourse,
  milestones: ETAPAS.map((step, i) => ({
    id: i + 1,
    step,
    dueAt: future(i),
    doneAt: done.includes(step) ? new Date() : null,
    note: null,
  })),
  proposalSections: [
    { id: 1, order: 1, title: 'Resumo', limit: 10, text: '' },
    { id: 2, order: 2, title: 'Justificativa', limit: 2000, text: '' },
  ],
  workloads: [],
  outcomeAdoption: null,
});

describe('ProjectsService', () => {
  let service: ProjectsService;

  const prisma = {
    professor: { findUnique: jest.fn() },
    demand: { findUnique: jest.fn(), update: jest.fn() },
    course: { findFirst: jest.fn() },
    academicCalendar: { findUnique: jest.fn() },
    project: {
      count: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    projectMilestone: { update: jest.fn() },
    proposalSection: { update: jest.fn() },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation((arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (tx: typeof prisma) => unknown)(prisma)
        : Promise.all(arg as unknown[]),
    );
    prisma.professor.findUnique.mockResolvedValue({ id: 7 });

    const module = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(ProjectsService);
  });

  describe('adopt', () => {
    const dto = { demandId: 10, courseId: 3, teams: 2 };

    beforeEach(() => {
      prisma.demand.findUnique.mockResolvedValue(baseDemand);
      prisma.course.findFirst.mockResolvedValue(baseCourse);
      prisma.academicCalendar.findUnique.mockResolvedValue(calendar);
      prisma.project.count.mockResolvedValue(0);
      prisma.project.create.mockImplementation(
        ({ data }: { data: { milestones: unknown } }) => ({
          ...projectWith(),
          data,
        }),
      );
    });

    it('cria o projeto com 6 etapas, plano e carga horária', async () => {
      await service.adopt('1', dto);

      type CreateArgs = {
        data: {
          title: string;
          milestones: { create: { step: EtapaProjeto; dueAt: Date }[] };
          proposalSections: { create: unknown[] };
          workloads: { create: unknown[] };
        };
      };
      const [[{ data }]] = prisma.project.create.mock.calls as [[CreateArgs]];

      expect(data.title).toBe('Painel das Feiras');
      expect(data.milestones.create.map((m) => m.step)).toEqual(ETAPAS);
      expect(data.milestones.create[2].dueAt).toBe(calendar.linkDeadline);
      expect(data.milestones.create[3].dueAt).toBe(calendar.midtermAt);
      expect(data.proposalSections.create.length).toBeGreaterThan(0);
      expect(data.workloads.create.length).toBeGreaterThan(0);
    });

    it('rejeita demanda reservada por outro docente', async () => {
      prisma.demand.findUnique.mockResolvedValue({
        ...baseDemand,
        reservedByProfessorId: 99,
      });
      await expect(service.adopt('1', dto)).rejects.toBeInstanceOf(
        BusinessRuleException,
      );
      expect(prisma.project.create).not.toHaveBeenCalled();
    });

    it('rejeita demanda já adotada', async () => {
      prisma.demand.findUnique.mockResolvedValue({
        ...baseDemand,
        project: { id: 1 },
      });
      await expect(service.adopt('1', dto)).rejects.toBeInstanceOf(
        BusinessRuleException,
      );
    });

    it('rejeita turma sem vagas livres', async () => {
      prisma.project.count.mockResolvedValue(3);
      await expect(service.adopt('1', dto)).rejects.toThrow(/vagas/);
    });

    it('rejeita demanda acima do nível do curso', async () => {
      prisma.demand.findUnique.mockResolvedValue({
        ...baseDemand,
        level: NivelCurso.AVANCADO,
      });
      await expect(service.adopt('1', dto)).rejects.toThrow(/nível/);
    });

    it('rejeita adoção após o prazo semestral', async () => {
      prisma.academicCalendar.findUnique.mockResolvedValue({
        ...calendar,
        linkDeadline: future(-1),
      });
      await expect(service.adopt('1', dto)).rejects.toThrow(/prazo/);
    });

    it('rejeita mais equipes do que a turma comporta', async () => {
      await expect(
        service.adopt('1', { ...dto, teams: 8 }),
      ).rejects.toBeInstanceOf(BusinessRuleException);
    });

    it('trata disciplina de outro docente como inexistente', async () => {
      prisma.course.findFirst.mockResolvedValue(null);
      await expect(service.adopt('1', dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('updatePlan', () => {
    it('edita o texto das seções', async () => {
      prisma.project.findFirst.mockResolvedValue(projectWith());
      await service.updatePlan('1', 1, {
        sections: [{ order: 2, text: 'Nova justificativa' }],
      });
      expect(prisma.proposalSection.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: { text: 'Nova justificativa' },
      });
    });

    it('bloqueia a edição após concluir o SIGAA', async () => {
      prisma.project.findFirst.mockResolvedValue(
        projectWith([
          EtapaProjeto.PLANO,
          EtapaProjeto.KICKOFF,
          EtapaProjeto.SIGAA,
        ]),
      );
      await expect(
        service.updatePlan('1', 1, { sections: [{ order: 1, text: 'x' }] }),
      ).rejects.toBeInstanceOf(BusinessRuleException);
      expect(prisma.proposalSection.update).not.toHaveBeenCalled();
    });

    it('rejeita texto acima do limite da seção', async () => {
      prisma.project.findFirst.mockResolvedValue(projectWith());
      await expect(
        service.updatePlan('1', 1, {
          sections: [{ order: 1, text: 'x'.repeat(11) }],
        }),
      ).rejects.toThrow(/limite/);
    });
  });

  describe('completeMilestone', () => {
    beforeEach(() => {
      prisma.project.update.mockResolvedValue(projectWith());
    });

    it('exige a ordem sequencial das etapas', async () => {
      prisma.project.findFirst.mockResolvedValue(projectWith());
      await expect(
        service.completeMilestone('1', 1, MilestoneStep.KICKOFF, {}),
      ).rejects.toThrow(/plan/);
    });

    it('conclui a primeira etapa', async () => {
      prisma.project.findFirst.mockResolvedValue(projectWith());
      await service.completeMilestone('1', 1, MilestoneStep.PLAN, {
        note: 'anotação interna',
      });
      expect(prisma.projectMilestone.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { doneAt: expect.any(Date) as Date, note: 'anotação interna' },
      });
    });

    it('exige o código do SIGAA e o grava no projeto', async () => {
      prisma.project.findFirst.mockResolvedValue(
        projectWith([EtapaProjeto.PLANO, EtapaProjeto.KICKOFF]),
      );
      await expect(
        service.completeMilestone('1', 1, MilestoneStep.SIGAA, {}),
      ).rejects.toBeInstanceOf(BusinessRuleException);

      await service.completeMilestone('1', 1, MilestoneStep.SIGAA, {
        sigaaCode: 'PJ-123',
      });
      expect(prisma.project.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { sigaaCode: 'PJ-123' } }),
      );
    });

    it('no encerramento, registra resumo e nível de adoção', async () => {
      prisma.project.findFirst.mockResolvedValue(
        projectWith(ETAPAS.slice(0, 5)),
      );
      await expect(
        service.completeMilestone('1', 1, MilestoneStep.CLOSING, {}),
      ).rejects.toBeInstanceOf(BusinessRuleException);

      await service.completeMilestone('1', 1, MilestoneStep.CLOSING, {
        outcome: { summary: 'Em uso na ONG', adoption: Adoption.IN_USE },
      });
      expect(prisma.project.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { outcomeSummary: 'Em uso na ONG', outcomeAdoption: 'EM_USO' },
        }),
      );
    });

    it('não conclui a mesma etapa duas vezes', async () => {
      prisma.project.findFirst.mockResolvedValue(
        projectWith([EtapaProjeto.PLANO]),
      );
      await expect(
        service.completeMilestone('1', 1, MilestoneStep.PLAN, {}),
      ).rejects.toThrow(/já foi concluída/);
    });
  });

  describe('withdraw', () => {
    it('remove o projeto e devolve a demanda ao cardápio', async () => {
      prisma.project.findFirst.mockResolvedValue(projectWith());
      await service.withdraw('1', 1);
      expect(prisma.project.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(prisma.demand.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { reservedByProfessorId: null, reservationDeadline: null },
      });
    });

    it('rejeita a desistência após o SIGAA', async () => {
      prisma.project.findFirst.mockResolvedValue(
        projectWith([
          EtapaProjeto.PLANO,
          EtapaProjeto.KICKOFF,
          EtapaProjeto.SIGAA,
        ]),
      );
      await expect(service.withdraw('1', 1)).rejects.toBeInstanceOf(
        BusinessRuleException,
      );
      expect(prisma.project.delete).not.toHaveBeenCalled();
    });
  });

  describe('escopo do docente', () => {
    it('trata projeto de outro docente como inexistente', async () => {
      prisma.project.findFirst.mockResolvedValue(null);
      await expect(service.findOne('1', 99)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
