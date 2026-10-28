import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PapelUsuario, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { Role } from '../../common/enums/role.enum';
import { toPapelUsuario, toRole } from '../../common/mappers/role.mapper';
import { parseUserId } from '../../common/utils/parseUserId';
import { checkPasswordRules, SALT_ROUNDS } from '../../common/utils/password';
import { PrismaService } from '../../database/prisma.service';
import { AuthResponseDto, UserResponseDto } from './dto/authResponse.dto';
import { CodeSentDto } from './dto/codeSent.dto';
import { LoginDto } from './dto/login.dto';
import {
  AccessRoleParam,
  RequestPasswordResetDto,
  ResetPasswordDto,
} from './dto/passwordReset.dto';
import { RegisterPartnerDto } from './dto/registerPartner.dto';
import {
  RegisterProfessorDto,
  UFPE_EMAIL_PATTERN,
} from './dto/registerProfessor.dto';
import { RegisterStudentDto } from './dto/registerStudent.dto';

export { SALT_ROUNDS };

export const CODE_RESEND_SECONDS = 30;
const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

type CodePurpose = 'cadastro' | 'senha';

interface PendingCode {
  code: string;
  sentAt: number;
  expiresAt: number;
  attempts: number;
}

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
  private readonly codes = new Map<string, PendingCode>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async requestProfessorSignupCode(
    dto: RegisterProfessorDto,
  ): Promise<CodeSentDto> {
    checkPasswordRules(dto.password);
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'Este e-mail já tem conta. Entre com ele ou use "Esqueci minha senha".',
      );
    }
    return this.sendCode('cadastro', 'docente', dto.email);
  }

  async requestPartnerSignupCode(
    dto: RegisterPartnerDto,
  ): Promise<CodeSentDto> {
    checkPasswordRules(dto.password);
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'Este e-mail já tem conta. Entre com ele ou use "Esqueci minha senha".',
      );
    }
    const existingPartner = await this.prisma.partner.findFirst({
      where: {
        name: { equals: dto.name.trim(), mode: 'insensitive' },
        userId: { not: null },
      },
      select: { id: true },
    });
    if (existingPartner) {
      throw new ConflictException(
        'Esta organização já tem cadastro. Peça a quem cadastrou para entrar, ou fale com o L.E.I.',
      );
    }
    return this.sendCode('cadastro', 'organizacao', dto.email);
  }

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
    checkPasswordRules(dto.password);
    if (dto.code !== undefined) {
      this.verifyCode('cadastro', 'docente', dto.email, dto.code);
    }
    return this.register(dto, Role.PROFESSOR, (tx, userId) =>
      tx.professor.create({
        data: { userId, name: dto.name, department: dto.department },
        select: { name: true },
      }),
    );
  }

  async registerPartner(dto: RegisterPartnerDto): Promise<AuthResponseDto> {
    checkPasswordRules(dto.password);
    if (dto.code !== undefined) {
      this.verifyCode('cadastro', 'organizacao', dto.email, dto.code);
    }
    return this.register(dto, Role.ORGANIZATION, async (tx, userId) => {
      if (tx.partner.findFirst) {
        const orphaned = await tx.partner.findFirst({
          where: {
            name: { equals: dto.name.trim(), mode: 'insensitive' },
            userId: null,
          },
          select: { id: true },
        });
        if (orphaned) {
          return tx.partner.update({
            where: { id: orphaned.id },
            data: {
              userId,
              type: dto.type,
              location: dto.location,
              focalName: dto.focalName,
              focalRole: dto.focalRole,
            },
            select: { name: true },
          });
        }
      }
      return tx.partner.create({
        data: {
          userId,
          name: dto.name,
          type: dto.type,
          location: dto.location,
          focalName: dto.focalName,
          focalRole: dto.focalRole,
        },
        select: { name: true },
      });
    });
  }

  async requestPasswordReset(
    dto: RequestPasswordResetDto,
  ): Promise<CodeSentDto> {
    const email = dto.email.trim().toLowerCase();
    if (dto.role === 'docente' && !UFPE_EMAIL_PATTERN.test(email)) {
      throw new BadRequestException('Use seu e-mail @ufpe.br ou @cin.ufpe.br.');
    }
    const expectedRole =
      dto.role === 'docente' ? PapelUsuario.DOCENTE : PapelUsuario.PARCEIRO;
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, role: true },
    });
    if (!user || user.role !== expectedRole) {
      throw new BadRequestException(
        'Nenhuma conta encontrada com este e-mail.',
      );
    }
    return this.sendCode('senha', dto.role, dto.email);
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    checkPasswordRules(dto.password);
    if (dto.password !== dto.confirm) {
      throw new BadRequestException('As duas senhas não são iguais.');
    }
    this.verifyCode('senha', dto.role, dto.email, dto.code);

    const email = dto.email.trim().toLowerCase();
    const expectedRole =
      dto.role === 'docente' ? PapelUsuario.DOCENTE : PapelUsuario.PARCEIRO;
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, role: true },
    });
    if (!user || user.role !== expectedRole) {
      throw new BadRequestException(
        'Nenhuma conta encontrada com este e-mail.',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
  }

  private codeKey(
    purpose: CodePurpose,
    role: AccessRoleParam,
    email: string,
  ): string {
    return `${purpose}:${role}:${email.trim().toLowerCase()}`;
  }

  private sendCode(
    purpose: CodePurpose,
    role: AccessRoleParam,
    email: string,
  ): CodeSentDto {
    const key = this.codeKey(purpose, role, email);
    const now = Date.now();
    const pending = this.codes.get(key);
    if (pending && now - pending.sentAt < CODE_RESEND_SECONDS * 1000) {
      const waitSeconds = Math.ceil(
        (CODE_RESEND_SECONDS * 1000 - (now - pending.sentAt)) / 1000,
      );
      throw new BadRequestException(
        `Espere ${waitSeconds} segundos para pedir outro código.`,
      );
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    this.codes.set(key, {
      code,
      sentAt: now,
      expiresAt: now + CODE_TTL_MS,
      attempts: 0,
    });
    return {
      sentTo: email.trim(),
      demoCode: code,
      resendIn: CODE_RESEND_SECONDS,
    };
  }

  private verifyCode(
    purpose: CodePurpose,
    role: AccessRoleParam,
    email: string,
    code: string,
  ): void {
    const key = this.codeKey(purpose, role, email);
    const pending = this.codes.get(key);
    if (!pending) {
      throw new BadRequestException('Peça um código primeiro.');
    }
    if (Date.now() > pending.expiresAt) {
      throw new BadRequestException(
        'O código venceu. Toque em "Enviar outro código".',
      );
    }
    pending.attempts += 1;
    if (pending.attempts > MAX_ATTEMPTS) {
      throw new BadRequestException(
        'Muitas tentativas. Toque em "Enviar outro código".',
      );
    }
    if (code.replace(/\D/g, '') !== pending.code) {
      throw new BadRequestException(
        'Código incorreto. Confira os 6 números no e-mail.',
      );
    }
    this.codes.delete(key);
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
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
      where: { id: parseUserId(userId) },
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
      const email = dto.email.trim().toLowerCase();
      const user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email,
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
