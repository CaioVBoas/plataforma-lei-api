import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AnswerQuestionDto {
  @ApiProperty({
    example: 'Podemos realizar as reuniões por videoconferência.',
  })
  @IsString()
  @IsNotEmpty({ message: 'Escreva a resposta.' })
  @MaxLength(1000, {
    message: 'A resposta passa de 1000 caracteres. Divida em duas mensagens.',
  })
  text: string;
}
