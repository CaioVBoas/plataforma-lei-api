import { ApiProperty } from '@nestjs/swagger';
import { TipoParceiro } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { BaseRegisterDto } from './base-register.dto';

export class RegisterPartnerDto extends BaseRegisterDto {
  @ApiProperty({ example: 'ONG Verde Recife' })
  @IsString()
  @IsNotEmpty({ message: 'O nome é obrigatório.' })
  name: string;

  // `type` não é traduzido: o frontend não modela este enum, então ele
  // trafega exatamente como está no banco e fica documentado no Swagger.
  @ApiProperty({
    enum: TipoParceiro,
    enumName: 'TipoParceiro',
    example: TipoParceiro.ORGANIZACAO_SOCIAL_ONG,
  })
  @IsEnum(TipoParceiro, { message: 'Tipo de parceiro inválido.' })
  type: TipoParceiro;
}
