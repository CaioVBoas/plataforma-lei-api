import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
} from 'class-validator';
import { COURSE_LEVELS } from '../../../common/mappers/courseLevel.mapper';
import type { CourseLevel } from '../../../common/mappers/courseLevel.mapper';

const trimText = (value: unknown): unknown =>
  typeof value === 'string' ? value.trim() : value;

/**
 * `semester` e `coTeachers` não entram: o semestre vem do calendário corrente
 * no servidor e os co-docentes têm endpoints próprios.
 */
export class CreateDisciplineDto {
  @ApiProperty({ example: 'Projeto de Extensão em Software' })
  @Transform(({ value }: { value: unknown }) => trimText(value))
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome da disciplina.' })
  name: string;

  @ApiProperty({ example: 'IF1234' })
  @Transform(({ value }: { value: unknown }) => trimText(value))
  @IsString()
  @IsNotEmpty({ message: 'Informe o código da disciplina.' })
  code: string;

  @ApiProperty({ enum: COURSE_LEVELS, example: 'intermediate' })
  @IsIn(COURSE_LEVELS, { message: 'Nível inválido.' })
  level: CourseLevel;

  @ApiProperty({ minimum: 1, example: 40 })
  @IsInt()
  @Min(1, { message: 'A turma precisa ter ao menos um estudante.' })
  students: number;

  @ApiProperty({
    minimum: 1,
    example: 5,
    description: 'Não pode exceder `students`.',
  })
  @IsInt()
  @Min(1, { message: 'O tamanho da equipe precisa ser de ao menos 1.' })
  teamSize: number;

  @ApiProperty({
    minimum: 1,
    example: 2,
    description: 'Projetos simultâneos que a turma comporta.',
  })
  @IsInt()
  @Min(1, { message: 'A disciplina precisa comportar ao menos um projeto.' })
  projectSlots: number;

  @ApiProperty({
    type: [String],
    minItems: 1,
    example: ['React', 'Design de interfaces'],
    description:
      'Obrigatório: alimenta a compatibilidade com as demandas. Nomes fora do catálogo são criados.',
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Informe ao menos uma competência.' })
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value) ? value.map((item) => trimText(item)) : value,
  )
  @IsString({ each: true })
  @IsNotEmpty({ each: true, message: 'Competência não pode ser vazia.' })
  skills: string[];
}
