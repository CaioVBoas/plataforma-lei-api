import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PapelUsuario, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { Role } from '../../common/enums/role.enum';
import { toPapelUsuario, toRole } from '../../common/mappers/role.mapper';
import { PrismaService } from '../../database/prisma.service';
import { AuthResponseDto, UserResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterPartnerDto } from './dto/register-partner.dto';
import { RegisterProfessorDto } from './dto/register-professor.dto';
import { RegisterStudentDto } from './dto/register-student.dto';

export const SALT_ROUNDS = 10;

/**
 * Mensagem única para e-mail inexistente e senha incorreta: revelar qual dos
 * dois falhou permitiria enumerar as contas cadastradas.
 */
const INVALID_CREDENTIALS = 'Credenciais inválidas.';

/**
 * Seleção explícita em toda query de usuário. O `passwordHash` só entra onde é
 * indispensável (verificação de credenciais) e nunca sai deste service — o
 * contrato não depende de nenhum filtro de serialização para escondê-lo.
 */
const USER_SELECT = {
  id: true,
  email: true,
  role: true,
  professor: { select: { name: true } },
  student: { select: { name: true } },
  partner: { select: { name: true } },
} satisfies Prisma.UserSelect;

type UserWithProfiles = {
  id: number;
  email: string;
  role: PapelUsuario;
  professor: { name: string } | null;
  student: { name: string } | null;
  partner: { name: string } | null;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async registerStudent(dto: RegisterStudentDto): Promise<AuthResponseDto> {
    return this.register(dto, Role.STUDENT, (tx, userId) =>
      tx.student.create({
        data: {
          userId,
          name: dto.name,
          registrationNumber: dto.registrationNumber,
        },
        select: { name: true },
      }),
    );
  }

  async registerProfessor(dto: RegisterProfessorDto): Promise<AuthResponseDto> {
    return this.register(dto, Role.PROFESSOR, (tx, userId) =>
      tx.professor.create({
        data: { userId, name: dto.name },
        select: { name: true },
      }),
    );
  }

  async registerPartner(dto: RegisterPartnerDto): Promise<AuthResponseDto> {
    return this.register(dto, Role.ORGANIZATION, (tx, userId) =>
      tx.partner.create({
        data: { userId, name: dto.name, type: dto.type },
        select: { name: true },
      }),
    );
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { ...USER_SELECT, passwordHash: true },
    });

    if (!user) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    // Desmonta explicitamente: o passwordHash não segue adiante nem por acidente.
    return this.buildAuthResponse({
      id: user.id,
      email: user.email,
      role: user.role,
      professor: user.professor,
      student: user.student,
      partner: user.partner,
    });
  }

  /**
   * Resolve o usuário a partir do `sub` do token — nunca de parâmetro enviado
   * pelo cliente.
   */
  async me(userId: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: this.parseUserId(userId) },
      select: USER_SELECT,
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    return this.toUserResponse(user);
  }

  private async register(
    dto: { email: string; password: string },
    role: Role,
    createProfile: (
      tx: Prisma.TransactionClient,
      userId: number,
    ) => Promise<{ name: string }>,
  ): Promise<AuthResponseDto> {
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    try {
      // Usuário e perfil nascem juntos ou não nascem: sem a transação, uma
      // falha no segundo passo deixaria um usuário sem perfil no banco.
      const user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email: dto.email,
            passwordHash,
            role: toPapelUsuario(role),
          },
          select: { id: true, email: true, role: true },
        });

        const profile = await createProfile(tx, created.id);

        return { ...created, name: profile.name };
      });

      return this.buildAuthResponse(user);
    } catch (error) {
      throw this.translateWriteError(error);
    }
  }

  /**
   * A restrição de unicidade do banco é a autoridade final: sob concorrência,
   * a transação aborta e nada fica persistido. Aqui só traduzimos o erro.
   */
  private translateWriteError(error: unknown): unknown {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const target = this.uniqueTargetOf(error);

      if (target.includes('email')) {
        return new ConflictException('E-mail já cadastrado.');
      }
      if (target.includes('registrationnumber')) {
        return new ConflictException('Matrícula já cadastrada.');
      }
      return new ConflictException('Registro já existente.');
    }

    return error;
  }

  private uniqueTargetOf(error: Prisma.PrismaClientKnownRequestError): string {
    const target = error.meta?.target;
    const asText = Array.isArray(target)
      ? target.join(',')
      : typeof target === 'string'
        ? target
        : error.message;

    return asText.toLowerCase();
  }

  /**
   * O contrato externo trata o identificador como string; o banco usa inteiro
   * autoincremento. `Number('abc')` devolveria `NaN` e o Prisma lançaria um
   * erro obscuro, então a validação acontece antes de tocar o banco.
   */
  private parseUserId(userId: string): number {
    const parsed = Number(userId);

    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new UnauthorizedException();
    }

    return parsed;
  }

  private buildAuthResponse(
    user: Omit<UserWithProfiles, 'professor' | 'student' | 'partner'> & {
      name?: string;
      professor?: { name: string } | null;
      student?: { name: string } | null;
      partner?: { name: string } | null;
    },
  ): AuthResponseDto {
    const userResponse = this.toUserResponse(user);

    // O payload precisa ser exatamente { sub, email, role }: é o que a
    // JwtStrategy já existente consome. Qualquer outro formato quebraria o
    // JwtAuthGuard silenciosamente.
    const accessToken = this.jwtService.sign({
      sub: userResponse.id,
      email: userResponse.email,
      role: userResponse.role,
    });

    return { user: userResponse, accessToken };
  }

  private toUserResponse(user: {
    id: number;
    email: string;
    role: PapelUsuario;
    name?: string;
    professor?: { name: string } | null;
    student?: { name: string } | null;
    partner?: { name: string } | null;
  }): UserResponseDto {
    // O nome vem do perfil, nunca de User. Sem perfil, o campo é omitido.
    const name =
      user.name ??
      user.professor?.name ??
      user.student?.name ??
      user.partner?.name;

    const response: UserResponseDto = {
      id: String(user.id),
      email: user.email,
      role: toRole(user.role),
    };

    if (name !== undefined) {
      response.name = name;
    }

    return response;
  }
}
