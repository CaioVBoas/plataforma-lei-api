import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsNotEmpty, IsString } from 'class-validator';

export type AccessRoleParam = 'docente' | 'organizacao';

export class RequestPasswordResetDto {
  @ApiProperty({ enum: ['docente', 'organizacao'], example: 'docente' })
  @IsIn(['docente', 'organizacao'], { message: 'Perfil inválido.' })
  role: AccessRoleParam;

  @ApiProperty({ example: 'paola@cin.ufpe.br' })
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @IsNotEmpty({ message: 'Escreva o e-mail da sua conta.' })
  email: string;
}

export class ResetPasswordDto extends RequestPasswordResetDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty({ message: 'Digite os 6 números do código.' })
  code: string;

  @ApiProperty({ example: 'novaSenha123' })
  @IsString()
  @IsNotEmpty({ message: 'Informe a senha nova.' })
  password: string;

  @ApiProperty({ example: 'novaSenha123' })
  @IsString()
  @IsNotEmpty({ message: 'Repita a senha nova.' })
  confirm: string;
}
