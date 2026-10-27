import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OrganizationHistoryEntryDto {
  @ApiProperty({ description: 'Título do projeto.' })
  title: string;

  @ApiProperty({ example: '2026.1' })
  semester: string;

  @ApiProperty()
  disciplineName: string;

  @ApiProperty({ description: 'Docente principal da disciplina.' })
  teacherName: string;

  @ApiProperty({
    description: 'Texto de encerramento do projeto (vazio se não houver).',
  })
  result: string;
}

// Campos opcionais no banco são obrigatórios no contrato: saem como "" e
// nunca são omitidos. Só `logo` e `cover` seguem opcionais, como no frontend.
export class OrganizationDto {
  @ApiProperty({ example: '1' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({
    example: 'Órgão público',
    description: 'Rótulo legível do tipo.',
  })
  type: string;

  @ApiPropertyOptional({ description: 'Data URL.' })
  logo?: string;

  @ApiPropertyOptional({ description: 'Data URL.' })
  cover?: string;

  @ApiProperty()
  location: string;

  @ApiProperty()
  about: string;

  @ApiProperty()
  audience: string;

  @ApiProperty()
  site: string;

  @ApiProperty()
  meetingCadence: string;

  @ApiProperty()
  onSiteVisit: string;

  @ApiProperty({ type: [OrganizationHistoryEntryDto] })
  history: OrganizationHistoryEntryDto[];
}

export class OrganizationSummaryDto extends OrganizationDto {
  @ApiProperty({
    description:
      'Demandas publicadas no cardápio que ainda não viraram projeto.',
  })
  openDemands: number;
}

/** Só para quem já tem projeto com a organização (Regra 6, LGPD). */
export class OrganizationContactDto {
  @ApiProperty()
  focalName: string;

  @ApiProperty()
  focalRole: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  channel: string;
}

export class OrganizationDemandRefDto {
  @ApiProperty({ example: '1' })
  id: string;

  @ApiProperty()
  title: string;
}

export class OrganizationProjectRefDto {
  @ApiProperty({ example: '1' })
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ example: '2026.2' })
  semester: string;

  @ApiProperty()
  disciplineName: string;
}

export class OrganizationDetailDto {
  @ApiProperty({ type: OrganizationDto })
  organization: OrganizationDto;

  @ApiPropertyOptional({
    type: OrganizationContactDto,
    description: 'Presente somente se o docente tem projeto com a organização.',
  })
  contact?: OrganizationContactDto;

  @ApiProperty({
    type: [OrganizationDemandRefDto],
    description:
      'Versão enxuta; a forma completa vem com o módulo de demandas.',
  })
  openDemands: OrganizationDemandRefDto[];

  @ApiProperty({
    type: [OrganizationProjectRefDto],
    description: 'Projetos do docente com esta organização.',
  })
  myProjects: OrganizationProjectRefDto[];
}
