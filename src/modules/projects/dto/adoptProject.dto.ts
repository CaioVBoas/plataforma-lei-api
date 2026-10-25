import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';

export class AdoptProjectDto {
  @ApiProperty({
    example: 1,
    description: 'ID da demanda reservada pelo docente',
  })
  @IsInt()
  demandId: number;

  @ApiProperty({
    example: 1,
    description: 'ID da disciplina que adotará a demanda',
  })
  @IsInt()
  courseId: number;

  @ApiProperty({
    example: 2,
    default: 1,
    required: false,
    description: 'Número de equipes alocadas',
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  teams?: number;
}
