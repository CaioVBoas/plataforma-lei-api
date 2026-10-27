import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { SemesterCalendarDto } from './dto/semesterCalendar.dto';

const CALENDAR_SELECT = {
  semester: true,
  startsAt: true,
  endsAt: true,
  linkDeadline: true,
  midtermAt: true,
  finalAt: true,
} satisfies Prisma.AcademicCalendarSelect;

/** Os prazos do PLEI são contados no horário de Recife, não no do servidor. */
const REFERENCE_TIME_ZONE = 'America/Recife';

// `en-CA` formata como `YYYY-MM-DD`.
const dayInRecife = new Intl.DateTimeFormat('en-CA', {
  timeZone: REFERENCE_TIME_ZONE,
});

@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  async current(): Promise<SemesterCalendarDto> {
    // Nada no banco impede dois semestres marcados como correntes; o mais
    // recente vence para a resposta ser determinística.
    const calendar = await this.prisma.academicCalendar.findFirst({
      where: { isCurrent: true },
      orderBy: { startsAt: 'desc' },
      select: CALENDAR_SELECT,
    });

    if (!calendar) {
      throw new NotFoundException('Nenhum semestre ativo cadastrado.');
    }

    return {
      id: calendar.semester,
      startsAt: toDay(calendar.startsAt),
      endsAt: toDay(calendar.endsAt),
      linkDeadline: toDay(calendar.linkDeadline),
      midtermAt: toDay(calendar.midtermAt),
      finalAt: toDay(calendar.finalAt),
      today: dayInRecife.format(new Date()),
    };
  }
}

/** As datas do calendário são gravadas à meia-noite UTC: o dia é o da data UTC. */
function toDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}
