import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateProjectDto {
  @ApiProperty({ example: 1, description: 'ID da demanda vinculada' })
  @IsInt()
  @IsNotEmpty({ message: 'O ID da demanda é obrigatório.' })
  demandId: number;

  @ApiProperty({ example: 1, description: 'ID da disciplina vinculada' })
  @IsInt()
  @IsNotEmpty({ message: 'O ID da disciplina é obrigatório.' })
  courseId: number;

  @ApiProperty({ example: 'Painel de Acompanhamento das Feiras' })
  @IsString()
  @IsNotEmpty({ message: 'O título do projeto é obrigatório.' })
  title: string;

  @ApiProperty({
    example: 2,
    default: 1,
    description: 'Número de equipes alocadas',
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  teams?: number;

  @ApiProperty({
    example: 'Protótipo navegável em React e documento de requisitos',
    required: false,
  })
  @IsString()
  @IsOptional()
  agreedDeliverable?: string;
}
