import { ApiProperty } from '@nestjs/swagger';

/** Datas em `YYYY-MM-DD`: o front trata todas como dia, sem horário. */
export class SemesterCalendarDto {
  @ApiProperty({ example: '2026.2', description: 'Semestre letivo' })
  id: string;

  @ApiProperty({ example: '2026-08-03' })
  startsAt: string;

  @ApiProperty({
    example: '2026-12-04',
    description: 'Também é o encerramento',
  })
  endsAt: string;

  @ApiProperty({
    example: '2026-09-12',
    description: 'Depois desta data nenhuma demanda nova entra no semestre',
  })
  linkDeadline: string;

  @ApiProperty({ example: '2026-10-09', description: 'Entrega intermediária' })
  midtermAt: string;

  @ApiProperty({ example: '2026-11-27', description: 'Entrega final' })
  finalAt: string;

  @ApiProperty({
    example: '2026-08-24',
    description: 'Data de referência do servidor (America/Recife)',
  })
  today: string;
}
