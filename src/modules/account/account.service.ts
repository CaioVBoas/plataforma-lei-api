import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { parseUserId } from '../../common/utils/parseUserId';
import { toStoredImage } from '../../common/validation/imageDataUrl';
import { PrismaService } from '../../database/prisma.service';
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
