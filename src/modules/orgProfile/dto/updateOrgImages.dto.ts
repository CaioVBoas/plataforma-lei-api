import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import {
  IMAGE_DATA_URL_MAX_LENGTH,
  IMAGE_DATA_URL_PATTERN,
} from '../../../common/validation/imageDataUrl';

/** Logo e capa mudam na hora, sem esperar o Salvar do formulário. */
export class UpdateOrgImagesDto {
  @ApiPropertyOptional({
    example: 'data:image/png;base64,iVBORw0KGgo...',
    description: 'Data URL da imagem; texto vazio remove o logo',
  })
  @IsOptional()
  @IsString()
  @Matches(IMAGE_DATA_URL_PATTERN, { message: 'Envie uma imagem.' })
  @MaxLength(IMAGE_DATA_URL_MAX_LENGTH, {
    message: 'A imagem é grande demais.',
  })
  logo?: string;

  @ApiPropertyOptional({
    example: 'data:image/jpeg;base64,/9j/4AAQ...',
    description: 'Data URL da imagem; texto vazio remove a capa',
  })
  @IsOptional()
  @IsString()
  @Matches(IMAGE_DATA_URL_PATTERN, { message: 'Envie uma imagem.' })
  @MaxLength(IMAGE_DATA_URL_MAX_LENGTH, {
    message: 'A imagem é grande demais.',
  })
  cover?: string;
}
