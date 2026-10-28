import { Injectable, NotFoundException } from '@nestjs/common';
import { EtapaProjeto, Prisma } from '@prisma/client';
import { BusinessRuleException } from '../../common/exceptions/businessRule.exception';
import { PrismaService } from '../../database/prisma.service';
import { AdoptProjectDto } from './dto/adoptProject.dto';
import { CompleteMilestoneDto } from './dto/completeMilestone.dto';
import { UpdatePlanDto } from './dto/updatePlan.dto';
import { UpdateTeamsDto } from './dto/updateTeams.dto';
import {
  ProjectDetail,
  projectInclude,
  toProjectResponse,
} from './projects.mapper';
import {
  buildInitialPlanSections,
  computeMilestoneDates,
  demandFitsCourseLevel,
  maxTeams,
  WORKLOAD_TEMPLATE,
} from './projects.rules';
import {
  MilestoneStep,
  STEP_ORDER,
  toAdocaoResultado,
  toEtapa,
} from './projects.steps';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async adopt(userId: string, dto: AdoptProjectDto) {
    const professor = await this.getProfessor(userId);

    const demand = await this.prisma.demand.findUnique({
      where: { id: dto.demandId },
      include: { project: { select: { id: true } } },
    });
    if (!demand) {
      throw new NotFoundException('Demanda não encontrada.');
    }
    if (demand.project) {
      throw new BusinessRuleException('Esta demanda já foi adotada.');
    }
    if (demand.reservedByProfessorId !== professor.id) {
      throw new BusinessRuleException(
        'A demanda precisa estar reservada por você para ser adotada.',
      );
    }

    const course = await this.prisma.course.findFirst({
      where: {
        id: dto.courseId,
        ...this.accessibleCourseWhere(professor.id),
      },
    });
    if (!course) {
      throw new NotFoundException('Disciplina não encontrada.');
    }

    const calendar = await this.prisma.academicCalendar.findUnique({
      where: { semester: course.semester },
    });
    if (!calendar) {
      throw new BusinessRuleException(
        'Não há calendário acadêmico para o semestre da disciplina.',
      );
    }

    const now = new Date();
    if (now > calendar.linkDeadline) {
      throw new BusinessRuleException(
        'O prazo semestral para vincular projetos já encerrou.',
      );
    }
    if (!demandFitsCourseLevel(demand.level, course.expectedLevel)) {
      throw new BusinessRuleException(
        'O nível da demanda excede o nível esperado da disciplina.',
      );
    }

    const adopted = await this.prisma.project.count({
      where: {
        courseId: course.id,
        milestones: {
          none: { step: EtapaProjeto.ENCERRAMENTO, doneAt: { not: null } },
        },
      },
    });
    if (adopted >= course.projectCapacity) {
      throw new BusinessRuleException(
        'A turma não tem vagas livres para novos projetos.',
      );
    }

    const teams = dto.teams ?? 1;
    this.assertTeamsFitCourse(teams, course);

    const dates = computeMilestoneDates(now, calendar);

    const project = await this.prisma.project.create({
      data: {
        demandId: demand.id,
        courseId: course.id,
        title: demand.title,
        teams,
        startDate: calendar.startsAt,
        endDate: calendar.endsAt,
        milestones: {
          create: STEP_ORDER.map((step) => ({
            step: toEtapa(step),
            dueAt: dates[toEtapa(step)],
          })),
        },
        proposalSections: {
          create: buildInitialPlanSections(demand, course, teams),
        },
        workloads: { create: WORKLOAD_TEMPLATE },
      },
      include: projectInclude,
    });
    return toProjectResponse(project);
  }

  async findAll(userId: string) {
    const professor = await this.getProfessor(userId);
    const projects = await this.prisma.project.findMany({
      where: { course: this.accessibleCourseWhere(professor.id) },
      include: projectInclude,
      orderBy: { createdAt: 'desc' },
    });
    return projects.map(toProjectResponse);
  }

  async findOne(userId: string, id: number) {
    const professor = await this.getProfessor(userId);
    return toProjectResponse(await this.getOwnedProject(professor.id, id));
  }

  async updatePlan(userId: string, id: number, dto: UpdatePlanDto) {
    const professor = await this.getProfessor(userId);
    const project = await this.getOwnedProject(professor.id, id);

    if (this.isDone(project, EtapaProjeto.SIGAA)) {
      throw new BusinessRuleException(
        'O plano não pode mais ser editado após o registro no SIGAA.',
      );
    }

    const seen = new Set<number>();
    const updates = dto.sections.map((incoming) => {
      const section = project.proposalSections.find(
        (s) => s.order === incoming.order,
      );
      if (!section) {
        throw new NotFoundException(
          `Seção ${incoming.order} não existe neste plano.`,
        );
      }
      if (seen.has(incoming.order)) {
        throw new BusinessRuleException(
          `A seção ${incoming.order} foi enviada mais de uma vez.`,
        );
      }
      seen.add(incoming.order);
      if (incoming.text.length > section.limit) {
        throw new BusinessRuleException(
          `A seção "${section.title}" excede o limite de ${section.limit} caracteres.`,
        );
      }
      return this.prisma.proposalSection.update({
        where: { id: section.id },
        data: { text: incoming.text },
      });
    });

    await this.prisma.$transaction(updates);
    return this.findOne(userId, id);
  }

  async updateTeams(userId: string, id: number, dto: UpdateTeamsDto) {
    const professor = await this.getProfessor(userId);
    const project = await this.getOwnedProject(professor.id, id);
    this.assertTeamsFitCourse(dto.teams, project.course);

    const updated = await this.prisma.project.update({
      where: { id },
      data: { teams: dto.teams },
      include: projectInclude,
    });
    return toProjectResponse(updated);
  }

  async completeMilestone(
    userId: string,
    id: number,
    step: MilestoneStep,
    dto: CompleteMilestoneDto,
  ) {
    const professor = await this.getProfessor(userId);
    const project = await this.getOwnedProject(professor.id, id);
    const etapa = toEtapa(step);

    const milestone = project.milestones.find((m) => m.step === etapa);
    if (!milestone) {
      throw new NotFoundException('Etapa não encontrada neste projeto.');
    }
    if (milestone.doneAt) {
      throw new BusinessRuleException('Esta etapa já foi concluída.');
    }

    const pending = STEP_ORDER.slice(0, STEP_ORDER.indexOf(step)).find(
      (previous) => !this.isDone(project, toEtapa(previous)),
    );
    if (pending) {
      throw new BusinessRuleException(
        `Conclua a etapa "${pending}" antes de "${step}".`,
      );
    }

    if (step === MilestoneStep.SIGAA && !dto.sigaaCode) {
      throw new BusinessRuleException(
        'Informe o código do SIGAA para concluir esta etapa.',
      );
    }
    if (step === MilestoneStep.CLOSING && !dto.outcome) {
      throw new BusinessRuleException(
        'Informe o resumo e o nível de adoção para encerrar o projeto.',
      );
    }

    const projectData: Prisma.ProjectUpdateInput = {};
    if (step === MilestoneStep.SIGAA) {
      projectData.sigaaCode = dto.sigaaCode;
    }
    if (step === MilestoneStep.CLOSING && dto.outcome) {
      projectData.outcomeSummary = dto.outcome.summary;
      projectData.outcomeAdoption = toAdocaoResultado(dto.outcome.adoption);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.projectMilestone.update({
        where: { id: milestone.id },
        data: {
          doneAt: new Date(),
          ...(dto.note !== undefined && { note: dto.note }),
        },
      });
      return tx.project.update({
        where: { id },
        data: projectData,
        include: projectInclude,
      });
    });
    return toProjectResponse(updated);
  }

  async withdraw(userId: string, id: number): Promise<void> {
    const professor = await this.getProfessor(userId);
    const project = await this.getOwnedProject(professor.id, id);

    if (this.isDone(project, EtapaProjeto.SIGAA)) {
      throw new BusinessRuleException(
        'Não é possível desistir após o registro no SIGAA.',
      );
    }

    await this.prisma.$transaction([
      this.prisma.project.delete({ where: { id } }),
      this.prisma.demand.update({
        where: { id: project.demandId },
        data: { reservedByProfessorId: null, reservationDeadline: null },
      }),
    ]);
  }

  private async getProfessor(userId: string) {
    const professor = await this.prisma.professor.findUnique({
      where: { userId: Number(userId) },
    });
    if (!professor) {
      throw new NotFoundException('Perfil de docente não encontrado.');
    }
    return professor;
  }

  private accessibleCourseWhere(professorId: number): Prisma.CourseWhereInput {
    return {
      OR: [{ professorId }, { coTeachers: { some: { professorId } } }],
    };
  }

  /** Projeto de outra pessoa é tratado como inexistente. */
  private async getOwnedProject(
    professorId: number,
    id: number,
  ): Promise<ProjectDetail> {
    const project = await this.prisma.project.findFirst({
      where: { id, course: this.accessibleCourseWhere(professorId) },
      include: projectInclude,
    });
    if (!project) {
      throw new NotFoundException('Projeto não encontrado.');
    }
    return project;
  }

  private isDone(project: ProjectDetail, etapa: EtapaProjeto): boolean {
    return project.milestones.some((m) => m.step === etapa && m.doneAt);
  }

  private assertTeamsFitCourse(
    teams: number,
    course: { enrolledStudents: number; teamSize: number },
  ) {
    const limit = maxTeams(course.enrolledStudents, course.teamSize);
    if (teams > limit) {
      throw new BusinessRuleException(
        `A turma comporta no máximo ${limit} equipe(s).`,
      );
    }
  }
}
