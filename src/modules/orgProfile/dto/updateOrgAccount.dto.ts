import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/** O e-mail fica de fora: é a identidade de login e não muda por aqui. */
export class UpdateOrgAccountDto {
  @ApiPropertyOptional({ example: 'Renata Vasconcelos' })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Informe seu nome.' })
  name?: string;

  @ApiPropertyOptional({ example: 'Coordenadora do núcleo de regulação' })
  @IsOptional()
  @IsString()
  position?: string;

  @ApiPropertyOptional({ example: '(81) 98765-4321' })
  @IsOptional()
  @IsString()
  @MaxLength(30, { message: 'O telefone está longo demais.' })
  phone?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  tutorialSeen?: boolean;
}
