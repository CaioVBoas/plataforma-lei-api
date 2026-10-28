import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EtapaProjeto, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { parseUserId } from '../../common/utils/parseUserId';
import { checkPasswordRules, SALT_ROUNDS } from '../../common/utils/password';
import { toStoredImage } from '../../common/validation/imageDataUrl';
import { PrismaService } from '../../database/prisma.service';
import {
  ChangePasswordDto,
  DeleteAccountDto,
} from '../auth/dto/accessAccount.dto';
import { AccountDto } from './dto/account.dto';
import { UpdateAccountDto } from './dto/updateAccount.dto';

const ACCOUNT_SELECT = {
  name: true,
  department: true,
  phone: true,
  photo: true,
  tutorialSeen: true,
  user: { select: { email: true } },
} satisfies Prisma.ProfessorSelect;

type AccountRecord = Prisma.ProfessorGetPayload<{
  select: typeof ACCOUNT_SELECT;
}>;

const PROFESSOR_NOT_FOUND = 'Perfil de docente não encontrado.';

@Injectable()
export class AccountService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string): Promise<AccountDto> {
    const professor = await this.prisma.professor.findUnique({
      where: { userId: parseUserId(userId) },
      select: ACCOUNT_SELECT,
    });

    if (!professor) {
      throw new NotFoundException(PROFESSOR_NOT_FOUND);
    }

    return toAccountDto(professor);
  }

  async update(userId: string, dto: UpdateAccountDto): Promise<AccountDto> {
    const where = { userId: parseUserId(userId) };

    // Confere antes de escrever: `update` em registro inexistente lançaria
    // P2025, que sairia como 500.
    const exists = await this.prisma.professor.findUnique({
      where,
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException(PROFESSOR_NOT_FOUND);
    }

    const professor = await this.prisma.professor.update({
      where,
      data: {
        name: dto.name?.trim(),
        department: dto.department?.trim(),
        phone: dto.phone?.trim(),
        photo: dto.photo === undefined ? undefined : toStoredImage(dto.photo),
        tutorialSeen: dto.tutorialSeen,
      },
      select: ACCOUNT_SELECT,
    });

    return toAccountDto(professor);
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const id = parseUserId(userId);
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, passwordHash: true },
    });
    if (!user) {
      throw new NotFoundException(PROFESSOR_NOT_FOUND);
    }

    const matches = await bcrypt.compare(dto.current, user.passwordHash);
    if (!matches) {
      throw new BadRequestException('A senha atual não confere.');
    }

    checkPasswordRules(dto.next);
    if (dto.next !== dto.confirm) {
      throw new BadRequestException('As duas senhas novas não são iguais.');
    }
    if (dto.next === dto.current) {
      throw new BadRequestException(
        'A senha nova precisa ser diferente da atual.',
      );
    }

    const passwordHash = await bcrypt.hash(dto.next, SALT_ROUNDS);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
  }

  async deleteAccount(userId: string, dto: DeleteAccountDto): Promise<void> {
    const id = parseUserId(userId);
    const professor = await this.prisma.professor.findUnique({
      where: { userId: id },
      select: {
        id: true,
        userId: true,
        user: { select: { email: true } },
        courses: {
          select: {
            projects: {
              select: {
                id: true,
                demandId: true,
                milestones: { select: { step: true, doneAt: true } },
              },
            },
          },
        },
      },
    });

    if (!professor) {
      throw new NotFoundException(PROFESSOR_NOT_FOUND);
    }

    if (
      dto.typedEmail.trim().toLowerCase() !== professor.user.email.toLowerCase()
    ) {
      throw new BadRequestException(
        'Digite o e-mail da conta exatamente como aparece acima.',
      );
    }

    const allProjects = professor.courses.flatMap((course) => course.projects);
    const preSigaaProjects = allProjects.filter(
      (project) =>
        !project.milestones.some(
          (milestone) =>
            milestone.step === EtapaProjeto.SIGAA && milestone.doneAt !== null,
        ),
    );
    const hasSigaaProjects = allProjects.length > preSigaaProjects.length;

    await this.prisma.$transaction(async (tx) => {
      await tx.demand.updateMany({
        where: { reservedByProfessorId: professor.id },
        data: { reservedByProfessorId: null, reservationDeadline: null },
      });

      await tx.demandQuestion.updateMany({
        where: { authorId: professor.userId },
        data: { authorId: null },
      });

      for (const project of preSigaaProjects) {
        await tx.project.delete({ where: { id: project.id } });
        await tx.demand.update({
          where: { id: project.demandId },
          data: { reservedByProfessorId: null, reservationDeadline: null },
        });
      }

      if (hasSigaaProjects) {
        await tx.user.update({
          where: { id: professor.userId },
          data: {
            email: `excluido+${professor.userId}+${Date.now()}@deleted.local`,
            passwordHash: '',
          },
        });
      } else {
        await tx.user.delete({ where: { id: professor.userId } });
      }
    });
  }
}

function toAccountDto(professor: AccountRecord): AccountDto {
  const account: AccountDto = {
    name: professor.name,
    email: professor.user.email,
    department: professor.department,
    phone: professor.phone ?? '',
    tutorialSeen: professor.tutorialSeen,
  };

  // Sem foto, o front mostra as iniciais: o campo some em vez de vir vazio.
  if (professor.photo) {
    account.photo = professor.photo;
  }

  return account;
}
