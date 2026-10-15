import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class InviteCoTeacherDto {
  // O formato é validado no service, para a mensagem de domínio ficar junto
  // das demais regras do convite.
  @ApiProperty({ example: 'colega@cin.ufpe.br' })
  @IsString()
  email: string;
}
