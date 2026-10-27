import { ApiProperty } from '@nestjs/swagger';
import { TipoParceiro } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { BaseRegisterDto } from './baseRegister.dto';

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

  @ApiProperty({ example: 'Boa Viagem, Recife' })
  @IsString()
  @IsNotEmpty({ message: 'Informe onde a organização fica.' })
  location: string;

  // Quem se cadastra é o ponto focal: o representante da conta e o contato
  // da organização são a mesma pessoa até alguém trocar no perfil.
  @ApiProperty({ example: 'Ana Souza', description: 'Nome do ponto focal' })
  @IsString()
  @IsNotEmpty({ message: 'Informe seu nome.' })
  focalName: string;

  @ApiProperty({ example: 'Coordenadora de projetos', description: 'Cargo' })
  @IsString()
  @IsNotEmpty({ message: 'Informe seu cargo.' })
  focalRole: string;
}
