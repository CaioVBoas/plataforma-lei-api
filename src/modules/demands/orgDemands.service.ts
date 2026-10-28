import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  EtapaSubmissao,
  EtapaProjeto,
  NivelCurso,
  ViabilidadeEscopo,
  AdocaoResultado,
  Demand,
  Partner,
  Professor,
  Project,
  ProjectMilestone,
  Course,
  Skill,
  Reference,
  DemandQuestion,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { SaveDraftDto } from './dto/saveDraft.dto';
import { DemandDraftDto } from './dto/demandDraft.dto';

export type SubmissionStage = 'draft' | 'in-review' | 'needs-changes';
export type OrgDemandStage =
  SubmissionStage | 'open' | 'reserved' | 'in-project' | 'done';

export interface SubmissionReview {
  note: string;
  by: string;
  at: string;
}

export interface OrganizationRef {
  id: string;
  name: string;
  type: string;
  logo?: string;
}

export interface ReferenceData {
  name: string;
  description: string;
  url: string;
}

export interface DemandSubmission {
  id: string;
  organization: OrganizationRef;
  stage: SubmissionStage;
  updatedAt: string;
  submittedAt?: string;
  review?: SubmissionReview;
  title: string;
  problem: string;
  description: string;
  affectedPublic: string;
  expectedOutcome: string;
  skills: string[];
  constraints: string[];
  meetingCadence: string;
  offers: string[];
  references: ReferenceData[];
}

export interface OrgDemandSummary {
  id: string;
  title: string;
  problem: string;
  stage: OrgDemandStage;
  date: string;
  unanswered: number;
  reservation?: { teacherName: string; until: string };
  projectId?: string;
  review?: SubmissionReview;
  archived?: boolean;
}

export interface QuestionReply {
  id: string;
  text: string;
  at: string;
  time: string;
  by: string;
}

export interface QuestionView {
  id: string;
  teacherName: string;
  mine: boolean;
  askedAt: string;
  askedTime: string;
  text: string;
  replies: QuestionReply[];
}

export interface DemandView {
  id: string;
  organization: OrganizationRef;
  title: string;
  problem: string;
  description: string;
  affectedPublic: string;
  skills: string[];
  level: 'intro' | 'intermediate' | 'advanced';
  constraints: string[];
  scopeFit: 'fits' | 'needs-cut';
  scopeNote: string;
  meetingCadence: string;
  offers: string[];
  publishedAt: string;
  status: 'open' | 'reserved' | 'in-project';
  reservation?: { teacherName: string; mine: boolean; until: string };
  watching: boolean;
  references: ReferenceData[];
  questions: QuestionView[];
}

export interface MilestoneView {
  id: 'plan' | 'kickoff' | 'sigaa' | 'midterm' | 'final' | 'closing';
  dueAt: string;
  doneAt?: string;
}

export interface ProjectOutcomeView {
  summary: string;
  adoption: 'in-use' | 'partial' | 'not-used';
}

export interface OrgProjectSummary {
  id: string;
  demandId: string;
  title: string;
  disciplineName: string;
  semester: string;
  teams: number;
  teacherName: string;
  milestones: MilestoneView[];
  outcome?: ProjectOutcomeView;
}

export type OrgDemandDetail =
  | { kind: 'submission'; stage: OrgDemandStage; submission: DemandSubmission }
  | {
      kind: 'published';
      stage: OrgDemandStage;
      demand: DemandView;
      project?: OrgProjectSummary;
    };

const SUBMISSION_LIMITS = {
  title: 80,
  problem: 220,
  description: 2000,
  affectedPublic: 160,
  expectedOutcome: 600,
  meetingCadence: 120,
  offer: 200,
  maxOffers: 6,
  maxReferences: 3,
  answer: 1000,
} as const;

@Injectable()
export class OrgDemandsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPartner(userId: string | number): Promise<Partner> {
    const parsedId =
      typeof userId === 'number' ? userId : parseInt(String(userId), 10);
    if (isNaN(parsedId)) {
      throw new UnauthorizedException('Identificador de usuário inválido.');
    }

    const partner = await this.prisma.partner.findUnique({
      where: { userId: parsedId },
    });

    if (!partner) {
      throw new ForbiddenException(
        'Organização parceira não encontrada para este usuário.',
      );
    }

    return partner;
  }

  async listDemands(userId: string): Promise<OrgDemandSummary[]> {
    const partner = await this.getPartner(userId);

    const demands = await this.prisma.demand.findMany({
      where: { partnerId: partner.id },
      include: {
        skills: { include: { skill: true } },
        references: true,
        questions: true,
        reservedByProfessor: true,
        project: {
          include: {
            milestones: true,
            course: { include: { professor: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const summaries = demands.map((demand) => this.toOrgDemandSummary(demand));

    return summaries.sort((a, b) => b.date.localeCompare(a.date));
  }

  async listQuestionDemands(userId: string): Promise<DemandView[]> {
    const partner = await this.getPartner(userId);

    const demands = await this.prisma.demand.findMany({
      where: {
        partnerId: partner.id,
        stage: EtapaSubmissao.PUBLICADA,
        questions: { some: {} },
      },
      include: {
        partner: true,
        skills: { include: { skill: true } },
        references: true,
        questions: {
          include: { teacher: true },
          orderBy: { askedAt: 'asc' },
        },
        reservedByProfessor: true,
        project: true,
      },
    });

    const mapped = demands.map((d) => this.toPublishedDemand(d));

    return mapped.sort((a, b) => {
      const aUnanswered = a.questions.filter(
        (q) => q.replies.length === 0,
      ).length;
      const bUnanswered = b.questions.filter(
        (q) => q.replies.length === 0,
      ).length;

      if (bUnanswered > 0 !== aUnanswered > 0) {
        return (bUnanswered > 0 ? 1 : 0) - (aUnanswered > 0 ? 1 : 0);
      }

      const aLastStamp = this.getLatestQuestionMovement(a);
      const bLastStamp = this.getLatestQuestionMovement(b);
      return bLastStamp.localeCompare(aLastStamp);
    });
  }

  async getDemand(userId: string, id: string): Promise<OrgDemandDetail> {
    const partner = await this.getPartner(userId);
    const demandId = parseInt(id, 10);
    if (isNaN(demandId)) {
      throw new NotFoundException('Demanda não encontrada.');
    }

    const demand = await this.prisma.demand.findFirst({
      where: { id: demandId, partnerId: partner.id },
      include: {
        partner: true,
        skills: { include: { skill: true } },
        references: true,
        questions: {
          include: { teacher: true },
          orderBy: { askedAt: 'asc' },
        },
        reservedByProfessor: true,
        project: {
          include: {
            milestones: true,
            course: { include: { professor: true } },
          },
        },
      },
    });

    if (!demand) {
      throw new NotFoundException('Demanda não encontrada.');
    }

    if (demand.stage === EtapaSubmissao.RASCUNHO) {
      return {
        kind: 'submission',
        stage: 'draft',
        submission: this.toDemandSubmission(demand, partner),
      };
    }

    if (demand.stage === EtapaSubmissao.EM_TRIAGEM) {
      return {
        kind: 'submission',
        stage: 'in-review',
        submission: this.toDemandSubmission(demand, partner),
      };
    }

    if (demand.stage === EtapaSubmissao.AJUSTE_PEDIDO) {
      return {
        kind: 'submission',
        stage: 'needs-changes',
        submission: this.toDemandSubmission(demand, partner),
      };
    }

    // EtapaSubmissao.PUBLICADA
    const summary = this.toOrgDemandSummary(demand);
    return {
      kind: 'published',
      stage: summary.stage,
      demand: this.toPublishedDemand(demand),
      project: demand.project
        ? this.toOrgProjectSummary(demand.project)
        : undefined,
    };
  }

  async saveDraft(
    userId: string,
    dto: SaveDraftDto,
  ): Promise<DemandSubmission> {
    const partner = await this.getPartner(userId);
    const clean = this.cleanDraft(dto.draft);

    let demandId: number | undefined;
    if (dto.id) {
      demandId = parseInt(dto.id, 10);
      if (isNaN(demandId)) {
        throw new BadRequestException('ID inválido.');
      }

      const existing = await this.prisma.demand.findFirst({
        where: { id: demandId, partnerId: partner.id },
      });

      if (!existing) {
        throw new NotFoundException('Demanda não encontrada.');
      }

      if (existing.stage === EtapaSubmissao.EM_TRIAGEM) {
        throw new BadRequestException(
          'Esta demanda está na triagem do L.E.I. e não pode ser editada agora.',
        );
      }

      if (existing.stage === EtapaSubmissao.PUBLICADA) {
        throw new BadRequestException(
          'Demanda já publicada não pode ser editada como rascunho.',
        );
      }

      await this.prisma.demand.update({
        where: { id: demandId },
        data: {
          title: clean.title,
          problem: clean.problem,
          description: clean.description,
          affectedAudience: clean.affectedPublic,
          expectedOutcome: clean.expectedOutcome,
          meetingCadence: clean.meetingCadence,
          constraints: clean.constraints,
          offers: clean.offers,
        },
      });
    } else {
      const created = await this.prisma.demand.create({
        data: {
          partnerId: partner.id,
          title: clean.title,
          problem: clean.problem,
          description: clean.description,
          affectedAudience: clean.affectedPublic,
          expectedOutcome: clean.expectedOutcome,
          meetingCadence: clean.meetingCadence,
          constraints: clean.constraints,
          offers: clean.offers,
          stage: EtapaSubmissao.RASCUNHO,
        },
      });
      demandId = created.id;
    }

    await this.syncSkillsAndReferences(
      demandId,
      clean.skills,
      clean.references,
    );

    const saved = await this.prisma.demand.findUnique({
      where: { id: demandId },
      include: {
        skills: { include: { skill: true } },
        references: true,
      },
    });

    return this.toDemandSubmission(saved!, partner);
  }

  async submitForReview(
    userId: string,
    dto: SaveDraftDto,
  ): Promise<DemandSubmission> {
    const partner = await this.getPartner(userId);
    const clean = this.cleanDraft(dto.draft);

    const missing: string[] = [];
    if (!clean.title) missing.push('Nome da demanda');
    if (!clean.problem) missing.push('O problema em uma frase');
    if (!clean.description) missing.push('Contexto');
    if (!clean.affectedPublic) missing.push('Quem sente o problema');
    if (!clean.expectedOutcome)
      missing.push('O que ajudaria ao fim do semestre');
    if (!clean.meetingCadence) missing.push('Reuniões com a turma');
    if (!clean.offers || !clean.offers.some((offer) => offer.trim())) {
      missing.push('O que vocês oferecem à turma');
    }

    if (missing.length > 0) {
      throw new BadRequestException(`Falta preencher: ${missing.join(', ')}.`);
    }

    let demandId: number;
    if (dto.id) {
      demandId = parseInt(dto.id, 10);
      if (isNaN(demandId)) {
        throw new BadRequestException('ID inválido.');
      }

      const existing = await this.prisma.demand.findFirst({
        where: { id: demandId, partnerId: partner.id },
      });

      if (!existing) {
        throw new NotFoundException('Demanda não encontrada.');
      }

      if (existing.stage === EtapaSubmissao.EM_TRIAGEM) {
        throw new BadRequestException(
          'Esta demanda já está na triagem do L.E.I.',
        );
      }

      if (existing.stage === EtapaSubmissao.PUBLICADA) {
        throw new BadRequestException(
          'Demanda já publicada não pode ser reenviada para triagem.',
        );
      }

      await this.prisma.demand.update({
        where: { id: demandId },
        data: {
          title: clean.title,
          problem: clean.problem,
          description: clean.description,
          affectedAudience: clean.affectedPublic,
          expectedOutcome: clean.expectedOutcome,
          meetingCadence: clean.meetingCadence,
          constraints: clean.constraints,
          offers: clean.offers,
          stage: EtapaSubmissao.EM_TRIAGEM,
          submittedAt: new Date(),
          reviewNote: null,
          reviewedBy: null,
          reviewedAt: null,
        },
      });
    } else {
      const created = await this.prisma.demand.create({
        data: {
          partnerId: partner.id,
          title: clean.title,
          problem: clean.problem,
          description: clean.description,
          affectedAudience: clean.affectedPublic,
          expectedOutcome: clean.expectedOutcome,
          meetingCadence: clean.meetingCadence,
          constraints: clean.constraints,
          offers: clean.offers,
          stage: EtapaSubmissao.EM_TRIAGEM,
          submittedAt: new Date(),
          reviewNote: null,
          reviewedBy: null,
          reviewedAt: null,
        },
      });
      demandId = created.id;
    }

    await this.syncSkillsAndReferences(
      demandId,
      clean.skills,
      clean.references,
    );

    const saved = await this.prisma.demand.findUnique({
      where: { id: demandId },
      include: {
        skills: { include: { skill: true } },
        references: true,
      },
    });

    return this.toDemandSubmission(saved!, partner);
  }

  async deleteDraft(userId: string, id: string): Promise<{ id: string }> {
    const partner = await this.getPartner(userId);
    const demandId = parseInt(id, 10);
    if (isNaN(demandId)) {
      throw new BadRequestException('ID inválido.');
    }

    const demand = await this.prisma.demand.findFirst({
      where: { id: demandId, partnerId: partner.id },
    });

    if (!demand) {
      throw new NotFoundException('Demanda não encontrada.');
    }

    if (demand.stage !== EtapaSubmissao.RASCUNHO) {
      throw new BadRequestException('Só rascunho pode ser excluído.');
    }

    await this.prisma.demand.delete({
      where: { id: demandId },
    });

    return { id: String(demandId) };
  }

  async answerQuestion(
    userId: string,
    demandIdStr: string,
    questionIdStr: string,
    text: string,
  ): Promise<DemandView> {
    const partner = await this.getPartner(userId);
    const demandId = parseInt(demandIdStr, 10);
    const questionId = parseInt(questionIdStr, 10);

    if (isNaN(demandId) || isNaN(questionId)) {
      throw new BadRequestException('IDs inválidos.');
    }

    const answer = text?.trim();
    if (!answer) {
      throw new BadRequestException('Escreva a resposta.');
    }

    if (answer.length > SUBMISSION_LIMITS.answer) {
      throw new BadRequestException(
        `A resposta passa de ${SUBMISSION_LIMITS.answer} caracteres. Divida em duas mensagens.`,
      );
    }

    const demand = await this.prisma.demand.findFirst({
      where: { id: demandId, partnerId: partner.id },
      include: { project: true },
    });

    if (!demand) {
      throw new NotFoundException('Demanda não encontrada.');
    }

    if (demand.project) {
      throw new BadRequestException(
        'A demanda virou projeto. Agora a conversa é direto com o docente.',
      );
    }

    const question = await this.prisma.demandQuestion.findFirst({
      where: { id: questionId, demandId },
    });

    if (!question) {
      throw new NotFoundException('Pergunta não encontrada.');
    }

    const answeredBy = partner.focalName
      ? `${partner.focalName}, ${partner.name}`
      : partner.name;

    await this.prisma.demandQuestion.update({
      where: { id: questionId },
      data: {
        answerText: answer,
        answeredBy,
        answeredAt: new Date(),
      },
    });

    const updatedDemand = await this.prisma.demand.findUnique({
      where: { id: demandId },
      include: {
        partner: true,
        skills: { include: { skill: true } },
        references: true,
        questions: {
          include: { teacher: true },
          orderBy: { askedAt: 'asc' },
        },
        reservedByProfessor: true,
        project: true,
      },
    });

    return this.toPublishedDemand(updatedDemand!);
  }

  // ---------------------------------------------------------------------------
  // Helpers e Mapeamentos
  // ---------------------------------------------------------------------------

  private cleanDraft(draft: DemandDraftDto) {
    const clean = {
      title: (draft.title || '').trim(),
      problem: (draft.problem || '').trim(),
      description: (draft.description || '').trim(),
      affectedPublic: (draft.affectedPublic || '').trim(),
      expectedOutcome: (draft.expectedOutcome || '').trim(),
      skills: [
        ...new Set((draft.skills || []).map((s) => s.trim()).filter(Boolean)),
      ],
      constraints: [
        ...new Set(
          (draft.constraints || []).map((c) => c.trim()).filter(Boolean),
        ),
      ],
      meetingCadence: (draft.meetingCadence || '').trim(),
      offers: (draft.offers || []).map((o) => o.trim()).filter(Boolean),
      references: (draft.references || [])
        .map((r) => ({
          name: (r.name || '').trim(),
          url: (r.url || '').trim(),
          description: (r.description || '').trim(),
        }))
        .filter((r) => r.name || r.url),
    };

    if (!clean.title) {
      throw new BadRequestException('Dê um nome à demanda antes de salvar.');
    }

    const textFields: (keyof typeof SUBMISSION_LIMITS)[] = [
      'title',
      'problem',
      'description',
      'affectedPublic',
      'expectedOutcome',
      'meetingCadence',
    ];

    for (const field of textFields) {
      const val = clean[field as keyof typeof clean] as string;
      if (val && val.length > SUBMISSION_LIMITS[field]) {
        throw new BadRequestException(
          'Um dos textos passou do tamanho máximo. Encurte e tente de novo.',
        );
      }
    }

    if (clean.offers.length > SUBMISSION_LIMITS.maxOffers) {
      throw new BadRequestException(
        `Liste até ${SUBMISSION_LIMITS.maxOffers} coisas que vocês oferecem.`,
      );
    }

    if (clean.references.length > SUBMISSION_LIMITS.maxReferences) {
      throw new BadRequestException(
        `Indique até ${SUBMISSION_LIMITS.maxReferences} referências.`,
      );
    }

    if (
      clean.references.some(
        (ref) => !ref.name || !/^https?:\/\/\S+\.\S+/.test(ref.url),
      )
    ) {
      throw new BadRequestException(
        'Cada referência precisa de um nome e de um link que comece com http:// ou https://.',
      );
    }

    return clean;
  }

  private async syncSkillsAndReferences(
    demandId: number,
    skills: string[],
    references: ReferenceData[],
  ) {
    // 1. Sync Skills
    const skillIds: number[] = [];
    for (const skillName of skills) {
      const skill = await this.prisma.skill.upsert({
        where: { name: skillName },
        update: {},
        create: { name: skillName },
      });
      skillIds.push(skill.id);
    }

    await this.prisma.demandSkill.deleteMany({
      where: { demandId },
    });

    if (skillIds.length > 0) {
      await this.prisma.demandSkill.createMany({
        data: skillIds.map((skillId) => ({ demandId, skillId })),
      });
    }

    // 2. Sync References
    await this.prisma.reference.deleteMany({
      where: { demandId },
    });

    if (references.length > 0) {
      await this.prisma.reference.createMany({
        data: references.map((r) => ({
          demandId,
          name: r.name,
          url: r.url,
          description: r.description || null,
        })),
      });
    }
  }

  private toOrgDemandSummary(
    demand: Demand & {
      skills?: { skill: Skill }[];
      questions?: DemandQuestion[];
      reservedByProfessor?: Professor | null;
      project?: (Project & { milestones?: ProjectMilestone[] }) | null;
    },
  ): OrgDemandSummary {
    let stage: OrgDemandStage;
    let date: string;
    let unanswered = 0;

    if (demand.stage === EtapaSubmissao.RASCUNHO) {
      stage = 'draft';
      date = demand.updatedAt.toISOString().split('T')[0];
    } else if (demand.stage === EtapaSubmissao.EM_TRIAGEM) {
      stage = 'in-review';
      date = (demand.submittedAt ?? demand.updatedAt)
        .toISOString()
        .split('T')[0];
    } else if (demand.stage === EtapaSubmissao.AJUSTE_PEDIDO) {
      stage = 'needs-changes';
      date = (demand.reviewedAt ?? demand.updatedAt)
        .toISOString()
        .split('T')[0];
    } else {
      // PUBLICADA
      const project = demand.project;
      if (project) {
        const isDone = project.milestones?.some(
          (m) => m.step === EtapaProjeto.ENCERRAMENTO && m.doneAt != null,
        );
        stage = isDone ? 'done' : 'in-project';
        date = (project.createdAt ?? demand.publishedAt ?? demand.updatedAt)
          .toISOString()
          .split('T')[0];
        unanswered = 0;
      } else {
        const isReserved =
          demand.reservedByProfessorId != null &&
          (!demand.reservationDeadline ||
            demand.reservationDeadline > new Date());
        stage = isReserved ? 'reserved' : 'open';
        date = (demand.publishedAt ?? demand.updatedAt)
          .toISOString()
          .split('T')[0];
        unanswered = (demand.questions ?? []).filter(
          (q) => !q.answerText || !q.answerText.trim(),
        ).length;
      }
    }

    const reservation =
      demand.reservedByProfessorId != null && demand.reservedByProfessor
        ? {
            teacherName: demand.reservedByProfessor.name,
            until: demand.reservationDeadline
              ? demand.reservationDeadline.toISOString().split('T')[0]
              : '',
          }
        : undefined;

    const review =
      demand.stage === EtapaSubmissao.AJUSTE_PEDIDO && demand.reviewNote
        ? {
            note: demand.reviewNote,
            by: demand.reviewedBy ?? 'L.E.I.',
            at: (demand.reviewedAt ?? demand.updatedAt)
              .toISOString()
              .split('T')[0],
          }
        : undefined;

    return {
      id: String(demand.id),
      title: demand.title || 'Demanda sem nome',
      problem: demand.problem,
      stage,
      date,
      unanswered,
      reservation,
      projectId: demand.project ? String(demand.project.id) : undefined,
      review,
    };
  }

  private toDemandSubmission(
    demand: Demand & {
      skills?: { skill: Skill }[];
      references?: Reference[];
    },
    partner: Partner,
  ): DemandSubmission {
    const stageMap: Record<EtapaSubmissao, SubmissionStage> = {
      [EtapaSubmissao.RASCUNHO]: 'draft',
      [EtapaSubmissao.EM_TRIAGEM]: 'in-review',
      [EtapaSubmissao.AJUSTE_PEDIDO]: 'needs-changes',
      [EtapaSubmissao.PUBLICADA]: 'draft',
    };

    const stage = stageMap[demand.stage] ?? 'draft';

    return {
      id: String(demand.id),
      organization: {
        id: String(partner.id),
        name: partner.name,
        type: partner.type,
        logo: partner.logo ?? undefined,
      },
      stage,
      updatedAt: demand.updatedAt.toISOString().split('T')[0],
      submittedAt: demand.submittedAt
        ? demand.submittedAt.toISOString().split('T')[0]
        : undefined,
      review:
        demand.stage === EtapaSubmissao.AJUSTE_PEDIDO && demand.reviewNote
          ? {
              note: demand.reviewNote,
              by: demand.reviewedBy ?? 'L.E.I.',
              at: (demand.reviewedAt ?? demand.updatedAt)
                .toISOString()
                .split('T')[0],
            }
          : undefined,
      title: demand.title,
      problem: demand.problem,
      description: demand.description,
      affectedPublic: demand.affectedAudience,
      expectedOutcome: demand.expectedOutcome ?? '',
      skills: demand.skills?.map((s) => s.skill.name) ?? [],
      constraints: demand.constraints ?? [],
      meetingCadence: demand.meetingCadence ?? '',
      offers: demand.offers ?? [],
      references:
        demand.references?.map((r) => ({
          name: r.name,
          url: r.url,
          description: r.description ?? '',
        })) ?? [],
    };
  }

  private toPublishedDemand(
    demand: Demand & {
      partner: Partner;
      skills?: { skill: Skill }[];
      references?: Reference[];
      questions?: (DemandQuestion & { teacher?: Professor | null })[];
      reservedByProfessor?: Professor | null;
      project?: Project | null;
    },
  ): DemandView {
    const levelMap: Record<NivelCurso, 'intro' | 'intermediate' | 'advanced'> =
      {
        [NivelCurso.INICIANTE]: 'intro',
        [NivelCurso.INTERMEDIARIO]: 'intermediate',
        [NivelCurso.AVANCADO]: 'advanced',
      };

    const scopeFitMap: Record<ViabilidadeEscopo, 'fits' | 'needs-cut'> = {
      [ViabilidadeEscopo.CABE_NO_SEMESTRE]: 'fits',
      [ViabilidadeEscopo.APERTADO_EXIGE_RECORTE]: 'needs-cut',
    };

    let status: 'open' | 'reserved' | 'in-project';
    if (demand.project) {
      status = 'in-project';
    } else if (
      demand.reservedByProfessorId != null &&
      (!demand.reservationDeadline || demand.reservationDeadline > new Date())
    ) {
      status = 'reserved';
    } else {
      status = 'open';
    }

    return {
      id: String(demand.id),
      organization: {
        id: String(demand.partner.id),
        name: demand.partner.name,
        type: demand.partner.type,
        logo: demand.partner.logo ?? undefined,
      },
      title: demand.title,
      problem: demand.problem,
      description: demand.description,
      affectedPublic: demand.affectedAudience,
      skills: demand.skills?.map((s) => s.skill.name) ?? [],
      level: levelMap[demand.level] ?? 'intermediate',
      constraints: demand.constraints ?? [],
      scopeFit: scopeFitMap[demand.scopeFit] ?? 'fits',
      scopeNote: demand.scopeNote ?? '',
      meetingCadence: demand.meetingCadence ?? '',
      offers: demand.offers ?? [],
      publishedAt: (demand.publishedAt ?? demand.createdAt)
        .toISOString()
        .split('T')[0],
      status,
      reservation:
        demand.reservedByProfessorId != null && demand.reservedByProfessor
          ? {
              teacherName: demand.reservedByProfessor.name,
              mine: false,
              until: demand.reservationDeadline
                ? demand.reservationDeadline.toISOString().split('T')[0]
                : '',
            }
          : undefined,
      watching: false,
      references:
        demand.references?.map((r) => ({
          name: r.name,
          url: r.url,
          description: r.description ?? '',
        })) ?? [],
      questions:
        demand.questions?.map((q) => {
          const askedDate = q.askedAt.toISOString().split('T')[0];
          const askedTime = q.askedAt.toISOString().slice(11, 16);
          const replies: QuestionReply[] = q.answerText
            ? [
                {
                  id: `${q.id}-r1`,
                  text: q.answerText,
                  at: q.answeredAt
                    ? q.answeredAt.toISOString().split('T')[0]
                    : askedDate,
                  time: q.answeredAt
                    ? q.answeredAt.toISOString().slice(11, 16)
                    : askedTime,
                  by: q.answeredBy ?? demand.partner.name,
                },
              ]
            : [];

          return {
            id: String(q.id),
            teacherName: q.teacher?.name ?? 'Docente',
            mine: false,
            askedAt: askedDate,
            askedTime,
            text: q.text,
            replies,
          };
        }) ?? [],
    };
  }

  private toOrgProjectSummary(
    project: Project & {
      milestones?: ProjectMilestone[];
      course?: (Course & { professor?: Professor | null }) | null;
    },
  ): OrgProjectSummary {
    const milestoneStepMap: Record<EtapaProjeto, MilestoneView['id']> = {
      [EtapaProjeto.PLANO]: 'plan',
      [EtapaProjeto.KICKOFF]: 'kickoff',
      [EtapaProjeto.SIGAA]: 'sigaa',
      [EtapaProjeto.PARCIAL]: 'midterm',
      [EtapaProjeto.FINAL]: 'final',
      [EtapaProjeto.ENCERRAMENTO]: 'closing',
    };

    const adoptionMap: Record<
      AdocaoResultado,
      'in-use' | 'partial' | 'not-used'
    > = {
      [AdocaoResultado.EM_USO]: 'in-use',
      [AdocaoResultado.PARCIAL]: 'partial',
      [AdocaoResultado.NAO_USADO]: 'not-used',
    };

    return {
      id: String(project.id),
      demandId: String(project.demandId),
      title: project.title,
      disciplineName: project.course?.name ?? '',
      semester: project.course?.semester ?? '',
      teams: project.teams,
      teacherName: project.course?.professor?.name ?? '',
      milestones:
        project.milestones?.map((m) => ({
          id: milestoneStepMap[m.step] ?? 'plan',
          dueAt: m.dueAt.toISOString().split('T')[0],
          doneAt: m.doneAt ? m.doneAt.toISOString().split('T')[0] : undefined,
        })) ?? [],
      outcome: project.outcomeSummary
        ? {
            summary: project.outcomeSummary,
            adoption: project.outcomeAdoption
              ? (adoptionMap[project.outcomeAdoption] ?? 'in-use')
              : 'in-use',
          }
        : undefined,
    };
  }

  private getLatestQuestionMovement(demand: DemandView): string {
    let latest = `${demand.publishedAt}T00:00`;
    for (const q of demand.questions) {
      const askedStamp = `${q.askedAt}T${q.askedTime}`;
      if (askedStamp > latest) latest = askedStamp;
      for (const r of q.replies) {
        const replyStamp = `${r.at}T${r.time}`;
        if (replyStamp > latest) latest = replyStamp;
      }
    }
    return latest;
  }
}
