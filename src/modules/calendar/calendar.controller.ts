import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwtAuth.guard';
import { CalendarService } from './calendar.service';
import { SemesterCalendarDto } from './dto/semesterCalendar.dto';

// Sem @Roles: os portais do docente e da organização usam as mesmas datas.
@ApiTags('calendar')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@ApiResponse({
  status: 401,
  description: 'Token ausente, inválido ou expirado',
})
@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get('current')
  @ApiOperation({ summary: 'Semestre acadêmico ativo e seus prazos' })
  @ApiResponse({ status: 200, type: SemesterCalendarDto })
  @ApiResponse({ status: 404, description: 'Nenhum semestre ativo' })
  current(): Promise<SemesterCalendarDto> {
    return this.calendarService.current();
  }
}
