/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access --
 * Os testes inspecionam os argumentos aninhados das queries do Prisma; tipar
 * cada forma de `where`/`select` só repetiria o código testado. */
import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TipoParceiro } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { OrganizationsService } from './organizations.service';

describe('OrganizationsService', () => {
  let service: OrganizationsService;

  const fn = () => jest.fn<Promise<any>, [any]>();
  const prisma = {
    professor: { findUnique: fn() },
    partner: { findMany: fn(), findUnique: fn() },
    demand: { findMany: fn() },
    project: { findMany: fn() },
  };

  const partner = (overrides: Record<string, unknown> = {}) => ({
    id: 3,
    name: 'Prefeitura',
    type: TipoParceiro.ORGAO_PUBLICO,
    logo: null,
    cover: null,
    location: null,
    about: null,
    audience: null,
    site: null,
    meetingCadence: null,
    onSiteVisit: null,
    demands: [
      {
        project: {
          title: 'App',
          outcomeSummary: null,
          course: {
            semester: '2026.1',
            name: 'Extensão',
            professor: { name: 'Paola' },
          },
        },
      },
    ],
    ...overrides,
  });

  const project = {
    id: 8,
    title: 'App',
    course: { semester: '2026.2', name: 'Extensão' },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.professor.findUnique.mockResolvedValue({ id: 1 });
    prisma.partner.findUnique.mockResolvedValue(partner());
    prisma.demand.findMany.mockResolvedValue([{ id: 4, title: 'Demanda' }]);
    prisma.project.findMany.mockResolvedValue([]);

    const module = await Test.createTestingModule({
      providers: [
        OrganizationsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(OrganizationsService);
  });

  describe('list', () => {
    it('devolve rótulo, strings vazias no lugar de null, histórico e openDemands', async () => {
      prisma.partner.findMany.mockResolvedValue([
        { ...partner(), _count: { demands: 2 } },
      ]);

      const [org] = await service.list();

      expect(org).toMatchObject({
        id: '3',
        type: 'Órgão público',
        location: '',
        about: '',
        audience: '',
        site: '',
        meetingCadence: '',
        onSiteVisit: '',
        openDemands: 2,
        history: [
          {
            title: 'App',
            semester: '2026.1',
            disciplineName: 'Extensão',
            teacherName: 'Paola',
            result: '',
          },
        ],
      });
    });

    it('conta só demandas publicadas e sem projeto', async () => {
      prisma.partner.findMany.mockResolvedValue([]);
      await service.list();
      expect(
        prisma.partner.findMany.mock.calls[0][0].select._count.select.demands
          .where,
      ).toEqual({ stage: 'PUBLICADA', project: null });
    });

    it('nunca seleciona campo sensível do parceiro', async () => {
      prisma.partner.findMany.mockResolvedValue([]);
      await service.list();
      const select = prisma.partner.findMany.mock.calls[0][0].select;
      for (const field of [
        'focalName',
        'focalRole',
        'phone',
        'channel',
        'user',
      ]) {
        expect(select).not.toHaveProperty(field);
      }
    });
  });

  describe('get — Regra 6', () => {
    it('omite contact e não lê dados sensíveis quando não há projeto', async () => {
      const detail = await service.get('7', 3);

      expect(detail.contact).toBeUndefined();
      expect('contact' in detail).toBe(false);
      expect(JSON.stringify(detail)).not.toMatch(
        /focalName|focalRole|phone|channel|email/,
      );
      // só a leitura do perfil público: nenhuma segunda leitura de Partner
      expect(prisma.partner.findUnique).toHaveBeenCalledTimes(1);
      expect(
        prisma.partner.findUnique.mock.calls[0][0].select,
      ).not.toHaveProperty('focalName');
    });

    it('inclui contact, sem telefone, quando o docente tem projeto', async () => {
      prisma.project.findMany.mockResolvedValue([project]);
      prisma.partner.findUnique
        .mockResolvedValueOnce(partner())
        .mockResolvedValueOnce({
          focalName: 'Renata',
          focalRole: 'Diretora',
          channel: 'E-mail',
          user: { email: 'renata@org.br' },
        });

      const detail = await service.get('7', 3);

      expect(detail.contact).toEqual({
        focalName: 'Renata',
        focalRole: 'Diretora',
        email: 'renata@org.br',
        channel: 'E-mail',
      });
      const contactSelect = prisma.partner.findUnique.mock.calls[1][0].select;
      expect(contactSelect).not.toHaveProperty('phone');
      expect(detail.myProjects).toEqual([
        {
          id: '8',
          title: 'App',
          semester: '2026.2',
          disciplineName: 'Extensão',
        },
      ]);
    });

    it('considera principal ou co-docente da disciplina do projeto', async () => {
      await service.get('7', 3);
      expect(prisma.project.findMany.mock.calls[0][0].where).toEqual({
        demand: { partnerId: 3 },
        course: {
          OR: [
            { professorId: 1 },
            { coTeachers: { some: { professorId: 1 } } },
          ],
        },
      });
    });

    it('usa o docente do token: sem perfil de docente, 404', async () => {
      prisma.professor.findUnique.mockResolvedValue(null);
      await expect(service.get('7', 3)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.partner.findUnique).not.toHaveBeenCalled();
    });

    it('responde 404 para organização inexistente', async () => {
      prisma.partner.findUnique.mockResolvedValue(null);
      await expect(service.get('7', 99)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
