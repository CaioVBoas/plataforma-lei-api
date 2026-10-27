import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class UpdateTeamsDto {
  @ApiProperty({
    example: 3,
    description: 'Número de equipes alocadas na turma',
  })
  @IsInt()
  @Min(1)
  teams: number;
}
