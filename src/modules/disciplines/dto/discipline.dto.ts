import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { COURSE_LEVELS } from '../../../common/mappers/courseLevel.mapper';
import type { CourseLevel } from '../../../common/mappers/courseLevel.mapper';

export class CoTeacherDto {
  @ApiProperty({ example: 'colega@cin.ufpe.br' })
  email: string;

  @ApiPropertyOptional({ example: 'Fulano de Tal' })
  name?: string;
}

export class DisciplineDto {
  @ApiProperty({ example: '1' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ example: 'IF1234' })
  code: string;

  @ApiProperty({ example: '2026.2' })
  semester: string;

  @ApiProperty({ enum: COURSE_LEVELS })
  level: CourseLevel;

  @ApiProperty()
  students: number;

  @ApiProperty()
  teamSize: number;

  @ApiProperty()
  projectSlots: number;

  @ApiProperty({ type: [String], description: 'Nomes das competências.' })
  skills: string[];

  @ApiProperty({ type: [CoTeacherDto] })
  coTeachers: CoTeacherDto[];

  @ApiProperty({
    description: 'Projetos que ainda ocupam vaga (sem encerramento concluído).',
  })
  activeProjects: number;

  @ApiProperty({ description: 'A disciplina é do semestre letivo corrente.' })
  isCurrent: boolean;
}
