import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ReferenceDto {
  @ApiProperty({ example: 'Sistema de Agendamento' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'https://exemplo.org.br' })
  @IsString()
  url: string;

  @ApiProperty({ example: 'Referência inspiradora', required: false })
  @IsString()
  @IsOptional()
  description?: string;
}
