import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  EtapaSubmissao,
  EtapaProjeto,
  NivelCurso,
  ViabilidadeEscopo,
  TipoParceiro,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { OrgDemandsService } from './orgDemands.service';

describe('OrgDemandsService', () => {
  let service: OrgDemandsService;

  const mockPartner = {
    id: 1,
    userId: 10,
    name: 'Hospital das Clínicas',
    type: TipoParceiro.ORGAO_PUBLICO,
    focalName: 'Renata Vasconcelos',
    logo: 'data:image/png;base64,abc',
  };

  const prismaMock = {
    partner: {
      findUnique: jest.fn(),
    },
    demand: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    demandQuestion: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    demandSkill: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    skill: {
      upsert: jest.fn(),
    },
    reference: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrgDemandsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<OrgDemandsService>(OrgDemandsService);
  });

  describe('getPartner', () => {
    it('deve retornar o parceiro se existir', async () => {
      prismaMock.partner.findUnique.mockResolvedValue(mockPartner);

      const result = await service.getPartner(10);
      expect(result).toEqual(mockPartner);
      expect(prismaMock.partner.findUnique).toHaveBeenCalledWith({
        where: { userId: 10 },
      });
    });

    it('deve lançar UnauthorizedException para userId inválido', async () => {
      await expect(service.getPartner('invalido')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('deve lançar ForbiddenException se parceiro não for encontrado', async () => {
      prismaMock.partner.findUnique.mockResolvedValue(null);

      await expect(service.getPartner(999)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('listDemands', () => {
    it('deve listar demandas mapeadas para OrgDemandSummary ordenadas por data decrescente', async () => {
      prismaMock.partner.findUnique.mockResolvedValue(mockPartner);

      const mockDemands = [
        {
          id: 1,
          partnerId: 1,
          title: 'Demanda 1',
          problem: 'Problema 1',
          stage: EtapaSubmissao.RASCUNHO,
          updatedAt: new Date('2026-09-01T10:00:00Z'),
          questions: [],
          skills: [],
          references: [],
          project: null,
          reservedByProfessor: null,
        },
        {
          id: 2,
          partnerId: 1,
          title: 'Demanda 2',
          problem: 'Problema 2',
          stage: EtapaSubmissao.EM_TRIAGEM,
          updatedAt: new Date('2026-09-02T10:00:00Z'),
          submittedAt: new Date('2026-09-03T10:00:00Z'),
          questions: [],
          skills: [],
          references: [],
          project: null,
          reservedByProfessor: null,
        },
        {
          id: 3,
          partnerId: 1,
          title: 'Demanda 3',
          problem: 'Problema 3',
          stage: EtapaSubmissao.AJUSTE_PEDIDO,
          reviewNote: 'Ajustar escopo',
          reviewedBy: 'Comitê LEI',
          reviewedAt: new Date('2026-09-04T10:00:00Z'),
          updatedAt: new Date('2026-09-04T10:00:00Z'),
          questions: [],
          skills: [],
          references: [],
          project: null,
          reservedByProfessor: null,
        },
        {
          id: 4,
          partnerId: 1,
          title: 'Demanda 4',
          problem: 'Problema 4',
          stage: EtapaSubmissao.PUBLICADA,
          publishedAt: new Date('2026-09-05T10:00:00Z'),
          updatedAt: new Date('2026-09-05T10:00:00Z'),
          questions: [{ id: 101, answerText: null }],
          skills: [],
          references: [],
          project: null,
          reservedByProfessor: null,
        },
        {
          id: 5,
          partnerId: 1,
          title: 'Demanda 5',
          problem: 'Problema 5',
          stage: EtapaSubmissao.PUBLICADA,
          publishedAt: new Date('2026-09-06T10:00:00Z'),
          updatedAt: new Date('2026-09-06T10:00:00Z'),
          questions: [],
          skills: [],
          references: [],
          project: {
            id: 201,
            milestones: [
              { step: EtapaProjeto.ENCERRAMENTO, doneAt: new Date('2026-12-01') },
            ],
          },
          reservedByProfessor: null,
        },
      ];

      prismaMock.demand.findMany.mockResolvedValue(mockDemands);

      const result = await service.listDemands('10');

      expect(result).toHaveLength(5);
      // Demanda 5 (concluída) tem date 2026-09-06, sendo a mais recente
      expect(result[0].id).toBe('5');
      expect(result[0].stage).toBe('done');
      expect(result[0].projectId).toBe('201');

      // Demanda 4 tem pergunta não respondida
      const d4 = result.find((d) => d.id === '4');
      expect(d4?.stage).toBe('open');
      expect(d4?.unanswered).toBe(1);

      // Demanda 3 tem review de ajuste
      const d3 = result.find((d) => d.id === '3');
      expect(d3?.stage).toBe('needs-changes');
      expect(d3?.review?.note).toBe('Ajustar escopo');

      // Demanda 2 está em triagem
      const d2 = result.find((d) => d.id === '2');
      expect(d2?.stage).toBe('in-review');

      // Demanda 1 está em rascunho
      const d1 = result.find((d) => d.id === '1');
      expect(d1?.stage).toBe('draft');
    });
  });

  describe('listQuestionDemands', () => {
    it('deve listar demandas com perguntas ordenando as não respondidas primeiro', async () => {
      prismaMock.partner.findUnique.mockResolvedValue(mockPartner);

      const d1 = {
        id: 1,
        partnerId: 1,
        partner: mockPartner,
        title: 'Demanda Respondida',
        problem: 'Problema',
        description: 'Desc',
        affectedAudience: 'Público',
        level: NivelCurso.INTERMEDIARIO,
        scopeFit: ViabilidadeEscopo.CABE_NO_SEMESTRE,
        stage: EtapaSubmissao.PUBLICADA,
        publishedAt: new Date('2026-09-01'),
        createdAt: new Date('2026-09-01'),
        skills: [],
        references: [],
        questions: [
          {
            id: 1,
            text: 'Dúvida 1',
            askedAt: new Date('2026-09-01T10:00:00Z'),
            answerText: 'Resposta 1',
            answeredAt: new Date('2026-09-01T11:00:00Z'),
            answeredBy: 'Renata',
            teacher: { name: 'Prof 1' },
          },
        ],
      };

      const d2 = {
        id: 2,
        partnerId: 1,
        partner: mockPartner,
        title: 'Demanda Esperando',
        problem: 'Problema',
        description: 'Desc',
        affectedAudience: 'Público',
        level: NivelCurso.INTERMEDIARIO,
        scopeFit: ViabilidadeEscopo.CABE_NO_SEMESTRE,
        stage: EtapaSubmissao.PUBLICADA,
        publishedAt: new Date('2026-09-02'),
        createdAt: new Date('2026-09-02'),
        skills: [],
        references: [],
        questions: [
          {
            id: 2,
            text: 'Dúvida 2',
            askedAt: new Date('2026-09-02T10:00:00Z'),
            answerText: null,
            answeredAt: null,
            answeredBy: null,
            teacher: { name: 'Prof 2' },
          },
        ],
      };

      prismaMock.demand.findMany.mockResolvedValue([d1, d2]);

      const result = await service.listQuestionDemands('10');
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('2'); // Esperando primeiro
      expect(result[1].id).toBe('1');
    });
  });

  describe('getDemand', () => {
    it('deve retornar detalhe de submission para demanda em rascunho', async () => {
      prismaMock.partner.findUnique.mockResolvedValue(mockPartner);

      prismaMock.demand.findFirst.mockResolvedValue({
        id: 10,
        partnerId: 1,
        partner: mockPartner,
        title: 'Rascunho de Demanda',
        problem: 'Problema',
        description: 'Descrição',
        affectedAudience: 'Comunidade',
        expectedOutcome: 'Resultado',
        stage: EtapaSubmissao.RASCUNHO,
        updatedAt: new Date('2026-09-01T10:00:00Z'),
        skills: [],
        references: [],
        questions: [],
      });

      const result = await service.getDemand('10', '10');
      expect(result.kind).toBe('submission');
      expect(result.stage).toBe('draft');
      if (result.kind === 'submission') {
        expect(result.submission.title).toBe('Rascunho de Demanda');
        expect(result.submission.organization.name).toBe('Hospital das Clínicas');
      }
    });

    it('deve retornar detalhe publicado com projeto para demanda publicada', async () => {
      prismaMock.partner.findUnique.mockResolvedValue(mockPartner);

      prismaMock.demand.findFirst.mockResolvedValue({
        id: 20,
        partnerId: 1,
        partner: mockPartner,
        title: 'Demanda Publicada',
        problem: 'Problema',
        description: 'Descrição',
        affectedAudience: 'Comunidade',
        level: NivelCurso.AVANCADO,
        scopeFit: ViabilidadeEscopo.CABE_NO_SEMESTRE,
        stage: EtapaSubmissao.PUBLICADA,
        publishedAt: new Date('2026-09-01T10:00:00Z'),
        updatedAt: new Date('2026-09-01T10:00:00Z'),
        skills: [],
        references: [],
        questions: [],
        project: {
          id: 5,
          demandId: 20,
          title: 'Projeto A',
          teams: 2,
          course: {
            name: 'Engenharia de Software',
            semester: '2026.2',
            professor: { name: 'Prof. Carlos' },
          },
          milestones: [
            {
              step: EtapaProjeto.KICKOFF,
              dueAt: new Date('2026-09-10'),
              doneAt: new Date('2026-09-09'),
            },
          ],
        },
      });

      const result = await service.getDemand('10', '20');
      expect(result.kind).toBe('published');
      expect(result.stage).toBe('in-project');
      if (result.kind === 'published') {
        expect(result.project?.title).toBe('Projeto A');
        expect(result.project?.teacherName).toBe('Prof. Carlos');
      }
    });

    it('deve lançar NotFoundException se demanda não existir', async () => {
      prismaMock.partner.findUnique.mockResolvedValue(mockPartner);
      prismaMock.demand.findFirst.mockResolvedValue(null);

      await expect(service.getDemand('10', '999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('saveDraft', () => {
    it('deve criar novo rascunho quando id não for informado', async () => {
      prismaMock.partner.findUnique.mockResolvedValue(mockPartner);
      prismaMock.demand.create.mockResolvedValue({ id: 100 });
      prismaMock.skill.upsert.mockResolvedValue({ id: 1 });
      prismaMock.demandSkill.deleteMany.mockResolvedValue({});
      prismaMock.demandSkill.createMany.mockResolvedValue({});
      prismaMock.reference.deleteMany.mockResolvedValue({});

      const savedRecord = {
        id: 100,
        partnerId: 1,
        title: 'Novo Rascunho',
        problem: 'Problema',
        description: 'Descrição',
        affectedAudience: 'Público',
        expectedOutcome: 'Resultado',
        stage: EtapaSubmissao.RASCUNHO,
        updatedAt: new Date('2026-09-01'),
        skills: [{ skill: { name: 'React' } }],
        references: [],
      };
      prismaMock.demand.findUnique.mockResolvedValue(savedRecord);

      const result = await service.saveDraft('10', {
        draft: {
          title: 'Novo Rascunho',
          problem: 'Problema',
          description: 'Descrição',
          affectedPublic: 'Público',
          expectedOutcome: 'Resultado',
          skills: ['React'],
          offers: ['Apoio técnico'],
        },
      });

      expect(result.id).toBe('100');
      expect(result.stage).toBe('draft');
      expect(prismaMock.demand.create).toHaveBeenCalled();
    });

    it('deve atualizar rascunho existente quando id for informado', async () => {
      prismaMock.partner.findUnique.mockResolvedValue(mockPartner);
      prismaMock.demand.findFirst.mockResolvedValue({
        id: 100,
        stage: EtapaSubmissao.RASCUNHO,
      });
      prismaMock.demand.update.mockResolvedValue({ id: 100 });
      prismaMock.demandSkill.deleteMany.mockResolvedValue({});
      prismaMock.reference.deleteMany.mockResolvedValue({});

      prismaMock.demand.findUnique.mockResolvedValue({
        id: 100,
        partnerId: 1,
        title: 'Rascunho Atualizado',
        problem: 'Problema',
        description: 'Descrição',
        affectedAudience: 'Público',
        expectedOutcome: 'Resultado',
        stage: EtapaSubmissao.RASCUNHO,
        updatedAt: new Date('2026-09-02'),
        skills: [],
        references: [],
      });

      const result = await service.saveDraft('10', {
        id: '100',
        draft: {
          title: 'Rascunho Atualizado',
          problem: 'Problema',
          description: 'Descrição',
          affectedPublic: 'Público',
          expectedOutcome: 'Resultado',
        },
      });

      expect(result.title).toBe('Rascunho Atualizado');
      expect(prismaMock.demand.update).toHaveBeenCalled();
    });

    it('deve rejeitar edição se demanda estiver EM_TRIAGEM', async () => {
      prismaMock.partner.findUnique.mockResolvedValue(mockPartner);
      prismaMock.demand.findFirst.mockResolvedValue({
        id: 100,
        stage: EtapaSubmissao.EM_TRIAGEM,
      });

      await expect(
        service.saveDraft('10', {
          id: '100',
          draft: {
            title: 'Tentativa',
            problem: 'Problema',
            description: 'Descrição',
            affectedPublic: 'Público',
            expectedOutcome: 'Resultado',
          },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve validar título vazio', async () => {
      prismaMock.partner.findUnique.mockResolvedValue(mockPartner);

      await expect(
        service.saveDraft('10', {
          draft: {
            title: '   ',
            problem: 'Problema',
            description: 'Descrição',
            affectedPublic: 'Público',
            expectedOutcome: 'Resultado',
          },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve validar limites de texto', async () => {
      prismaMock.partner.findUnique.mockResolvedValue(mockPartner);

      await expect(
        service.saveDraft('10', {
          draft: {
            title: 'A'.repeat(81),
            problem: 'Problema',
            description: 'Descrição',
            affectedPublic: 'Público',
            expectedOutcome: 'Resultado',
          },
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('submitForReview', () => {
    it('deve validar campos obrigatórios ausentes', async () => {
      prismaMock.partner.findUnique.mockResolvedValue(mockPartner);

      await expect(
        service.submitForReview('10', {
          draft: {
            title: 'Demanda',
            problem: 'Problema',
            description: '',
            affectedPublic: 'Público',
            expectedOutcome: '',
          },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve enviar para EM_TRIAGEM com submittedAt definido e reviewNote limpo', async () => {
      prismaMock.partner.findUnique.mockResolvedValue(mockPartner);
      prismaMock.demand.findFirst.mockResolvedValue({
        id: 100,
        stage: EtapaSubmissao.AJUSTE_PEDIDO,
      });
      prismaMock.demand.update.mockResolvedValue({ id: 100 });
      prismaMock.demandSkill.deleteMany.mockResolvedValue({});
      prismaMock.reference.deleteMany.mockResolvedValue({});

      prismaMock.demand.findUnique.mockResolvedValue({
        id: 100,
        partnerId: 1,
        title: 'Demanda Completa',
        problem: 'Problema detalhado',
        description: 'Contexto completo',
        affectedAudience: 'Público',
        expectedOutcome: 'Resultado esperado',
        meetingCadence: 'Semanal',
        offers: ['Acesso ao sistema'],
        stage: EtapaSubmissao.EM_TRIAGEM,
        submittedAt: new Date(),
        reviewNote: null,
        updatedAt: new Date(),
        skills: [],
        references: [],
      });

      const result = await service.submitForReview('10', {
        id: '100',
        draft: {
          title: 'Demanda Completa',
          problem: 'Problema detalhado',
          description: 'Contexto completo',
          affectedPublic: 'Público',
          expectedOutcome: 'Resultado esperado',
          meetingCadence: 'Semanal',
          offers: ['Acesso ao sistema'],
        },
      });

      expect(result.stage).toBe('in-review');
      expect(result.review).toBeUndefined();
      expect(prismaMock.demand.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            stage: EtapaSubmissao.EM_TRIAGEM,
            reviewNote: null,
          }),
        }),
      );
    });
  });

  describe('deleteDraft', () => {
    it('deve excluir rascunho com sucesso', async () => {
      prismaMock.partner.findUnique.mockResolvedValue(mockPartner);
      prismaMock.demand.findFirst.mockResolvedValue({
        id: 50,
        stage: EtapaSubmissao.RASCUNHO,
      });
      prismaMock.demand.delete.mockResolvedValue({ id: 50 });

      const result = await service.deleteDraft('10', '50');
      expect(result).toEqual({ id: '50' });
      expect(prismaMock.demand.delete).toHaveBeenCalledWith({
        where: { id: 50 },
      });
    });

    it('deve rejeitar exclusão se não for RASCUNHO', async () => {
      prismaMock.partner.findUnique.mockResolvedValue(mockPartner);
      prismaMock.demand.findFirst.mockResolvedValue({
        id: 50,
        stage: EtapaSubmissao.EM_TRIAGEM,
      });

      await expect(service.deleteDraft('10', '50')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('deve lançar NotFoundException se demanda não existir', async () => {
      prismaMock.partner.findUnique.mockResolvedValue(mockPartner);
      prismaMock.demand.findFirst.mockResolvedValue(null);

      await expect(service.deleteDraft('10', '99')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('answerQuestion', () => {
    it('deve responder pergunta e retornar a demanda atualizada', async () => {
      prismaMock.partner.findUnique.mockResolvedValue(mockPartner);
      prismaMock.demand.findFirst.mockResolvedValue({
        id: 1,
        partnerId: 1,
        project: null,
      });
      prismaMock.demandQuestion.findFirst.mockResolvedValue({
        id: 10,
        demandId: 1,
      });
      prismaMock.demandQuestion.update.mockResolvedValue({ id: 10 });

      const updatedDemand = {
        id: 1,
        partnerId: 1,
        partner: mockPartner,
        title: 'Demanda com Pergunta Respondida',
        problem: 'Problema',
        description: 'Descrição',
        affectedAudience: 'Público',
        level: NivelCurso.INTERMEDIARIO,
        scopeFit: ViabilidadeEscopo.CABE_NO_SEMESTRE,
        stage: EtapaSubmissao.PUBLICADA,
        publishedAt: new Date('2026-09-01'),
        createdAt: new Date('2026-09-01'),
        skills: [],
        references: [],
        questions: [
          {
            id: 10,
            text: 'Como serão as reuniões?',
            askedAt: new Date('2026-09-02T10:00:00Z'),
            answerText: 'Serão semanais via Google Meet.',
            answeredAt: new Date('2026-09-02T11:00:00Z'),
            answeredBy: 'Renata Vasconcelos, Hospital das Clínicas',
            teacher: { name: 'Prof. Ana' },
          },
        ],
      };

      prismaMock.demand.findUnique.mockResolvedValue(updatedDemand);

      const result = await service.answerQuestion(
        '10',
        '1',
        '10',
        'Serão semanais via Google Meet.',
      );

      expect(prismaMock.demandQuestion.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: expect.objectContaining({
          answerText: 'Serão semanais via Google Meet.',
          answeredBy: 'Renata Vasconcelos, Hospital das Clínicas',
        }),
      });

      expect(result.questions[0].replies).toHaveLength(1);
      expect(result.questions[0].replies[0].text).toBe(
        'Serão semanais via Google Meet.',
      );
    });

    it('deve rejeitar resposta vazia', async () => {
      prismaMock.partner.findUnique.mockResolvedValue(mockPartner);

      await expect(
        service.answerQuestion('10', '1', '10', '   '),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve rejeitar resposta se a demanda já virou projeto', async () => {
      prismaMock.partner.findUnique.mockResolvedValue(mockPartner);
      prismaMock.demand.findFirst.mockResolvedValue({
        id: 1,
        partnerId: 1,
        project: { id: 100 },
      });

      await expect(
        service.answerQuestion('10', '1', '10', 'Resposta válida'),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve lançar NotFoundException se a pergunta não for encontrada', async () => {
      prismaMock.partner.findUnique.mockResolvedValue(mockPartner);
      prismaMock.demand.findFirst.mockResolvedValue({
        id: 1,
        partnerId: 1,
        project: null,
      });
      prismaMock.demandQuestion.findFirst.mockResolvedValue(null);

      await expect(
        service.answerQuestion('10', '1', '999', 'Resposta válida'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
