import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EtapaProjeto, Prisma } from '@prisma/client';
import {
  toCourseLevel,
  toNivelCurso,
} from '../../common/mappers/courseLevel.mapper';
import { PrismaService } from '../../database/prisma.service';
import { CoTeacherDto, DisciplineDto } from './dto/discipline.dto';
import { CreateDisciplineDto } from './dto/createDiscipline.dto';
import { UpdateDisciplineDto } from './dto/updateDiscipline.dto';

const UFPE_EMAIL = /@(cin\.)?ufpe\.br$/i;

/**
 * Um projeto ocupa vaga até que exista o marco ENCERRAMENTO concluído. Contar
 * "todos os projetos" travaria as vagas de quem já encerrou.
 */
const OCCUPIES_SLOT = {
  milestones: {
    none: { step: EtapaProjeto.ENCERRAMENTO, doneAt: { not: null } },
  },
} satisfies Prisma.ProjectWhereInput;

const COURSE_SELECT = {
  id: true,
  professorId: true,
  name: true,
  code: true,
  semester: true,
  expectedLevel: true,
  enrolledStudents: true,
  teamSize: true,
  projectCapacity: true,
  calendar: { select: { isCurrent: true } },
  skills: { select: { skill: { select: { name: true } } } },
  coTeachers: {
    select: {
      professor: { select: { name: true, user: { select: { email: true } } } },
    },
  },
  _count: { select: { projects: { where: OCCUPIES_SLOT } } },
} satisfies Prisma.CourseSelect;

type CourseRow = Prisma.CourseGetPayload<{ select: typeof COURSE_SELECT }>;

const normalizeEmail = (email: string) => email.trim().toLowerCase();

@Injectable()
export class DisciplinesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<DisciplineDto[]> {
    const professorId = await this.professorIdOf(userId);
    const courses = await this.prisma.course.findMany({
      where: this.accessibleBy(professorId),
      select: COURSE_SELECT,
      orderBy: [{ semester: 'desc' }, { name: 'asc' }],
    });
    return courses.map((course) => this.toDto(course));
  }

  async get(userId: string, id: number): Promise<DisciplineDto> {
    const professorId = await this.professorIdOf(userId);
    return this.toDto(await this.findAccessible(id, professorId));
  }

  async create(
    userId: string,
    dto: CreateDisciplineDto,
  ): Promise<DisciplineDto> {
    const professorId = await this.professorIdOf(userId);
    this.assertTeamFits(dto.teamSize, dto.students);

    const calendar = await this.prisma.academicCalendar.findFirst({
      where: { isCurrent: true },
      select: { semester: true },
    });
    if (!calendar) {
      throw new ConflictException(
        'Não há semestre letivo corrente configurado.',
      );
    }

    const skillNames = this.uniqueSkills(dto.skills);

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const skillIds = await this.upsertSkills(tx, skillNames);
        return tx.course.create({
          data: {
            professorId,
            name: dto.name,
            code: dto.code,
            semester: calendar.semester,
            expectedLevel: toNivelCurso(dto.level),
            enrolledStudents: dto.students,
            teamSize: dto.teamSize,
            projectCapacity: dto.projectSlots,
            skills: { create: skillIds.map((skillId) => ({ skillId })) },
          },
          select: COURSE_SELECT,
        });
      });
      return this.toDto(created);
    } catch (error) {
      this.rethrowDuplicateCode(error);
      throw error;
    }
  }

  async update(
    userId: string,
    id: number,
    dto: UpdateDisciplineDto,
  ): Promise<DisciplineDto> {
    const professorId = await this.professorIdOf(userId);
    const current = await this.findAccessible(id, professorId);

    // Valida o resultado da atualização, não só o que veio no corpo: mudar
    // apenas `students` também pode deixar a equipe maior que a turma.
    const students = dto.students ?? current.enrolledStudents;
    const teamSize = dto.teamSize ?? current.teamSize;
    this.assertTeamFits(teamSize, students);

    const activeProjects = current._count.projects;
    if (dto.projectSlots !== undefined && dto.projectSlots < activeProjects) {
      throw new ConflictException(
        `A disciplina já tem ${activeProjects} projetos em curso. As vagas não podem ficar abaixo disso.`,
      );
    }

    const skillNames = dto.skills ? this.uniqueSkills(dto.skills) : undefined;

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        if (skillNames) {
          const skillIds = await this.upsertSkills(tx, skillNames);
          await tx.courseSkill.deleteMany({ where: { courseId: id } });
          await tx.courseSkill.createMany({
            data: skillIds.map((skillId) => ({ courseId: id, skillId })),
          });
        }
        return tx.course.update({
          where: { id },
          data: {
            name: dto.name,
            code: dto.code,
            expectedLevel: dto.level ? toNivelCurso(dto.level) : undefined,
            enrolledStudents: dto.students,
            teamSize: dto.teamSize,
            projectCapacity: dto.projectSlots,
          },
          select: COURSE_SELECT,
        });
      });
      return this.toDto(updated);
    } catch (error) {
      this.rethrowDuplicateCode(error);
      throw error;
    }
  }

  async remove(userId: string, id: number): Promise<void> {
    const professorId = await this.professorIdOf(userId);
    await this.findAccessible(id, professorId);

    // Conta todos os projetos, inclusive os encerrados: eles são o histórico.
    const projects = await this.prisma.project.count({
      where: { courseId: id },
    });
    if (projects > 0) {
      throw new ConflictException(
        'Esta disciplina tem projetos. Ela fica guardada com o histórico deles.',
      );
    }
    await this.prisma.course.delete({ where: { id } });
  }

  async inviteCoTeacher(
    userId: string,
    id: number,
    rawEmail: string,
  ): Promise<DisciplineDto> {
    const professorId = await this.professorIdOf(userId);
    const course = await this.findAccessible(id, professorId);

    const email = normalizeEmail(rawEmail);
    if (!UFPE_EMAIL.test(email)) {
      throw new BadRequestException(
        'Use o e-mail @ufpe.br ou @cin.ufpe.br do colega.',
      );
    }

    if (!course.calendar?.isCurrent) {
      const current = await this.prisma.academicCalendar.findFirst({
        where: { isCurrent: true },
        select: { semester: true },
      });
      throw new ConflictException(
        `Só disciplinas de ${current?.semester ?? 'o semestre corrente'} aceitam convite.`,
      );
    }

    // Sem modelo de convite pendente no schema: só entra quem já é docente.
    const colleague = await this.prisma.professor.findFirst({
      where: { user: { email: { equals: email, mode: 'insensitive' } } },
      select: { id: true },
    });
    if (!colleague) {
      throw new NotFoundException(
        'Nenhum docente cadastrado com este e-mail. Peça ao colega que crie a conta na plataforma antes de convidá-lo.',
      );
    }

    if (colleague.id === professorId) {
      throw new ConflictException('Você já é docente desta disciplina.');
    }
    const alreadyIn =
      colleague.id === course.professorId ||
      (await this.prisma.courseProfessor.count({
        where: { courseId: id, professorId: colleague.id },
      })) > 0;
    if (alreadyIn) {
      throw new ConflictException('Este colega já está na disciplina.');
    }

    try {
      await this.prisma.courseProfessor.create({
        data: { courseId: id, professorId: colleague.id },
      });
    } catch (error) {
      // Dois convites simultâneos para o mesmo colega.
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Este colega já está na disciplina.');
      }
      throw error;
    }
    return this.toDto(await this.findById(id));
  }

  async removeCoTeacher(
    userId: string,
    id: number,
    rawEmail: string,
  ): Promise<DisciplineDto> {
    const professorId = await this.professorIdOf(userId);
    await this.findAccessible(id, professorId);

    const email = normalizeEmail(rawEmail);
    const { count } = await this.prisma.courseProfessor.deleteMany({
      where: {
        courseId: id,
        professor: { user: { email: { equals: email, mode: 'insensitive' } } },
      },
    });
    if (count === 0) {
      throw new NotFoundException('Este colega não está na disciplina.');
    }

    // Quem se removeu perde o acesso, então a releitura não filtra por docente.
    return this.toDto(await this.findById(id));
  }

  /** O docente vem sempre do `sub` do token, nunca de parâmetro do cliente. */
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

  private accessibleBy(professorId: number): Prisma.CourseWhereInput {
    return {
      OR: [{ professorId }, { coTeachers: { some: { professorId } } }],
    };
  }

  // 404 e não 403: não revela a existência de disciplinas de terceiros.
  private async findAccessible(
    id: number,
    professorId: number,
  ): Promise<CourseRow> {
    const course = await this.prisma.course.findFirst({
      where: { id, ...this.accessibleBy(professorId) },
      select: COURSE_SELECT,
    });
    if (!course) {
      throw new NotFoundException('Disciplina não encontrada.');
    }
    return course;
  }

  private async findById(id: number): Promise<CourseRow> {
    const course = await this.prisma.course.findUnique({
      where: { id },
      select: COURSE_SELECT,
    });
    if (!course) {
      throw new NotFoundException('Disciplina não encontrada.');
    }
    return course;
  }

  private assertTeamFits(teamSize: number, students: number) {
    if (teamSize > students) {
      throw new BadRequestException(
        'O tamanho da equipe precisa caber na turma.',
      );
    }
  }

  private uniqueSkills(names: string[]): string[] {
    const unique = [...new Set(names.map((name) => name.trim()))].filter(
      Boolean,
    );
    if (unique.length === 0) {
      throw new BadRequestException('Informe ao menos uma competência.');
    }
    return unique;
  }

  // O catálogo cresce com o uso: nome desconhecido vira competência nova.
  private async upsertSkills(
    tx: Prisma.TransactionClient,
    names: string[],
  ): Promise<number[]> {
    const skills = await Promise.all(
      names.map((name) =>
        tx.skill.upsert({
          where: { name },
          update: {},
          create: { name },
          select: { id: true },
        }),
      ),
    );
    return skills.map((skill) => skill.id);
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  private rethrowDuplicateCode(error: unknown) {
    if (this.isUniqueViolation(error)) {
      throw new ConflictException(
        'Você já tem uma disciplina com este código neste semestre.',
      );
    }
  }

  private toDto(course: CourseRow): DisciplineDto {
    const coTeachers: CoTeacherDto[] = course.coTeachers.map(
      ({ professor }) => ({
        email: professor.user.email,
        name: professor.name,
      }),
    );
    return {
      id: String(course.id),
      name: course.name,
      code: course.code,
      semester: course.semester,
      level: toCourseLevel(course.expectedLevel),
      students: course.enrolledStudents,
      teamSize: course.teamSize,
      projectSlots: course.projectCapacity,
      skills: course.skills.map(({ skill }) => skill.name),
      coTeachers,
      activeProjects: course._count.projects,
      isCurrent: course.calendar?.isCurrent ?? false,
    };
  }
}
