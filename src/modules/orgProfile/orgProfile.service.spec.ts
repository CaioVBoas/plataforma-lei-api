import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TipoParceiro } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { OrgProfileService } from './orgProfile.service';

describe('OrgProfileService', () => {
  let service: OrgProfileService;

  type FindUniqueCall = {
    where: Record<string, unknown>;
    select: Record<string, unknown>;
  };
  type UpdateCall = FindUniqueCall & { data: Record<string, unknown> };

  const prisma = {
    partner: {
      findUnique: jest.fn<Promise<unknown>, [FindUniqueCall]>(),
      update: jest.fn<Promise<unknown>, [UpdateCall]>(),
    },
  };

  const LOGIN_EMAIL = 'renata.vasconcelos@exemplo.org.br';

  const stored = (overrides: Record<string, unknown> = {}) => ({
    id: 7,
    name: 'Hospital das Clínicas',
    type: TipoParceiro.ORGAO_PUBLICO,
    location: 'Cidade Universitária, Recife',
    about: 'Hospital universitário federal.',
    audience: 'Pacientes do SUS',
    site: 'hc.ufpe.br',
    meetingCadence: 'Quinzenal',
    onSiteVisit: 'Recebe a turma',
    logo: null,
    cover: null,
    focalName: 'Renata Vasconcelos',
    focalRole: 'Coordenadora',
    contactEmail: null,
    phone: '(81) 98765-4321',
    channel: 'E-mail institucional',
    tutorialSeen: false,
    user: { email: LOGIN_EMAIL },
    ...overrides,
  });

  const lastUpdateData = () => prisma.partner.update.mock.calls[0][0].data;

  beforeEach(async () => {
    jest.clearAllMocks();

    prisma.partner.findUnique.mockResolvedValue(stored());
    prisma.partner.update.mockResolvedValue(stored());

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrgProfileService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<OrgProfileService>(OrgProfileService);
  });

  describe('conta do representante', () => {
    it('busca a organização pelo usuário do token', async () => {
      await service.getAccount('3');

      expect(prisma.partner.findUnique.mock.calls[0][0].where).toEqual({
        userId: 3,
      });
    });

    it('expõe o ponto focal como representante, com o e-mail do login', async () => {
      await expect(service.getAccount('3')).resolves.toEqual({
        organizationId: '7',
        name: 'Renata Vasconcelos',
        email: LOGIN_EMAIL,
        position: 'Coordenadora',
        phone: '(81) 98765-4321',
        tutorialSeen: false,
      });
    });

    it('troca nulos por texto vazio', async () => {
      prisma.partner.findUnique.mockResolvedValue(
        stored({ focalName: null, focalRole: null, phone: null }),
      );

      const account = await service.getAccount('3');

      expect(account).toMatchObject({ name: '', position: '', phone: '' });
    });

    it('grava nome e cargo nas colunas do ponto focal', async () => {
      await service.updateAccount('3', {
        name: ' Ana Souza ',
        position: 'Diretora',
        phone: '(81) 90000-0000',
      });

      expect(prisma.partner.update.mock.calls[0][0].where).toEqual({ id: 7 });
      expect(lastUpdateData()).toMatchObject({
        focalName: 'Ana Souza',
        focalRole: 'Diretora',
        phone: '(81) 90000-0000',
      });
    });

    it('marca o tutorial como visto sem tocar nos outros campos', async () => {
      await service.updateAccount('3', { tutorialSeen: true });

      const data = lastUpdateData();
      expect(data.tutorialSeen).toBe(true);
      expect(data.focalName).toBeUndefined();
      expect(data.phone).toBeUndefined();
    });
  });

  describe('perfil institucional', () => {
    it('devolve organização e contato no formato do front', async () => {
      const profile = await service.getProfile('3');

      expect(profile).toEqual({
        organization: {
          id: '7',
          name: 'Hospital das Clínicas',
          type: TipoParceiro.ORGAO_PUBLICO,
          location: 'Cidade Universitária, Recife',
          about: 'Hospital universitário federal.',
          audience: 'Pacientes do SUS',
          site: 'hc.ufpe.br',
          meetingCadence: 'Quinzenal',
          onSiteVisit: 'Recebe a turma',
          history: [],
        },
        contact: {
          focalName: 'Renata Vasconcelos',
          focalRole: 'Coordenadora',
          email: LOGIN_EMAIL,
          channel: 'E-mail institucional',
        },
      });
    });

    it('usa o e-mail do contato quando ele difere do login', async () => {
      prisma.partner.findUnique.mockResolvedValue(
        stored({ contactEmail: 'regulacao@exemplo.org.br' }),
      );

      const profile = await service.getProfile('3');

      expect(profile.contact.email).toBe('regulacao@exemplo.org.br');
    });

    it('inclui logo e capa quando existem', async () => {
      prisma.partner.findUnique.mockResolvedValue(
        stored({
          logo: 'data:image/png;base64,AAAA',
          cover: 'data:image/jpeg;base64,BBBB',
        }),
      );

      const { organization } = await service.getProfile('3');

      expect(organization.logo).toBe('data:image/png;base64,AAAA');
      expect(organization.cover).toBe('data:image/jpeg;base64,BBBB');
    });

    it('grava os dados institucionais e o contato', async () => {
      await service.updateProfile('3', {
        type: TipoParceiro.ORGANIZACAO_SOCIAL_ONG,
        site: ' hc.ufpe.br ',
        contact: {
          focalName: 'Ana Souza',
          focalRole: 'Diretora',
          email: 'Regulacao@Exemplo.org.br',
          channel: 'WhatsApp',
        },
      });

      expect(lastUpdateData()).toMatchObject({
        type: TipoParceiro.ORGANIZACAO_SOCIAL_ONG,
        site: 'hc.ufpe.br',
        focalName: 'Ana Souza',
        focalRole: 'Diretora',
        channel: 'WhatsApp',
        contactEmail: 'regulacao@exemplo.org.br',
      });
    });

    it('não grava contactEmail quando é o mesmo e-mail do login', async () => {
      await service.updateProfile('3', {
        contact: { focalName: 'Renata', email: LOGIN_EMAIL.toUpperCase() },
      });

      expect(lastUpdateData().contactEmail).toBeNull();
    });

    it('não mexe no contato quando ele não vem no corpo', async () => {
      await service.updateProfile('3', { about: 'Novo texto' });

      const data = lastUpdateData();
      expect(data).not.toHaveProperty('focalName');
      expect(data).not.toHaveProperty('contactEmail');
    });
  });

  describe('imagens', () => {
    it('grava o logo enviado e deixa a capa como está', async () => {
      await service.updateImages('3', { logo: 'data:image/png;base64,AAAA' });

      const data = lastUpdateData();
      expect(data.logo).toBe('data:image/png;base64,AAAA');
      expect(data.cover).toBeUndefined();
    });

    it('remove a imagem quando chega texto vazio', async () => {
      await service.updateImages('3', { cover: '' });

      expect(lastUpdateData().cover).toBeNull();
    });
  });

  it('responde 404 quando o usuário não tem organização', async () => {
    prisma.partner.findUnique.mockResolvedValue(null);

    await expect(service.getProfile('3')).rejects.toThrow(NotFoundException);
    await expect(service.updateImages('3', { logo: '' })).rejects.toThrow(
      'Perfil de organização não encontrado.',
    );
    expect(prisma.partner.update).not.toHaveBeenCalled();
  });
});
