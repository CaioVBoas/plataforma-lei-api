import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { CalendarService } from './calendar.service';

describe('CalendarService', () => {
  let service: CalendarService;

  type FindFirstCall = {
    where: Record<string, unknown>;
    orderBy: Record<string, unknown>;
  };

  const prisma = {
    academicCalendar: {
      findFirst: jest.fn<Promise<unknown>, [FindFirstCall]>(),
    },
  };

  const semester = {
    semester: '2026.2',
    startsAt: new Date('2026-08-03T00:00:00Z'),
    endsAt: new Date('2026-12-04T00:00:00Z'),
    linkDeadline: new Date('2026-09-12T00:00:00Z'),
    midtermAt: new Date('2026-10-09T00:00:00Z'),
    finalAt: new Date('2026-11-27T00:00:00Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CalendarService>(CalendarService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('consulta o semestre marcado como corrente, o mais recente primeiro', async () => {
    prisma.academicCalendar.findFirst.mockResolvedValue(semester);

    await service.current();

    const call = prisma.academicCalendar.findFirst.mock.calls[0][0];
    expect(call.where).toEqual({ isCurrent: true });
    expect(call.orderBy).toEqual({ startsAt: 'desc' });
  });

  it('devolve o contrato SemesterCalendar do front, com datas YYYY-MM-DD', async () => {
    jest.setSystemTime(new Date('2026-08-24T15:00:00Z'));
    prisma.academicCalendar.findFirst.mockResolvedValue(semester);

    await expect(service.current()).resolves.toEqual({
      id: '2026.2',
      startsAt: '2026-08-03',
      endsAt: '2026-12-04',
      linkDeadline: '2026-09-12',
      midtermAt: '2026-10-09',
      finalAt: '2026-11-27',
      today: '2026-08-24',
    });
  });

  it.each([
    // 01:30 UTC ainda é 22:30 do dia anterior em Recife (UTC-3).
    ['2026-08-25T01:30:00Z', '2026-08-24'],
    ['2026-08-25T03:00:00Z', '2026-08-25'],
  ])('calcula today no fuso de Recife (%s → %s)', async (now, today) => {
    jest.setSystemTime(new Date(now));
    prisma.academicCalendar.findFirst.mockResolvedValue(semester);

    const calendar = await service.current();

    expect(calendar.today).toBe(today);
  });

  it('responde 404 quando não há semestre ativo', async () => {
    prisma.academicCalendar.findFirst.mockResolvedValue(null);

    await expect(service.current()).rejects.toThrow(NotFoundException);
    await expect(service.current()).rejects.toThrow(
      'Nenhum semestre ativo cadastrado.',
    );
  });
});
