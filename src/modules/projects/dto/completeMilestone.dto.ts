import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Adoption } from '../projects.steps';

export class ProjectOutcomeDto {
  @ApiProperty({ example: 'Painel entregue e em uso pela equipe de campo.' })
  @IsString()
  @IsNotEmpty()
  summary: string;

  @ApiProperty({ enum: Adoption })
  @IsEnum(Adoption)
  adoption: Adoption;
}

export class CompleteMilestoneDto {
  @ApiProperty({
    required: false,
    description: 'Código do projeto no SIGAA (obrigatório na etapa `sigaa`)',
  })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  sigaaCode?: string;

  @ApiProperty({
    required: false,
    type: ProjectOutcomeDto,
    description: 'Resumo e adoção da solução (obrigatório na etapa `closing`)',
  })
  @ValidateNested()
  @Type(() => ProjectOutcomeDto)
  @IsOptional()
  outcome?: ProjectOutcomeDto;

  @ApiProperty({
    required: false,
    description:
      'Anotação pedagógica interna do docente (não aparece à organização)',
  })
  @IsString()
  @IsOptional()
  note?: string;
}
