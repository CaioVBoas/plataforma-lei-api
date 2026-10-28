import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AskQuestionDto {
  @ApiProperty({
    example:
      'A escala dos médicos pode ser disponibilizada na primeira semana?',
  })
  @IsString()
  @IsNotEmpty({ message: 'Escreva a pergunta.' })
  @MaxLength(500, {
    message: 'A pergunta passa de 500 caracteres. Tente ser mais direto.',
  })
  text: string;
}
