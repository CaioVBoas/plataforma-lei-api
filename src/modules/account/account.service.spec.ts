import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { AccountService } from './account.service';

describe('AccountService', () => {
  let service: AccountService;

  type FindUniqueCall = {
    where: Record<string, unknown>;
    select: Record<string, unknown>;
  };
  type UpdateCall = FindUniqueCall & { data: Record<string, unknown> };

  const prisma = {
    professor: {
      findUnique: jest.fn<Promise<unknown>, [FindUniqueCall]>(),
      update: jest.fn<Promise<unknown>, [UpdateCall]>(),
    },
  };

  const stored = (overrides: Record<string, unknown> = {}) => ({
    name: 'Paola Accioly',
    department: 'Centro de Informática',
    phone: '(81) 99876-1234',
    photo: null,
    tutorialSeen: false,
    user: { email: 'paola.accioly@ufpe.br' },
    ...overrides,
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [AccountService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<AccountService>(AccountService);
  });

  describe('get', () => {
    it('busca o docente pelo usuário do token', async () => {
      prisma.professor.findUnique.mockResolvedValue(stored());

      await service.get('4');

      expect(prisma.professor.findUnique.mock.calls[0][0].where).toEqual({
        userId: 4,
      });
    });

    it('devolve o contrato Account do front, com o e-mail do login', async () => {
      prisma.professor.findUnique.mockResolvedValue(stored());

      await expect(service.get('4')).resolves.toEqual({
        name: 'Paola Accioly',
        email: 'paola.accioly@ufpe.br',
        department: 'Centro de Informática',
        phone: '(81) 99876-1234',
        tutorialSeen: false,
      });
    });

    it('troca telefone nulo por texto vazio e omite a foto ausente', async () => {
      prisma.professor.findUnique.mockResolvedValue(stored({ phone: null }));

      const account = await service.get('4');

      expect(account.phone).toBe('');
      expect(account).not.toHaveProperty('photo');
    });

    it('inclui a foto quando existe', async () => {
      prisma.professor.findUnique.mockResolvedValue(
        stored({ photo: 'data:image/jpeg;base64,AAAA' }),
      );

      const account = await service.get('4');

      expect(account.photo).toBe('data:image/jpeg;base64,AAAA');
    });

    it('não seleciona o passwordHash', async () => {
      prisma.professor.findUnique.mockResolvedValue(stored());

      await service.get('4');

      expect(
        JSON.stringify(prisma.professor.findUnique.mock.calls[0][0].select),
      ).not.toContain('passwordHash');
    });

    it('responde 404 quando o usuário não tem perfil de docente', async () => {
      prisma.professor.findUnique.mockResolvedValue(null);

      await expect(service.get('4')).rejects.toThrow(NotFoundException);
    });

    it('rejeita sub inválido com 401 antes de consultar o banco', async () => {
      await expect(service.get('abc')).rejects.toThrow(UnauthorizedException);
      expect(prisma.professor.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    beforeEach(() => {
      prisma.professor.findUnique.mockResolvedValue({ id: 1 });
      prisma.professor.update.mockResolvedValue(stored());
    });

    it('grava só os campos enviados', async () => {
      await service.update('4', { phone: ' (81) 90000-0000 ' });

      const { where, data } = prisma.professor.update.mock.calls[0][0];

      expect(where).toEqual({ userId: 4 });
      expect(data).toMatchObject({ phone: '(81) 90000-0000' });
      expect(data.name).toBeUndefined();
      expect(data.photo).toBeUndefined();
      expect(data.tutorialSeen).toBeUndefined();
    });

    it('grava a foto enviada como data URL', async () => {
      await service.update('4', { photo: 'data:image/jpeg;base64,AAAA' });

      expect(prisma.professor.update.mock.calls[0][0].data.photo).toBe(
        'data:image/jpeg;base64,AAAA',
      );
    });

    it('remove a foto quando chega texto vazio', async () => {
      await service.update('4', { photo: '' });

      expect(prisma.professor.update.mock.calls[0][0].data.photo).toBeNull();
    });

    it('marca o tutorial como visto', async () => {
      prisma.professor.update.mockResolvedValue(stored({ tutorialSeen: true }));

      const account = await service.update('4', { tutorialSeen: true });

      expect(prisma.professor.update.mock.calls[0][0].data.tutorialSeen).toBe(
        true,
      );
      expect(account.tutorialSeen).toBe(true);
    });

    it('responde 404 sem tentar escrever quando o docente não existe', async () => {
      prisma.professor.findUnique.mockResolvedValue(null);

      await expect(service.update('4', { phone: '1' })).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.professor.update).not.toHaveBeenCalled();
    });
  });
});
