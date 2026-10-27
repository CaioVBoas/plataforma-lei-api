import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AccountDto {
  @ApiProperty({ example: 'Paola Accioly' })
  name: string;

  @ApiProperty({ example: 'paola.accioly@ufpe.br' })
  email: string;

  @ApiProperty({ example: 'Centro de Informática' })
  department: string;

  @ApiProperty({
    example: '(81) 99876-1234',
    description: 'Vazio quando não informado',
  })
  phone: string;

  @ApiPropertyOptional({
    example: 'data:image/jpeg;base64,/9j/4AAQ...',
    description: 'Ausente quando o docente não tem foto',
  })
  photo?: string;

  @ApiProperty({ example: false })
  tutorialSeen: boolean;
}
