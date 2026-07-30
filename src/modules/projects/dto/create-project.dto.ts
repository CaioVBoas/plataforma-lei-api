import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateProjectDto {
  @ApiProperty({ example: 'Plataforma Web para ONG Verde' })
  @IsString()
  @IsNotEmpty({ message: 'O título do projeto é obrigatório.' })
  title: string;

  @ApiProperty({
    example: 'Desenvolvimento de uma aplicação para gestão de resíduos',
  })
  @IsString()
  @IsNotEmpty({ message: 'A descrição é obrigatória.' })
  description: string;

  @ApiProperty({ example: 'Meio Ambiente' })
  @IsString()
  @IsNotEmpty({ message: 'A área é obrigatória.' })
  area: string;

  @ApiProperty({ example: ['React', 'TypeScript', 'Node.js'] })
  @IsArray()
  @IsString({ each: true })
  requiredSkills: string[];

  @ApiProperty({ example: 3, default: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  vacancies?: number;

  @ApiProperty({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  @IsUUID('4')
  @IsNotEmpty()
  organizationId: string;
}
