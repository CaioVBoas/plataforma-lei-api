import { ApiProperty } from '@nestjs/swagger';

export class CodeSentDto {
  @ApiProperty({ example: 'maria.silva@cin.ufpe.br' })
  sentTo: string;

  @ApiProperty({
    example: '123456',
    description:
      'Código de verificação retornado para uso em ambiente sem SMTP',
  })
  demoCode: string;

  @ApiProperty({ example: 30 })
  resendIn: number;
}
