import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  IMAGE_DATA_URL_MAX_LENGTH,
  IMAGE_DATA_URL_PATTERN,
} from '../../../common/validation/imageDataUrl';

/** O e-mail fica de fora: é a identidade de login e não muda por aqui. */
export class UpdateAccountDto {
  @ApiPropertyOptional({ example: 'Paola Accioly' })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Informe seu nome.' })
  name?: string;

  @ApiPropertyOptional({ example: 'Centro de Informática' })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Informe o departamento.' })
  department?: string;

  @ApiPropertyOptional({ example: '(81) 99876-1234' })
  @IsOptional()
  @IsString()
  @MaxLength(30, { message: 'O telefone está longo demais.' })
  phone?: string;

  @ApiPropertyOptional({
    example: 'data:image/jpeg;base64,/9j/4AAQ...',
    description: 'Data URL da imagem; texto vazio remove a foto',
  })
  @IsOptional()
  @IsString()
  @Matches(IMAGE_DATA_URL_PATTERN, {
    message: 'A foto precisa ser uma imagem.',
  })
  @MaxLength(IMAGE_DATA_URL_MAX_LENGTH, { message: 'A foto é grande demais.' })
  photo?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  tutorialSeen?: boolean;
}
