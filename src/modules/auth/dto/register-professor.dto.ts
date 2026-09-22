import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { BaseRegisterDto } from './base-register.dto';

export class RegisterProfessorDto extends BaseRegisterDto {
  @ApiProperty({ example: 'João Pereira' })
  @IsString()
  @IsNotEmpty({ message: 'O nome é obrigatório.' })
  name: string;
}
