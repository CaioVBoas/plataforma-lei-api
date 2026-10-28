import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { toAdoption, toStep } from '../projects/projects.steps';

// `select` explícito: `ProjectMilestone.note` é anotação pedagógica interna do
// docente e nunca pode chegar à organização.
const orgProjectSelect = {
  id: true,
  title: true,
  agreedDeliverable: true,
  teams: true,
  startDate: true,
  endDate: true,
  outcomeSummary: true,
  outcomeAdoption: true,
  milestones: {
    select: { step: true, dueAt: true, doneAt: true },
    orderBy: { id: 'asc' },
  },
  course: {
    select: {
      name: true,
      code: true,
      semester: true,
      professor: {
        select: {
          name: true,
          department: true,
          phone: true,
          user: { select: { email: true } },
        },
      },
      coTeachers: {
        select: {
          professor: { select: { name: true } },
        },
      },
    },
  },
  demand: { select: { id: true, title: true } },
} satisfies Prisma.ProjectSelect;

type OrgProject = Prisma.ProjectGetPayload<{ select: typeof orgProjectSelect }>;

function toOrgResponse(project: OrgProject) {
  const { milestones, outcomeAdoption, course, ...rest } = project;
  const { professor, coTeachers, ...courseInfo } = course;
  return {
    ...rest,
    course: courseInfo,
    professor: {
      name: professor.name,
      department: professor.department,
      phone: professor.phone,
      email: professor.user.email,
    },
    coTeachers: (coTeachers ?? []).map((entry) => entry.professor.name),
    milestones: milestones.map(({ step, ...milestone }) => ({
      ...milestone,
      step: toStep(step),
    })),
    outcomeAdoption: outcomeAdoption ? toAdoption(outcomeAdoption) : null,
  };
}

@Injectable()
export class OrgPortalService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    const partner = await this.getPartner(userId);
    const projects = await this.prisma.project.findMany({
      where: { demand: { partnerId: partner.id } },
      select: orgProjectSelect,
      orderBy: { createdAt: 'desc' },
    });
    return projects.map(toOrgResponse);
  }

  async findOne(userId: string, id: number) {
    const partner = await this.getPartner(userId);
    const project = await this.prisma.project.findFirst({
      where: { id, demand: { partnerId: partner.id } },
      select: orgProjectSelect,
    });
    if (!project) {
      throw new NotFoundException('Projeto não encontrado.');
    }
    return toOrgResponse(project);
  }

  private async getPartner(userId: string) {
    const partner = await this.prisma.partner.findUnique({
      where: { userId: Number(userId) },
    });
    if (!partner) {
      throw new NotFoundException('Perfil de organização não encontrado.');
    }
    return partner;
  }
}
