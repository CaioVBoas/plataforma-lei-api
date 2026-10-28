import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  EtapaSubmissao,
  NivelCurso,
  TipoParceiro,
  ViabilidadeEscopo,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { DemandsService } from './demands.service';

describe('DemandsService', () => {
  let service: DemandsService;

  const mockProfessor = {
    id: 10,
    userId: 1,
    name: 'Paola Accioly',
    department: 'Centro de Informática',
    user: {
      id: 1,
      email: 'paola.accioly@ufpe.br',
    },
  };

  const mockOtherProfessor = {
    id: 20,
    userId: 2,
    name: 'Luiz Morais',
    department: 'Centro de Informática',
    user: {
      id: 2,
      email: 'luiz.morais@ufpe.br',
    },
  };

  const mockPartner = {
    id: 5,
    name: 'Hospital das Clínicas',
    type: TipoParceiro.ORGAO_PUBLICO,
    location: 'Recife',
    about: 'Hospital universitário',
    audience: 'Pacientes SUS',
    site: 'hc.ufpe.br',
    meetingCadence: 'Quinzenal',
    onSiteVisit: 'Sim',
    logo: 'data:image/png;base64,logo',
    cover: 'data:image/png;base64,cover',
    focalName: 'Renata Vasconcelos',
    demands: [],
  };

  const createMockDemand = (overrides: Record<string, unknown> = {}) => ({
    id: 1,
    partnerId: 5,
    title: 'Fila de consultas do interior',
    problem: 'Problema na fila',
    description: 'Descrição completa',
    affectedAudience: 'Pacientes do SUS',
    expectedOutcome: 'Protótipo',
    level: NivelCurso.INTERMEDIARIO,
    scopeFit: ViabilidadeEscopo.CABE_NO_SEMESTRE,
    scopeNote: 'Nota de escopo',
    meetingCadence: 'Quinzenal',
    constraints: ['sensitive-data'],
    offers: ['Dados anonimizados'],
    stage: EtapaSubmissao.PUBLICADA,
    publishedAt: new Date('2026-08-18T10:00:00Z'),
    createdAt: new Date('2026-08-18T10:00:00Z'),
    updatedAt: new Date('2026-08-18T10:00:00Z'),
    reservedByProfessorId: null,
    reservationDeadline: null,
    partner: mockPartner,
    reservedByProfessor: null,
    skills: [
      { skill: { id: 1, name: 'Engenharia de software' } },
      { skill: { id: 2, name: 'Banco de dados' } },
    ],
    references: [
      {
        id: 1,
        demandId: 1,
        name: 'SISREG',
        description: 'Sistema nacional',
        url: 'https://sisreg.gov.br',
      },
    ],
    questions: [],
    watchers: [],
    invitations: [],
    project: null,
    ...overrides,
  });

  const prisma = {
    demand: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    demandWatcher: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    demandQuestion: {
      create: jest.fn(),
    },
    professor: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DemandsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<DemandsService>(DemandsService);
  });

  describe('getMenu', () => {
    it('deve expirar reservas passadas e retornar apenas demandas publicadas sem projeto', async () => {
      prisma.demand.updateMany.mockResolvedValue({ count: 1 });
      prisma.professor.findUnique.mockResolvedValue(mockProfessor);

      const openDemand = createMockDemand({ id: 1, title: 'Demanda Aberta' });
      const reservedDemand = createMockDemand({
        id: 2,
        title: 'Demanda Reservada',
        reservedByProfessorId: mockProfessor.id,
        reservedByProfessor: mockProfessor,
        reservationDeadline: new Date(Date.now() + 86400000),
      });

      prisma.demand.findMany.mockResolvedValue([openDemand, reservedDemand]);

      const result = await service.getMenu('1');

      expect(prisma.demand.updateMany).toHaveBeenCalledWith({
        where: {
          reservedByProfessorId: { not: null },
          reservationDeadline: { lt: expect.any(Date) },
        },
        data: {
          reservedByProfessorId: null,
          reservationDeadline: null,
        },
      });

      expect(prisma.demand.findMany).toHaveBeenCalledWith({
        where: {
          stage: EtapaSubmissao.PUBLICADA,
          project: null,
        },
        include: expect.any(Object),
        orderBy: { id: 'asc' },
      });

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('1');
      expect(result[0].status).toBe('open');
      expect(result[0].organization.name).toBe('Hospital das Clínicas');
      expect(result[0].organization.type).toBe('Órgão público');
      expect(result[0].skills).toEqual([
        'Engenharia de software',
        'Banco de dados',
      ]);
      expect(result[0].level).toBe('intermediate');
      expect(result[0].scopeFit).toBe('fits');

      expect(result[1].id).toBe('2');
      expect(result[1].status).toBe('reserved');
      expect(result[1].reservation).toBeDefined();
      expect(result[1].reservation?.teacherName).toBe('Paola Accioly');
      expect(result[1].reservation?.mine).toBe(true);
    });

    it('deve marcar watching e filtrar convite direcionado ao professor logado', async () => {
      prisma.demand.updateMany.mockResolvedValue({ count: 0 });
      prisma.professor.findUnique.mockResolvedValue(mockProfessor);

      const demandWithWatcherAndInvitation = createMockDemand({
        id: 3,
        watchers: [{ demandId: 3, professorId: mockProfessor.id }],
        invitations: [
          {
            id: 1,
            demandId: 3,
            professorId: mockProfessor.id,
            fromName: 'Kiev Santos, L.E.I.',
            message: 'Demanda indicada para sua turma',
            sentAt: new Date('2026-08-20T10:00:00Z'),
          },
          {
            id: 2,
            demandId: 3,
            professorId: mockOtherProfessor.id,
            fromName: 'Kiev Santos, L.E.I.',
            message: 'Convite para outro docente',
            sentAt: new Date('2026-08-20T10:00:00Z'),
          },
        ],
      });

      prisma.demand.findMany.mockResolvedValue([
        demandWithWatcherAndInvitation,
      ]);

      const result = await service.getMenu('1');

      expect(result[0].watching).toBe(true);
      expect(result[0].invitation).toBeDefined();
      expect(result[0].invitation?.to).toBe('paola.accioly@ufpe.br');
      expect(result[0].invitation?.from).toBe('Kiev Santos, L.E.I.');
      expect(result[0].invitation?.message).toBe(
        'Demanda indicada para sua turma',
      );
    });
  });

  describe('getDemand', () => {
    it('deve retornar detalhes da demanda com a organização formatada', async () => {
      prisma.demand.updateMany.mockResolvedValue({ count: 0 });
      prisma.professor.findUnique.mockResolvedValue(mockProfessor);

      const demand = createMockDemand({ id: 1 });
      prisma.demand.findUnique.mockResolvedValue(demand);

      const result = await service.getDemand(1, '1');

      expect(result.demand.id).toBe('1');
      expect(result.organization.name).toBe('Hospital das Clínicas');
      expect(result.organization.location).toBe('Recife');
      expect(result.projectId).toBeUndefined();
    });

    it('deve incluir projectId se a demanda estiver associada a um projeto do professor', async () => {
      prisma.demand.updateMany.mockResolvedValue({ count: 0 });
      prisma.professor.findUnique.mockResolvedValue(mockProfessor);

      const demandInProject = createMockDemand({
        id: 1,
        project: {
          id: 99,
          course: {
            professorId: mockProfessor.id,
            coTeachers: [],
          },
        },
      });
      prisma.demand.findUnique.mockResolvedValue(demandInProject);

      const result = await service.getDemand(1, '1');

      expect(result.projectId).toBe('99');
      expect(result.demand.status).toBe('in-project');
    });

    it('deve lançar NotFoundException se a demanda estiver em projeto de outro professor', async () => {
      prisma.demand.updateMany.mockResolvedValue({ count: 0 });
      prisma.professor.findUnique.mockResolvedValue(mockProfessor);

      const demandInOtherProject = createMockDemand({
        id: 1,
        project: {
          id: 99,
          course: {
            professorId: mockOtherProfessor.id,
            coTeachers: [],
          },
        },
      });
      prisma.demand.findUnique.mockResolvedValue(demandInOtherProject);

      await expect(service.getDemand(1, '1')).rejects.toThrow(
        new NotFoundException(
          'Esta demanda já foi levada para a disciplina de outro docente.',
        ),
      );
    });

    it('deve lançar NotFoundException se a demanda não existir ou não estiver publicada', async () => {
      prisma.demand.updateMany.mockResolvedValue({ count: 0 });
      prisma.professor.findUnique.mockResolvedValue(mockProfessor);
      prisma.demand.findUnique.mockResolvedValue(null);

      await expect(service.getDemand(999, '1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('reserveDemand', () => {
    it('deve reservar uma demanda com sucesso e definir prazo para 14 dias', async () => {
      prisma.professor.findUnique.mockResolvedValue(mockProfessor);
      prisma.demand.updateMany.mockResolvedValue({ count: 0 });

      const openDemand = createMockDemand({ id: 1 });
      prisma.demand.findUnique
        .mockResolvedValueOnce(openDemand) // first check
        .mockResolvedValueOnce({
          ...openDemand,
          reservedByProfessorId: mockProfessor.id,
          reservedByProfessor: mockProfessor,
          reservationDeadline: new Date(Date.now() + 14 * 86400000),
        }); // updated reload

      prisma.demand.count.mockResolvedValue(0);
      prisma.demandWatcher.deleteMany.mockResolvedValue({ count: 1 });
      prisma.demand.update.mockResolvedValue({});

      const result = await service.reserveDemand(1, '1');

      expect(prisma.demandWatcher.deleteMany).toHaveBeenCalledWith({
        where: { demandId: 1, professorId: mockProfessor.id },
      });
      expect(prisma.demand.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          reservedByProfessorId: mockProfessor.id,
          reservationDeadline: expect.any(Date),
        },
      });
      expect(result.status).toBe('reserved');
      expect(result.reservation?.mine).toBe(true);
    });

    it('deve lançar BadRequestException se a demanda já estiver reservada ou com projeto', async () => {
      prisma.professor.findUnique.mockResolvedValue(mockProfessor);
      prisma.demand.updateMany.mockResolvedValue({ count: 0 });

      const alreadyReservedDemand = createMockDemand({
        id: 1,
        reservedByProfessorId: mockOtherProfessor.id,
      });
      prisma.demand.findUnique.mockResolvedValue(alreadyReservedDemand);

      await expect(service.reserveDemand(1, '1')).rejects.toThrow(
        new BadRequestException(
          'Esta demanda não está mais livre no cardápio.',
        ),
      );
    });

    it('deve lançar BadRequestException se o professor já tiver 2 reservas ativas', async () => {
      prisma.professor.findUnique.mockResolvedValue(mockProfessor);
      prisma.demand.updateMany.mockResolvedValue({ count: 0 });

      const openDemand = createMockDemand({ id: 1 });
      prisma.demand.findUnique.mockResolvedValue(openDemand);
      prisma.demand.count.mockResolvedValue(2);

      await expect(service.reserveDemand(1, '1')).rejects.toThrow(
        new BadRequestException(
          'Você já tem 2 reservas ativas. Libere uma ou leve alguma para a disciplina antes de reservar outra.',
        ),
      );
    });

    it('deve lançar ForbiddenException se o perfil de docente não for encontrado', async () => {
      prisma.professor.findUnique.mockResolvedValue(null);

      await expect(service.reserveDemand(1, '999')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('releaseReservation', () => {
    it('deve liberar uma reserva feita pelo professor autenticado', async () => {
      prisma.professor.findUnique.mockResolvedValue(mockProfessor);
      prisma.demand.updateMany.mockResolvedValue({ count: 0 });

      const reservedDemand = createMockDemand({
        id: 1,
        reservedByProfessorId: mockProfessor.id,
        reservationDeadline: new Date(Date.now() + 86400000),
      });

      prisma.demand.findUnique
        .mockResolvedValueOnce(reservedDemand)
        .mockResolvedValueOnce({
          ...reservedDemand,
          reservedByProfessorId: null,
          reservationDeadline: null,
        });

      prisma.demand.update.mockResolvedValue({});

      const result = await service.releaseReservation(1, '1');

      expect(prisma.demand.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          reservedByProfessorId: null,
          reservationDeadline: null,
        },
      });
      expect(result.status).toBe('open');
      expect(result.reservation).toBeUndefined();
    });

    it('deve lançar BadRequestException se a reserva pertencer a outro professor', async () => {
      prisma.professor.findUnique.mockResolvedValue(mockProfessor);
      prisma.demand.updateMany.mockResolvedValue({ count: 0 });

      const reservedByOther = createMockDemand({
        id: 1,
        reservedByProfessorId: mockOtherProfessor.id,
      });

      prisma.demand.findUnique.mockResolvedValue(reservedByOther);

      await expect(service.releaseReservation(1, '1')).rejects.toThrow(
        new BadRequestException('Esta reserva não é sua.'),
      );
    });
  });

  describe('toggleWatch', () => {
    it('deve cadastrar watcher quando não estiver monitorando demanda de outro professor', async () => {
      prisma.professor.findUnique.mockResolvedValue(mockProfessor);
      prisma.demand.updateMany.mockResolvedValue({ count: 0 });

      const demandReservedByOther = createMockDemand({
        id: 1,
        reservedByProfessorId: mockOtherProfessor.id,
      });

      prisma.demand.findUnique
        .mockResolvedValueOnce(demandReservedByOther)
        .mockResolvedValueOnce({
          ...demandReservedByOther,
          watchers: [{ demandId: 1, professorId: mockProfessor.id }],
        });

      prisma.demandWatcher.findUnique.mockResolvedValue(null);
      prisma.demandWatcher.create.mockResolvedValue({});

      const result = await service.toggleWatch(1, '1');

      expect(prisma.demandWatcher.create).toHaveBeenCalledWith({
        data: {
          demandId: 1,
          professorId: mockProfessor.id,
        },
      });
      expect(result.watching).toBe(true);
    });

    it('deve remover watcher quando já estiver monitorando', async () => {
      prisma.professor.findUnique.mockResolvedValue(mockProfessor);
      prisma.demand.updateMany.mockResolvedValue({ count: 0 });

      const demandReservedByOther = createMockDemand({
        id: 1,
        reservedByProfessorId: mockOtherProfessor.id,
        watchers: [{ demandId: 1, professorId: mockProfessor.id }],
      });

      prisma.demand.findUnique
        .mockResolvedValueOnce(demandReservedByOther)
        .mockResolvedValueOnce({
          ...demandReservedByOther,
          watchers: [],
        });

      prisma.demandWatcher.findUnique.mockResolvedValue({
        demandId: 1,
        professorId: mockProfessor.id,
      });
      prisma.demandWatcher.delete.mockResolvedValue({});

      const result = await service.toggleWatch(1, '1');

      expect(prisma.demandWatcher.delete).toHaveBeenCalledWith({
        where: {
          demandId_professorId: {
            demandId: 1,
            professorId: mockProfessor.id,
          },
        },
      });
      expect(result.watching).toBe(false);
    });

    it('deve lançar BadRequestException se tentar vigiar demanda livre ou reservada por ele mesmo', async () => {
      prisma.professor.findUnique.mockResolvedValue(mockProfessor);
      prisma.demand.updateMany.mockResolvedValue({ count: 0 });

      const demandMine = createMockDemand({
        id: 1,
        reservedByProfessorId: mockProfessor.id,
      });

      prisma.demand.findUnique.mockResolvedValue(demandMine);

      await expect(service.toggleWatch(1, '1')).rejects.toThrow(
        new BadRequestException(
          'O aviso vale só para demandas reservadas por outro docente.',
        ),
      );
    });
  });

  describe('askQuestion', () => {
    it('deve criar uma pergunta vinculada à demanda e ao professor', async () => {
      prisma.professor.findUnique.mockResolvedValue(mockProfessor);

      const demand = createMockDemand({ id: 1 });
      prisma.demand.findUnique
        .mockResolvedValueOnce(demand)
        .mockResolvedValueOnce({
          ...demand,
          questions: [
            {
              id: 101,
              demandId: 1,
              teacherId: mockProfessor.id,
              authorId: mockProfessor.userId,
              teacher: mockProfessor,
              text: 'Qual é o formato dos dados?',
              askedAt: new Date('2026-08-23T11:20:00Z'),
              answerText: null,
              answeredBy: null,
              answeredAt: null,
            },
          ],
        });

      prisma.demandQuestion.create.mockResolvedValue({});

      const result = await service.askQuestion(
        1,
        '1',
        'Qual é o formato dos dados?',
      );

      expect(prisma.demandQuestion.create).toHaveBeenCalledWith({
        data: {
          demandId: 1,
          teacherId: mockProfessor.id,
          authorId: mockProfessor.userId,
          text: 'Qual é o formato dos dados?',
          askedAt: expect.any(Date),
        },
      });
      expect(result.questions).toHaveLength(1);
      expect(result.questions[0].text).toBe('Qual é o formato dos dados?');
      expect(result.questions[0].teacherName).toBe('Paola Accioly');
      expect(result.questions[0].mine).toBe(true);
    });

    it('deve lançar BadRequestException se a pergunta for vazia', async () => {
      prisma.professor.findUnique.mockResolvedValue(mockProfessor);

      await expect(service.askQuestion(1, '1', '   ')).rejects.toThrow(
        new BadRequestException('Escreva a pergunta.'),
      );
    });

    it('deve lançar BadRequestException se a pergunta passar de 500 caracteres', async () => {
      prisma.professor.findUnique.mockResolvedValue(mockProfessor);

      const longQuestion = 'a'.repeat(501);

      await expect(service.askQuestion(1, '1', longQuestion)).rejects.toThrow(
        new BadRequestException(
          'A pergunta passa de 500 caracteres. Tente ser mais direto.',
        ),
      );
    });

    it('deve lançar BadRequestException se a demanda já tiver virado projeto', async () => {
      prisma.professor.findUnique.mockResolvedValue(mockProfessor);

      const demandWithProject = createMockDemand({
        id: 1,
        project: { id: 10 },
      });
      prisma.demand.findUnique.mockResolvedValue(demandWithProject);

      await expect(
        service.askQuestion(1, '1', 'Qual a tecnologia preferida?'),
      ).rejects.toThrow(
        new BadRequestException(
          'Esta demanda já virou projeto. Fale com a organização pelo contato do projeto.',
        ),
      );
    });
  });
});
