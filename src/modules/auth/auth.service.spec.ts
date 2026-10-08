import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { PapelUsuario, Prisma, TipoParceiro } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { Role } from '../../common/enums/role.enum';
import { PrismaService } from '../../database/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  // Mocks tipados: sem isso, `mock.calls[0][0]` volta como `any` e as
  // asserções deixam de ser verificadas pelo compilador.
  type CreateCall = { data: Record<string, unknown> };
  type FindUniqueCall = {
    where: Record<string, unknown>;
    select: Record<string, unknown>;
  };

  const createMock = () => jest.fn<Promise<unknown>, [CreateCall]>();

  const tx = {
    user: { create: createMock() },
    student: { create: createMock() },
    professor: { create: createMock() },
    partner: { create: createMock() },
  };

  const prisma = {
    user: {
      findUnique: jest.fn<Promise<unknown>, [FindUniqueCall]>(),
    },
    $transaction: jest.fn<unknown, [(client: typeof tx) => unknown]>(),
  };

  const jwt = { sign: jest.fn<string, [Record<string, unknown>]>() };

  const uniqueViolation = (target: string[]) =>
    new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '7.10.0',
      meta: { target },
    });

  beforeEach(async () => {
    jest.clearAllMocks();

    prisma.$transaction.mockImplementation((callback) => callback(tx));
    jwt.sign.mockReturnValue('token-assinado');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('registerStudent', () => {
    const dto = {
      email: 'maria@ufpe.br',
      password: 'senhaSegura123',
      name: 'Maria Silva',
      registrationNumber: '2021000123',
    };

    beforeEach(() => {
      tx.user.create.mockResolvedValue({
        id: 1,
        email: dto.email,
        role: PapelUsuario.ESTUDANTE,
      });
      tx.student.create.mockResolvedValue({ name: dto.name });
    });

    it('cria User e Student dentro da mesma transação', async () => {
      await service.registerStudent(dto);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.user.create).toHaveBeenCalledTimes(1);
      expect(tx.student.create).toHaveBeenCalledTimes(1);
      expect(tx.student.create.mock.calls[0][0].data).toMatchObject({
        userId: 1,
        name: dto.name,
        registrationNumber: dto.registrationNumber,
      });
    });

    it('persiste o papel traduzido para o enum do banco', async () => {
      await service.registerStudent(dto);

      expect(tx.user.create.mock.calls[0][0].data).toMatchObject({
        role: PapelUsuario.ESTUDANTE,
      });
    });

    it('armazena a senha como hash, nunca em texto puro', async () => {
      await service.registerStudent(dto);

      const { data } = tx.user.create.mock.calls[0][0];
      const passwordHash = data.passwordHash as string;

      expect(passwordHash).not.toBe(dto.password);
      expect(data).not.toHaveProperty('password');
      await expect(bcrypt.compare(dto.password, passwordHash)).resolves.toBe(
        true,
      );
    });

    it('devolve AuthResponse com id string, papel em inglês e nome do perfil', async () => {
      const result = await service.registerStudent(dto);

      expect(result).toEqual({
        user: {
          id: '1',
          email: dto.email,
          role: Role.STUDENT,
          name: dto.name,
        },
        accessToken: 'token-assinado',
      });
    });

    it('não expõe passwordHash na resposta', async () => {
      const result = await service.registerStudent(dto);

      expect(JSON.stringify(result)).not.toContain('passwordHash');
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('traduz e-mail duplicado em 409 com mensagem explícita', async () => {
      tx.user.create.mockRejectedValue(uniqueViolation(['email']));

      await expect(service.registerStudent(dto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.registerStudent(dto)).rejects.toThrow(
        'E-mail já cadastrado.',
      );
    });

    it('traduz matrícula duplicada em 409', async () => {
      tx.student.create.mockRejectedValue(
        uniqueViolation(['registrationNumber']),
      );

      await expect(service.registerStudent(dto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.registerStudent(dto)).rejects.toThrow(
        'Matrícula já cadastrada.',
      );
    });

    it('não engole erro que não seja violação de unicidade', async () => {
      tx.user.create.mockRejectedValue(new Error('conexão perdida'));

      await expect(service.registerStudent(dto)).rejects.toThrow(
        'conexão perdida',
      );
    });
  });

  describe('registerProfessor', () => {
    const dto = {
      email: 'joao@ufpe.br',
      password: 'senhaSegura123',
      name: 'João Pereira',
    };

    beforeEach(() => {
      tx.user.create.mockResolvedValue({
        id: 2,
        email: dto.email,
        role: PapelUsuario.DOCENTE,
      });
      tx.professor.create.mockResolvedValue({ name: dto.name });
    });

    it('cria User e Professor dentro da mesma transação', async () => {
      await service.registerProfessor(dto);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.user.create).toHaveBeenCalledTimes(1);
      expect(tx.professor.create.mock.calls[0][0].data).toMatchObject({
        userId: 2,
        name: dto.name,
      });
    });

    it('não envia campos do perfil que têm valor padrão no schema', async () => {
      await service.registerProfessor(dto);

      const { data } = tx.professor.create.mock.calls[0][0];

      expect(data).not.toHaveProperty('academicRole');
      expect(data).not.toHaveProperty('paused');
      expect(data).not.toHaveProperty('projectsPerSemester');
    });

    it('devolve papel PROFESSOR na resposta', async () => {
      const result = await service.registerProfessor(dto);

      expect(result.user.role).toBe(Role.PROFESSOR);
      expect(result.user.name).toBe(dto.name);
    });
  });

  describe('registerPartner', () => {
    const dto = {
      email: 'contato@ongverde.org',
      password: 'senhaSegura123',
      name: 'ONG Verde Recife',
      type: TipoParceiro.ORGANIZACAO_SOCIAL_ONG,
    };

    beforeEach(() => {
      tx.user.create.mockResolvedValue({
        id: 3,
        email: dto.email,
        role: PapelUsuario.PARCEIRO,
      });
      tx.partner.create.mockResolvedValue({ name: dto.name });
    });

    it('cria User e Partner dentro da mesma transação, sem traduzir o type', async () => {
      await service.registerPartner(dto);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.partner.create.mock.calls[0][0].data).toMatchObject({
        userId: 3,
        name: dto.name,
        type: TipoParceiro.ORGANIZACAO_SOCIAL_ONG,
      });
    });

    it('devolve papel ORGANIZATION na resposta', async () => {
      const result = await service.registerPartner(dto);

      expect(result.user.role).toBe(Role.ORGANIZATION);
    });
  });

  describe('payload do JWT', () => {
    it('assina exatamente { sub, email, role } com o papel em inglês', async () => {
      tx.user.create.mockResolvedValue({
        id: 7,
        email: 'maria@ufpe.br',
        role: PapelUsuario.ESTUDANTE,
      });
      tx.student.create.mockResolvedValue({ name: 'Maria Silva' });

      await service.registerStudent({
        email: 'maria@ufpe.br',
        password: 'senhaSegura123',
        name: 'Maria Silva',
        registrationNumber: '2021000123',
      });

      expect(jwt.sign).toHaveBeenCalledTimes(1);
      const payload = jwt.sign.mock.calls[0][0];

      expect(payload).toEqual({
        sub: '7',
        email: 'maria@ufpe.br',
        role: Role.STUDENT,
      });
      expect(Object.keys(payload).sort()).toEqual(['email', 'role', 'sub']);
      expect(typeof payload.sub).toBe('string');
    });
  });

  describe('login', () => {
    const password = 'senhaSegura123';
    let passwordHash: string;

    beforeAll(async () => {
      passwordHash = await bcrypt.hash(password, 10);
    });

    const storedUser = () => ({
      id: 1,
      email: 'maria@ufpe.br',
      role: PapelUsuario.ESTUDANTE,
      passwordHash,
      professor: null,
      student: { name: 'Maria Silva' },
      partner: null,
    });

    it('devolve AuthResponse quando as credenciais conferem', async () => {
      prisma.user.findUnique.mockResolvedValue(storedUser());

      const result = await service.login({ email: 'maria@ufpe.br', password });

      expect(result).toEqual({
        user: {
          id: '1',
          email: 'maria@ufpe.br',
          role: Role.STUDENT,
          name: 'Maria Silva',
        },
        accessToken: 'token-assinado',
      });
    });

    it('não expõe passwordHash na resposta', async () => {
      prisma.user.findUnique.mockResolvedValue(storedUser());

      const result = await service.login({ email: 'maria@ufpe.br', password });

      expect(result.user).not.toHaveProperty('passwordHash');
      expect(JSON.stringify(result)).not.toContain(passwordHash);
    });

    it('rejeita senha incorreta com 401', async () => {
      prisma.user.findUnique.mockResolvedValue(storedUser());

      await expect(
        service.login({ email: 'maria@ufpe.br', password: 'senhaErrada123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejeita e-mail inexistente com 401', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'ninguem@ufpe.br', password }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('usa mensagem idêntica para e-mail inexistente e senha errada', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const inexistente = await service
        .login({ email: 'ninguem@ufpe.br', password })
        .catch((error: Error) => error.message);

      prisma.user.findUnique.mockResolvedValue(storedUser());
      const senhaErrada = await service
        .login({ email: 'maria@ufpe.br', password: 'senhaErrada123' })
        .catch((error: Error) => error.message);

      expect(inexistente).toBe(senhaErrada);
      expect(inexistente).toBe('Credenciais inválidas.');
    });

    it('não emite token quando a credencial é inválida', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'ninguem@ufpe.br', password }),
      ).rejects.toThrow(UnauthorizedException);
      expect(jwt.sign).not.toHaveBeenCalled();
    });
  });

  describe('me', () => {
    it('resolve o usuário a partir do sub do token', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 5,
        email: 'joao@ufpe.br',
        role: PapelUsuario.DOCENTE,
        professor: { name: 'João Pereira' },
        student: null,
        partner: null,
      });

      const result = await service.me('5');

      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 5 } }),
      );
      expect(result).toEqual({
        id: '5',
        email: 'joao@ufpe.br',
        role: Role.PROFESSOR,
        name: 'João Pereira',
      });
    });

    it.each(['abc', '', '1.5', '-1', '0', 'NaN'])(
      'rejeita sub inválido (%s) com 401 antes de consultar o banco',
      async (sub) => {
        await expect(service.me(sub)).rejects.toThrow(UnauthorizedException);
        expect(prisma.user.findUnique).not.toHaveBeenCalled();
      },
    );

    it('rejeita com 401 quando o usuário do token não existe mais', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.me('99')).rejects.toThrow(UnauthorizedException);
    });

    it('não seleciona o passwordHash na consulta', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 5,
        email: 'joao@ufpe.br',
        role: PapelUsuario.DOCENTE,
        professor: { name: 'João Pereira' },
        student: null,
        partner: null,
      });

      await service.me('5');

      const { select } = prisma.user.findUnique.mock.calls[0][0];

      expect(select).not.toHaveProperty('passwordHash');
    });
  });

  describe('resolução do nome a partir do perfil', () => {
    const baseUser = {
      id: 9,
      email: 'alguem@ufpe.br',
      professor: null,
      student: null,
      partner: null,
    };

    it.each([
      ['professor', PapelUsuario.DOCENTE, Role.PROFESSOR],
      ['student', PapelUsuario.ESTUDANTE, Role.STUDENT],
      ['partner', PapelUsuario.PARCEIRO, Role.ORGANIZATION],
    ])('usa o nome do perfil %s', async (profile, papel, role) => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        role: papel,
        [profile]: { name: 'Nome do Perfil' },
      });

      const result = await service.me('9');

      expect(result.name).toBe('Nome do Perfil');
      expect(result.role).toBe(role);
    });

    it('omite o campo name quando o usuário não tem perfil', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        role: PapelUsuario.ESTUDANTE,
      });

      const result = await service.me('9');

      expect(result).not.toHaveProperty('name');
      expect(Object.keys(result).sort()).toEqual(['email', 'id', 'role']);
    });
  });
});
