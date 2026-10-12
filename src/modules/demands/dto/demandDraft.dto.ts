import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { ReferenceDto } from './reference.dto';

export class DemandDraftDto {
  @ApiProperty({ example: 'Triagem de encaminhamentos' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'Atraso na triagem de exames' })
  @IsString()
  problem: string;

  @ApiProperty({ example: 'Contexto detalhado...' })
  @IsString()
  description: string;

  @ApiProperty({ example: 'Pacientes do SUS' })
  @IsString()
  affectedPublic: string;

  @ApiProperty({ example: 'Painel funcional web' })
  @IsString()
  expectedOutcome: string;

  @ApiProperty({ example: ['React', 'Node.js'], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  skills?: string[];

  @ApiProperty({ example: ['on-site', 'sensitive-data'], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  constraints?: string[];

  @ApiProperty({ example: 'Quinzenal, quartas-feiras', required: false })
  @IsString()
  @IsOptional()
  meetingCadence?: string;

  @ApiProperty({ example: ['Acesso ao processo de trabalho'], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  offers?: string[];

  @ApiProperty({ type: [ReferenceDto], required: false })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReferenceDto)
  @IsOptional()
  references?: ReferenceDto[];
}
