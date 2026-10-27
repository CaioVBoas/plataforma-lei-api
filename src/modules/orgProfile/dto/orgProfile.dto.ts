import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TipoParceiro } from '@prisma/client';

export class OrgContactDto {
  @ApiProperty({ example: 'Renata Vasconcelos' })
  focalName: string;

  @ApiProperty({ example: 'Coordenadora do núcleo de regulação' })
  focalRole: string;

  @ApiProperty({ example: 'renata.vasconcelos@exemplo.org.br' })
  email: string;

  @ApiProperty({ example: 'E-mail institucional' })
  channel: string;
}

export class OrgHistoryEntryDto {
  @ApiProperty()
  title: string;

  @ApiProperty()
  semester: string;

  @ApiProperty()
  disciplineName: string;

  @ApiProperty()
  teacherName: string;

  @ApiProperty()
  result: string;
}

export class OrganizationDto {
  @ApiProperty({ example: '1' })
  id: string;

  @ApiProperty({ example: 'Hospital das Clínicas' })
  name: string;

  @ApiProperty({ enum: TipoParceiro, enumName: 'TipoParceiro' })
  type: TipoParceiro;

  @ApiProperty({ example: 'Cidade Universitária, Recife' })
  location: string;

  @ApiProperty()
  about: string;

  @ApiProperty({ example: 'Pacientes do SUS encaminhados de todo o estado' })
  audience: string;

  @ApiProperty({ example: 'hc.ufpe.br' })
  site: string;

  @ApiProperty({ example: 'Reunião quinzenal de 1 hora, por vídeo' })
  meetingCadence: string;

  @ApiProperty({ example: 'Recebe a turma no hospital' })
  onSiteVisit: string;

  @ApiPropertyOptional({ description: 'Data URL; ausente quando não há logo' })
  logo?: string;

  @ApiPropertyOptional({ description: 'Data URL; ausente quando não há capa' })
  cover?: string;

  @ApiProperty({
    type: [OrgHistoryEntryDto],
    description: 'Ainda vazio: o histórico com o CIn vem de outra entrega',
  })
  history: OrgHistoryEntryDto[];
}

export class OrgProfileDto {
  @ApiProperty({ type: OrganizationDto })
  organization: OrganizationDto;

  @ApiProperty({ type: OrgContactDto })
  contact: OrgContactDto;
}
