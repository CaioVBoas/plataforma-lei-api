import { Injectable, NotFoundException } from '@nestjs/common';
import { EtapaProjeto, EtapaSubmissao, Prisma } from '@prisma/client';
import { toPartnerTypeLabel } from '../../common/mappers/partnerType.mapper';
import { PrismaService } from '../../database/prisma.service';
import {
  OrganizationDetailDto,
  OrganizationDto,
  OrganizationSummaryDto,
} from './dto/organization.dto';

/** Demanda no cardápio que ainda não virou projeto. */
const OPEN_DEMAND = {
  stage: EtapaSubmissao.PUBLICADA,
  project: null,
} satisfies Prisma.DemandWhereInput;

const CLOSED_PROJECT = {
  milestones: {
    some: { step: EtapaProjeto.ENCERRAMENTO, doneAt: { not: null } },
  },
} satisfies Prisma.ProjectWhereInput;

/**
 * Seleção do perfil público. `focalName`, `focalRole`, `phone`, `channel` e o
 * e-mail ficam de fora de propósito (Regra 6): só a query de contato, abaixo,
 * os lê. Nunca trocar por `include`.
 */
const PUBLIC_SELECT = {
  id: true,
  name: true,
  type: true,
  logo: true,
  cover: true,
  location: true,
  about: true,
  audience: true,
  site: true,
  meetingCadence: true,
  onSiteVisit: true,
  demands: {
    where: { project: CLOSED_PROJECT },
    select: {
      project: {
        select: {
          title: true,
          outcomeSummary: true,
          course: {
            select: {
              semester: true,
              name: true,
              professor: { select: { name: true } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.PartnerSelect;

type PartnerRow = Prisma.PartnerGetPayload<{ select: typeof PUBLIC_SELECT }>;

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<OrganizationSummaryDto[]> {
    const partners = await this.prisma.partner.findMany({
      select: {
        ...PUBLIC_SELECT,
        _count: { select: { demands: { where: OPEN_DEMAND } } },
      },
      orderBy: { name: 'asc' },
    });
    return partners.map((partner) => ({
      ...this.toDto(partner),
      openDemands: partner._count.demands,
    }));
  }

  async get(userId: string, id: number): Promise<OrganizationDetailDto> {
    const professorId = await this.professorIdOf(userId);

    const partner = await this.prisma.partner.findUnique({
      where: { id },
      select: PUBLIC_SELECT,
    });
    if (!partner) {
      throw new NotFoundException('Organização não encontrada.');
    }

    const [openDemands, projects] = await Promise.all([
      this.prisma.demand.findMany({
        where: { partnerId: id, ...OPEN_DEMAND },
        select: { id: true, title: true },
        orderBy: { id: 'asc' },
      }),
      // Principal ou co-docente da disciplina do projeto.
      this.prisma.project.findMany({
        where: {
          demand: { partnerId: id },
          course: {
            OR: [{ professorId }, { coTeachers: { some: { professorId } } }],
          },
        },
        select: {
          id: true,
          title: true,
          course: { select: { semester: true, name: true } },
        },
        orderBy: { id: 'asc' },
      }),
    ]);

    const detail: OrganizationDetailDto = {
      organization: this.toDto(partner),
      openDemands: openDemands.map((demand) => ({
        id: String(demand.id),
        title: demand.title,
      })),
      myProjects: projects.map((project) => ({
        id: String(project.id),
        title: project.title,
        semester: project.course.semester,
        disciplineName: project.course.name,
      })),
    };

    // Regra 6: o contato só é lido do banco depois de provado o vínculo.
    if (projects.length > 0) {
      const contact = await this.prisma.partner.findUnique({
        where: { id },
        select: {
          focalName: true,
          focalRole: true,
          channel: true,
          contactEmail: true,
          user: { select: { email: true } },
        },
      });
      detail.contact = {
        focalName: contact?.focalName ?? '',
        focalRole: contact?.focalRole ?? '',
        email: contact?.contactEmail ?? contact?.user?.email ?? '',
        channel: contact?.channel ?? '',
      };
    }
    return detail;
  }

  private async professorIdOf(userId: string): Promise<number> {
    const id = Number(userId);
    if (!Number.isInteger(id)) {
      throw new NotFoundException('Docente não encontrado.');
    }
    const professor = await this.prisma.professor.findUnique({
      where: { userId: id },
      select: { id: true },
    });
    if (!professor) {
      throw new NotFoundException('Docente não encontrado.');
    }
    return professor.id;
  }

  private toDto(partner: PartnerRow): OrganizationDto {
    return {
      id: String(partner.id),
      name: partner.name,
      type: toPartnerTypeLabel(partner.type),
      logo: partner.logo ?? undefined,
      cover: partner.cover ?? undefined,
      location: partner.location ?? '',
      about: partner.about ?? '',
      audience: partner.audience ?? '',
      site: partner.site ?? '',
      meetingCadence: partner.meetingCadence ?? '',
      onSiteVisit: partner.onSiteVisit ?? '',
      history: partner.demands.flatMap(({ project }) =>
        project
          ? [
              {
                title: project.title,
                semester: project.course.semester,
                disciplineName: project.course.name,
                teacherName: project.course.professor.name,
                result: project.outcomeSummary ?? '',
              },
            ]
          : [],
      ),
    };
  }
}
