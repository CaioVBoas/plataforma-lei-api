import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EtapaSubmissao,
  NivelCurso,
  Prisma,
  TipoParceiro,
  ViabilidadeEscopo,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  CourseLevelDto,
  DemandConstraintDto,
  DemandDetailDto,
  DemandDto,
  DemandInvitationDto,
  DemandQuestionDto,
  DemandStatusDto,
  OrganizationDto,
  OrganizationHistoryEntryDto,
  OrganizationRefDto,
  QuestionReplyDto,
  ReferenceDto,
  ReservationDto,
  ScopeFitDto,
} from './types';

const PARTNER_TYPE_LABELS: Record<TipoParceiro, string> = {
  [TipoParceiro.ORGAO_PUBLICO]: 'Órgão público',
  [TipoParceiro.UNIDADE_UFPE]: 'Unidade da UFPE',
  [TipoParceiro.ORGANIZACAO_SOCIAL_ONG]: 'Organização social',
  [TipoParceiro.EMPRESA]: 'Empresa',
  [TipoParceiro.OUTRO]: 'Outro',
};

const LEVEL_MAP: Record<NivelCurso, CourseLevelDto> = {
  [NivelCurso.INICIANTE]: 'intro',
  [NivelCurso.INTERMEDIARIO]: 'intermediate',
  [NivelCurso.AVANCADO]: 'advanced',
};

const SCOPE_FIT_MAP: Record<ViabilidadeEscopo, ScopeFitDto> = {
  [ViabilidadeEscopo.CABE_NO_SEMESTRE]: 'fits',
  [ViabilidadeEscopo.APERTADO_EXIGE_RECORTE]: 'needs-cut',
};

function toIsoDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().slice(0, 10);
}

function toClockTime(date: Date | string | null | undefined): string {
  if (!date) return '00:00';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().slice(11, 16);
}

export const DEMAND_INCLUDE = {
  partner: {
    include: {
      demands: {
        include: {
          project: {
            include: {
              course: {
                include: {
                  professor: true,
                  coTeachers: true,
                },
              },
            },
          },
        },
      },
    },
  },
  reservedByProfessor: true,
  skills: {
    include: {
      skill: true,
    },
  },
  references: true,
  questions: {
    include: {
      teacher: true,
    },
    orderBy: {
      askedAt: 'asc' as const,
    },
  },
  watchers: true,
  invitations: {
    include: {
      professor: {
        include: {
          user: true,
        },
      },
    },
  },
  project: {
    include: {
      course: {
        include: {
          professor: true,
          coTeachers: true,
        },
      },
    },
  },
} satisfies Prisma.DemandInclude;

export type DemandWithRelations = Prisma.DemandGetPayload<{
  include: typeof DEMAND_INCLUDE;
}>;

export type ProfessorWithUser = Prisma.ProfessorGetPayload<{
  include: { user: true };
}>;

@Injectable()
export class DemandsService {
  constructor(private readonly prisma: PrismaService) {}

  async expirePastReservations(): Promise<void> {
    const now = new Date();
    await this.prisma.demand.updateMany({
      where: {
        reservedByProfessorId: { not: null },
        reservationDeadline: { lt: now },
      },
      data: {
        reservedByProfessorId: null,
        reservationDeadline: null,
      },
    });
  }

  async getProfessorByUserId(
    userId: string | number,
  ): Promise<ProfessorWithUser | null> {
    const parsed = Number(userId);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return null;
    }
    return this.prisma.professor.findUnique({
      where: { userId: parsed },
      include: { user: true },
    });
  }

  async requireProfessor(userId: string | number): Promise<ProfessorWithUser> {
    const professor = await this.getProfessorByUserId(userId);
    if (!professor) {
      throw new ForbiddenException('Perfil de docente não encontrado.');
    }
    return professor;
  }

  async getMenu(userId?: string): Promise<DemandDto[]> {
    await this.expirePastReservations();
    const currentProfessor = userId
      ? await this.getProfessorByUserId(userId)
      : null;

    const demands = await this.prisma.demand.findMany({
      where: {
        stage: EtapaSubmissao.PUBLICADA,
        project: null,
      },
      include: DEMAND_INCLUDE,
      orderBy: { id: 'asc' },
    });

    return demands.map((demand) => this.mapDemand(demand, currentProfessor));
  }

  async getDemand(id: number, userId?: string): Promise<DemandDetailDto> {
    await this.expirePastReservations();
    const currentProfessor = userId
      ? await this.getProfessorByUserId(userId)
      : null;

    const demand = await this.prisma.demand.findUnique({
      where: { id },
      include: DEMAND_INCLUDE,
    });

    if (!demand || demand.stage !== EtapaSubmissao.PUBLICADA) {
      throw new NotFoundException('Demanda não encontrada.');
    }

    const mappedDemand = this.mapDemand(demand, currentProfessor);
    const mappedOrg = this.mapOrganization(demand.partner);

    let projectId: string | undefined = undefined;
    if (demand.project) {
      const isMine =
        currentProfessor &&
        (demand.project.course?.professorId === currentProfessor.id ||
          demand.project.course?.coTeachers?.some(
            (ct) => ct.professorId === currentProfessor.id,
          ));

      if (isMine) {
        projectId = String(demand.project.id);
      } else {
        throw new NotFoundException(
          'Esta demanda já foi levada para a disciplina de outro docente.',
        );
      }
    }

    return {
      demand: mappedDemand,
      organization: mappedOrg,
      ...(projectId ? { projectId } : {}),
    };
  }

  async reserveDemand(id: number, userId: string): Promise<DemandDto> {
    const professor = await this.requireProfessor(userId);
    await this.expirePastReservations();

    const demand = await this.prisma.demand.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!demand || demand.stage !== EtapaSubmissao.PUBLICADA) {
      throw new NotFoundException('Demanda não encontrada.');
    }

    if (demand.project || demand.reservedByProfessorId) {
      throw new BadRequestException(
        'Esta demanda não está mais livre no cardápio.',
      );
    }

    const activeReservationsCount = await this.prisma.demand.count({
      where: {
        reservedByProfessorId: professor.id,
        stage: EtapaSubmissao.PUBLICADA,
        project: null,
        reservationDeadline: { gte: new Date() },
      },
    });

    if (activeReservationsCount >= 2) {
      throw new BadRequestException(
        'Você já tem 2 reservas ativas. Libere uma ou leve alguma para a disciplina antes de reservar outra.',
      );
    }

    const reservationDeadline = new Date();
    reservationDeadline.setDate(reservationDeadline.getDate() + 7);

    await this.prisma.demandWatcher.deleteMany({
      where: {
        demandId: demand.id,
        professorId: professor.id,
      },
    });

    await this.prisma.demand.update({
      where: { id: demand.id },
      data: {
        reservedByProfessorId: professor.id,
        reservationDeadline,
      },
    });

    const updated = await this.prisma.demand.findUnique({
      where: { id: demand.id },
      include: DEMAND_INCLUDE,
    });

    return this.mapDemand(updated as DemandWithRelations, professor);
  }

  async releaseReservation(id: number, userId: string): Promise<DemandDto> {
    const professor = await this.requireProfessor(userId);
    await this.expirePastReservations();

    const demand = await this.prisma.demand.findUnique({
      where: { id },
    });

    if (!demand || demand.stage !== EtapaSubmissao.PUBLICADA) {
      throw new NotFoundException('Demanda não encontrada.');
    }

    if (demand.reservedByProfessorId !== professor.id) {
      throw new BadRequestException('Esta reserva não é sua.');
    }

    await this.prisma.demand.update({
      where: { id: demand.id },
      data: {
        reservedByProfessorId: null,
        reservationDeadline: null,
      },
    });

    const updated = await this.prisma.demand.findUnique({
      where: { id: demand.id },
      include: DEMAND_INCLUDE,
    });

    return this.mapDemand(updated as DemandWithRelations, professor);
  }

  async toggleWatch(id: number, userId: string): Promise<DemandDto> {
    const professor = await this.requireProfessor(userId);
    await this.expirePastReservations();

    const demand = await this.prisma.demand.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!demand || demand.stage !== EtapaSubmissao.PUBLICADA) {
      throw new NotFoundException('Demanda não encontrada.');
    }

    const isReservedByAnother =
      !demand.project &&
      demand.reservedByProfessorId &&
      demand.reservedByProfessorId !== professor.id;

    if (!isReservedByAnother) {
      throw new BadRequestException(
        'O aviso vale só para demandas reservadas por outro docente.',
      );
    }

    const existing = await this.prisma.demandWatcher.findUnique({
      where: {
        demandId_professorId: {
          demandId: demand.id,
          professorId: professor.id,
        },
      },
    });

    if (existing) {
      await this.prisma.demandWatcher.delete({
        where: {
          demandId_professorId: {
            demandId: demand.id,
            professorId: professor.id,
          },
        },
      });
    } else {
      await this.prisma.demandWatcher.create({
        data: {
          demandId: demand.id,
          professorId: professor.id,
        },
      });
    }

    const updated = await this.prisma.demand.findUnique({
      where: { id: demand.id },
      include: DEMAND_INCLUDE,
    });

    return this.mapDemand(updated as DemandWithRelations, professor);
  }

  async askQuestion(
    id: number,
    userId: string,
    text: string,
  ): Promise<DemandDto> {
    const professor = await this.requireProfessor(userId);
    const trimmed = text?.trim();

    if (!trimmed) {
      throw new BadRequestException('Escreva a pergunta.');
    }

    if (trimmed.length > 500) {
      throw new BadRequestException(
        'A pergunta passa de 500 caracteres. Tente ser mais direto.',
      );
    }

    const demand = await this.prisma.demand.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!demand || demand.stage !== EtapaSubmissao.PUBLICADA) {
      throw new NotFoundException('Demanda não encontrada.');
    }

    if (demand.project) {
      throw new BadRequestException(
        'Esta demanda já virou projeto. Fale com a organização pelo contato do projeto.',
      );
    }

    await this.prisma.demandQuestion.create({
      data: {
        demandId: demand.id,
        teacherId: professor.id,
        authorId: professor.userId,
        text: trimmed,
        askedAt: new Date(),
      },
    });

    const updated = await this.prisma.demand.findUnique({
      where: { id: demand.id },
      include: DEMAND_INCLUDE,
    });

    return this.mapDemand(updated as DemandWithRelations, professor);
  }

  mapDemand(
    demand: DemandWithRelations,
    currentProfessor: ProfessorWithUser | null,
  ): DemandDto {
    const isExpired =
      demand.reservationDeadline && demand.reservationDeadline < new Date();
    const reservedByProfessorId = isExpired
      ? null
      : demand.reservedByProfessorId;
    const reservationDeadline = isExpired ? null : demand.reservationDeadline;

    let status: DemandStatusDto = 'open';
    if (demand.project) {
      status = 'in-project';
    } else if (reservedByProfessorId && reservationDeadline) {
      status = 'reserved';
    }

    let reservation: ReservationDto | undefined = undefined;
    if (status === 'reserved' && reservationDeadline) {
      reservation = {
        teacherName: demand.reservedByProfessor?.name || '',
        mine: Boolean(
          currentProfessor && reservedByProfessorId === currentProfessor.id,
        ),
        until: toIsoDate(reservationDeadline),
      };
    }

    const watching = Boolean(
      currentProfessor &&
      demand.watchers?.some((w) => w.professorId === currentProfessor.id),
    );

    let invitation: DemandInvitationDto | undefined = undefined;
    if (currentProfessor && demand.invitations) {
      const inv = demand.invitations.find(
        (i) => i.professorId === currentProfessor.id,
      );
      if (inv) {
        invitation = {
          to: currentProfessor.user?.email || '',
          from: inv.fromName,
          message: inv.message,
          sentAt: toIsoDate(inv.sentAt),
        };
      }
    }

    const questions: DemandQuestionDto[] = (demand.questions || []).map((q) => {
      const replies: QuestionReplyDto[] = q.answerText
        ? [
            {
              id: `${q.id}-r1`,
              text: q.answerText,
              at: toIsoDate(q.answeredAt || q.askedAt),
              time: toClockTime(q.answeredAt || q.askedAt),
              by:
                q.answeredBy ||
                (demand.partner?.name
                  ? `${demand.partner.focalName || 'Representante'}, ${demand.partner.name}`
                  : 'Organização Parceira'),
            },
          ]
        : [];

      return {
        id: String(q.id),
        teacherName: q.teacher?.name || 'Docente',
        mine: Boolean(currentProfessor && q.teacherId === currentProfessor.id),
        askedAt: toIsoDate(q.askedAt),
        askedTime: toClockTime(q.askedAt),
        text: q.text,
        replies,
      };
    });

    const references: ReferenceDto[] = (demand.references || []).map((r) => ({
      name: r.name,
      description: r.description || '',
      url: r.url,
    }));

    const skills: string[] = (demand.skills || []).map((s) => s.skill.name);

    const orgType =
      demand.partner?.type && PARTNER_TYPE_LABELS[demand.partner.type]
        ? PARTNER_TYPE_LABELS[demand.partner.type]
        : String(demand.partner?.type || '');

    const organization: OrganizationRefDto = {
      id: String(demand.partnerId),
      name: demand.partner?.name || '',
      type: orgType,
      ...(demand.partner?.logo ? { logo: demand.partner.logo } : {}),
    };

    const level = LEVEL_MAP[demand.level] || 'intermediate';
    const scopeFit = SCOPE_FIT_MAP[demand.scopeFit] || 'fits';

    const mapped: DemandDto = {
      id: String(demand.id),
      organization,
      title: demand.title,
      problem: demand.problem,
      description: demand.description,
      affectedPublic: demand.affectedAudience,
      skills,
      level,
      constraints: (demand.constraints || []) as DemandConstraintDto[],
      scopeFit,
      scopeNote: demand.scopeNote || demand.expectedOutcome || '',
      meetingCadence: demand.meetingCadence || '',
      offers: demand.offers || [],
      publishedAt: toIsoDate(demand.publishedAt || demand.createdAt),
      status,
      watching,
      references,
      questions,
    };

    if (reservation) {
      mapped.reservation = reservation;
    }
    if (invitation) {
      mapped.invitation = invitation;
    }

    return mapped;
  }

  mapOrganization(partner: DemandWithRelations['partner']): OrganizationDto {
    const history: OrganizationHistoryEntryDto[] = [];
    if (partner.demands) {
      for (const d of partner.demands) {
        if (d.project && d.project.course) {
          history.push({
            title: d.project.title,
            semester: d.project.course.semester,
            disciplineName: d.project.course.name,
            teacherName: d.project.course.professor?.name || '',
            result:
              d.project.outcomeSummary || d.project.agreedDeliverable || '',
          });
        }
      }
    }

    const orgType =
      partner.type && PARTNER_TYPE_LABELS[partner.type]
        ? PARTNER_TYPE_LABELS[partner.type]
        : String(partner.type || '');

    return {
      id: String(partner.id),
      name: partner.name,
      type: orgType,
      ...(partner.logo ? { logo: partner.logo } : {}),
      ...(partner.cover ? { cover: partner.cover } : {}),
      location: partner.location || '',
      about: partner.about || '',
      audience: partner.audience || '',
      site: partner.site || '',
      meetingCadence: partner.meetingCadence || '',
      onSiteVisit: partner.onSiteVisit || '',
      history,
    };
  }
}
