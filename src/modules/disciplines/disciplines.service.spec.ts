/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access --
 * Os testes inspecionam os argumentos aninhados das queries do Prisma; tipar
 * cada forma de `where`/`select` só repetiria o código testado. */
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NivelCurso, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { DisciplinesService } from './disciplines.service';
import { CreateDisciplineDto } from './dto/createDiscipline.dto';

describe('DisciplinesService', () => {
  let service: DisciplinesService;

  const fn = () => jest.fn<Promise<any>, [any]>();

  const tx = {
    skill: { upsert: fn() },
    course: { create: fn(), update: fn() },
    courseSkill: { deleteMany: fn(), createMany: fn() },
  };
  const prisma = {
    professor: { findUnique: fn(), findFirst: fn() },
    course: { findFirst: fn(), findMany: fn(), findUnique: fn(), delete: fn() },
    academicCalendar: { findFirst: fn() },
    project: { count: fn() },
    courseProfessor: { count: fn(), create: fn(), deleteMany: fn() },
    $transaction: jest.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
  };

  const course = (overrides: Record<string, unknown> = {}) => ({
    id: 10,
    professorId: 1,
    name: 'Extensão',
    code: 'IF1',
    semester: '2026.2',
    expectedLevel: NivelCurso.INTERMEDIARIO,
    enrolledStudents: 40,
    teamSize: 5,
    projectCapacity: 3,
    calendar: { isCurrent: true },
    skills: [{ skill: { name: 'React' } }],
    coTeachers: [
      { professor: { name: 'Colega', user: { email: 'c@cin.ufpe.br' } } },
    ],
    _count: { projects: 2 },
    ...overrides,
  });

  const input: CreateDisciplineDto = {
    name: 'Extensão',
    code: 'IF1',
    level: 'advanced',
    students: 40,
    teamSize: 5,
    projectSlots: 3,
    skills: ['React', ' React ', 'Node'],
  };

  const uniqueViolation = () =>
    new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: '7',
    });

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.professor.findUnique.mockResolvedValue({ id: 1 });
    prisma.course.findFirst.mockResolvedValue(course());
    prisma.academicCalendar.findFirst.mockResolvedValue({ semester: '2026.2' });
    tx.skill.upsert.mockImplementation(({ where }) =>
      Promise.resolve({ id: where.name.length }),
    );
    tx.course.create.mockResolvedValue(course());
    tx.course.update.mockResolvedValue(course());

    const module = await Test.createTestingModule({
      providers: [
        DisciplinesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(DisciplinesService);
  });

  describe('leitura', () => {
    it('mapeia para o contrato: ids string, nível traduzido e derivados', async () => {
      prisma.course.findMany.mockResolvedValue([course()]);

      const [dto] = await service.list('7');

      expect(dto).toEqual({
        id: '10',
        name: 'Extensão',
        code: 'IF1',
        semester: '2026.2',
        level: 'intermediate',
        students: 40,
        teamSize: 5,
        projectSlots: 3,
        skills: ['React'],
        coTeachers: [{ email: 'c@cin.ufpe.br', name: 'Colega' }],
        activeProjects: 2,
        isCurrent: true,
      });
    });

    it('lista principal ou co-docente e conta só projetos sem encerramento concluído', async () => {
      prisma.course.findMany.mockResolvedValue([]);

      await service.list('7');

      const args = prisma.course.findMany.mock.calls[0][0];
      expect(args.where).toEqual({
        OR: [{ professorId: 1 }, { coTeachers: { some: { professorId: 1 } } }],
      });
      expect(args.select._count.select.projects.where).toEqual({
        milestones: {
          none: { step: 'ENCERRAMENTO', doneAt: { not: null } },
        },
      });
    });

    it('isCurrent é false quando o semestre não é o corrente', async () => {
      prisma.course.findMany.mockResolvedValue([
        course({ calendar: { isCurrent: false } }),
        course({ calendar: null }),
      ]);
      const dtos = await service.list('7');
      expect(dtos.map((d) => d.isCurrent)).toEqual([false, false]);
    });

    it('responde 404 para disciplina de terceiros', async () => {
      prisma.course.findFirst.mockResolvedValue(null);
      await expect(service.get('7', 99)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('responde 404 quando o token não tem perfil de docente', async () => {
      prisma.professor.findUnique.mockResolvedValue(null);
      await expect(service.list('7')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('não consulta o banco com userId inválido', async () => {
      await expect(service.list('abc')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.professor.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('usa o semestre corrente, o nível do banco e vincula competências sem repetir', async () => {
      const dto = await service.create('7', input);

      const data = tx.course.create.mock.calls[0][0].data;
      expect(data.semester).toBe('2026.2');
      expect(data.professorId).toBe(1);
      expect(data.expectedLevel).toBe(NivelCurso.AVANCADO);
      expect(data.skills.create).toHaveLength(2);
      expect(tx.skill.upsert).toHaveBeenCalledTimes(2);
      expect(dto.id).toBe('10');
    });

    it('rejeita equipe maior que a turma com 400', async () => {
      await expect(
        service.create('7', { ...input, teamSize: 41 }),
      ).rejects.toThrow('O tamanho da equipe precisa caber na turma.');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejeita competências só com espaços', async () => {
      await expect(
        service.create('7', { ...input, skills: ['  '] }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('falha com 409 claro quando não há semestre corrente', async () => {
      prisma.academicCalendar.findFirst.mockResolvedValue(null);
      await expect(service.create('7', input)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('traduz P2002 em 409', async () => {
      tx.course.create.mockRejectedValue(uniqueViolation());
      await expect(service.create('7', input)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('update', () => {
    it('recusa reduzir vagas abaixo dos projetos em curso', async () => {
      await expect(
        service.update('7', 10, { projectSlots: 1 }),
      ).rejects.toThrow(
        'A disciplina já tem 2 projetos em curso. As vagas não podem ficar abaixo disso.',
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('aceita vagas iguais aos projetos em curso', async () => {
      await service.update('7', 10, { projectSlots: 2 });
      expect(tx.course.update).toHaveBeenCalled();
    });

    it('valida a equipe contra a turma já existente', async () => {
      await expect(
        service.update('7', 10, { students: 4 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('revincula as competências quando skills vem no corpo', async () => {
      await service.update('7', 10, { skills: ['Node'] });
      expect(tx.courseSkill.deleteMany).toHaveBeenCalledWith({
        where: { courseId: 10 },
      });
      expect(tx.courseSkill.createMany).toHaveBeenCalled();
    });

    it('não mexe nas competências quando skills não vem', async () => {
      await service.update('7', 10, { name: 'Novo' });
      expect(tx.courseSkill.deleteMany).not.toHaveBeenCalled();
    });

    it('responde 404 para quem não tem acesso', async () => {
      prisma.course.findFirst.mockResolvedValue(null);
      await expect(
        service.update('7', 10, { name: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('recusa com 409 quando há qualquer projeto, inclusive encerrado', async () => {
      prisma.project.count.mockResolvedValue(1);
      await expect(service.remove('7', 10)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.course.delete).not.toHaveBeenCalled();
      expect(prisma.project.count).toHaveBeenCalledWith({
        where: { courseId: 10 },
      });
    });

    it('exclui quando não há projeto', async () => {
      prisma.project.count.mockResolvedValue(0);
      await service.remove('7', 10);
      expect(prisma.course.delete).toHaveBeenCalledWith({ where: { id: 10 } });
    });
  });

  describe('inviteCoTeacher', () => {
    beforeEach(() => {
      prisma.professor.findFirst.mockResolvedValue({ id: 2 });
      prisma.courseProfessor.count.mockResolvedValue(0);
      prisma.course.findUnique.mockResolvedValue(course());
    });

    it('normaliza o e-mail e cria o vínculo', async () => {
      await service.inviteCoTeacher('7', 10, '  Colega@CIN.UFPE.BR ');

      expect(prisma.professor.findFirst.mock.calls[0][0].where).toEqual({
        user: { email: { equals: 'colega@cin.ufpe.br', mode: 'insensitive' } },
      });
      expect(prisma.courseProfessor.create).toHaveBeenCalledWith({
        data: { courseId: 10, professorId: 2 },
      });
    });

    it.each(['a@ufpe.br', 'a@cin.ufpe.br', 'A@UFPE.BR'])(
      'aceita %s',
      async (e) => {
        await expect(
          service.inviteCoTeacher('7', 10, e),
        ).resolves.toBeDefined();
      },
    );

    it.each(['a@gmail.com', 'a@ufpe.br.com', 'a@xufpe.br', 'ufpe.br'])(
      'recusa %s com 400',
      async (e) => {
        await expect(service.inviteCoTeacher('7', 10, e)).rejects.toThrow(
          'Use o e-mail @ufpe.br ou @cin.ufpe.br do colega.',
        );
      },
    );

    it('recusa disciplina de outro semestre com 409', async () => {
      prisma.course.findFirst.mockResolvedValue(
        course({ calendar: { isCurrent: false }, semester: '2026.1' }),
      );
      await expect(
        service.inviteCoTeacher('7', 10, 'a@ufpe.br'),
      ).rejects.toThrow('Só disciplinas de 2026.2 aceitam convite.');
      expect(prisma.courseProfessor.create).not.toHaveBeenCalled();
    });

    it('responde 404 para e-mail sem conta de docente', async () => {
      prisma.professor.findFirst.mockResolvedValue(null);
      await expect(
        service.inviteCoTeacher('7', 10, 'a@ufpe.br'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('recusa o próprio docente', async () => {
      prisma.professor.findFirst.mockResolvedValue({ id: 1 });
      await expect(
        service.inviteCoTeacher('7', 10, 'eu@ufpe.br'),
      ).rejects.toThrow('Você já é docente desta disciplina.');
    });

    it('recusa colega já vinculado', async () => {
      prisma.courseProfessor.count.mockResolvedValue(1);
      await expect(
        service.inviteCoTeacher('7', 10, 'a@ufpe.br'),
      ).rejects.toThrow('Este colega já está na disciplina.');
    });

    it('recusa convite ao docente principal feito por um co-docente', async () => {
      prisma.professor.findUnique.mockResolvedValue({ id: 5 });
      prisma.professor.findFirst.mockResolvedValue({ id: 1 });
      await expect(
        service.inviteCoTeacher('7', 10, 'a@ufpe.br'),
      ).rejects.toThrow('Este colega já está na disciplina.');
    });

    it('traduz corrida (P2002) em 409', async () => {
      prisma.courseProfessor.create.mockRejectedValue(uniqueViolation());
      await expect(
        service.inviteCoTeacher('7', 10, 'a@ufpe.br'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('removeCoTeacher', () => {
    it('normaliza o e-mail e devolve a disciplina atualizada', async () => {
      prisma.courseProfessor.deleteMany.mockResolvedValue({ count: 1 });
      prisma.course.findUnique.mockResolvedValue(course({ coTeachers: [] }));

      const dto = await service.removeCoTeacher('7', 10, ' C@CIN.UFPE.BR ');

      expect(
        prisma.courseProfessor.deleteMany.mock.calls[0][0].where.professor,
      ).toEqual({
        user: { email: { equals: 'c@cin.ufpe.br', mode: 'insensitive' } },
      });
      expect(dto.coTeachers).toEqual([]);
    });

    it('responde 404 quando o colega não está vinculado', async () => {
      prisma.courseProfessor.deleteMany.mockResolvedValue({ count: 0 });
      await expect(
        service.removeCoTeacher('7', 10, 'x@ufpe.br'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
