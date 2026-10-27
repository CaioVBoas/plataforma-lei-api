import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TipoParceiro } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class UpdateOrgContactDto {
  @ApiProperty({ example: 'Renata Vasconcelos' })
  @IsString()
  @IsNotEmpty({ message: 'Informe quem é o ponto focal.' })
  focalName: string;

  @ApiPropertyOptional({ example: 'Coordenadora do núcleo de regulação' })
  @IsOptional()
  @IsString()
  focalRole?: string;

  @ApiProperty({ example: 'renata.vasconcelos@exemplo.org.br' })
  @IsEmail({}, { message: 'Informe um e-mail válido para o ponto focal.' })
  email: string;

  @ApiPropertyOptional({ example: 'E-mail institucional' })
  @IsOptional()
  @IsString()
  channel?: string;
}

/** O nome da organização não muda por aqui: a troca passa pelo L.E.I. */
export class UpdateOrgProfileDto {
  @ApiPropertyOptional({ enum: TipoParceiro, enumName: 'TipoParceiro' })
  @IsOptional()
  @IsEnum(TipoParceiro, { message: 'Tipo de parceiro inválido.' })
  type?: TipoParceiro;

  @ApiPropertyOptional({ example: 'Cidade Universitária, Recife' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  about?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  audience?: string;

  @ApiPropertyOptional({ example: 'hc.ufpe.br' })
  @IsOptional()
  @IsString()
  site?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  meetingCadence?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  onSiteVisit?: string;

  @ApiPropertyOptional({ type: UpdateOrgContactDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateOrgContactDto)
  contact?: UpdateOrgContactDto;
}
