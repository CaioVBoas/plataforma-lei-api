import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Matches } from 'class-validator';
import { BaseRegisterDto } from './baseRegister.dto';

/** Docente só entra com e-mail institucional da UFPE ou do CIn. */
export const UFPE_EMAIL_PATTERN = /@(cin\.)?ufpe\.br$/i;

export class RegisterProfessorDto extends BaseRegisterDto {
  @ApiProperty({
    example: 'maria.silva@cin.ufpe.br',
    description: 'E-mail institucional: @ufpe.br ou @cin.ufpe.br',
  })
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @IsNotEmpty({ message: 'O e-mail é obrigatório.' })
  @Matches(UFPE_EMAIL_PATTERN, {
    message: 'Use seu e-mail @ufpe.br ou @cin.ufpe.br.',
  })
  // Redeclarar a propriedade substitui as regras herdadas da base no
  // class-validator, por isso elas se repetem aqui junto da regra de domínio.
  // O inicializador é exigido pelo TS (TS2612) e é sobrescrito pelo corpo.
  email: string = '';

  @ApiProperty({ example: 'João Pereira' })
  @IsString()
  @IsNotEmpty({ message: 'O nome é obrigatório.' })
  name: string;

  @ApiProperty({ example: 'Centro de Informática' })
  @IsString()
  @IsNotEmpty({ message: 'Informe o departamento.' })
  department: string;
}
