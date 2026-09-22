import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { BaseRegisterDto } from './base-register.dto';

export class RegisterStudentDto extends BaseRegisterDto {
  @ApiProperty({ example: 'Maria Silva' })
  @IsString()
  @IsNotEmpty({ message: 'O nome é obrigatório.' })
  name: string;

  @ApiProperty({ example: '2021000123' })
  @IsString()
  @IsNotEmpty({ message: 'A matrícula é obrigatória.' })
  registrationNumber: string;
}
