import { ApiProperty } from '@nestjs/swagger';

/** Quem opera o portal da organização: o ponto focal cadastrado. */
export class OrgAccountDto {
  @ApiProperty({ example: '1' })
  organizationId: string;

  @ApiProperty({ example: 'Renata Vasconcelos' })
  name: string;

  @ApiProperty({ example: 'renata.vasconcelos@exemplo.org.br' })
  email: string;

  @ApiProperty({ example: 'Coordenadora do núcleo de regulação' })
  position: string;

  @ApiProperty({ example: '(81) 98765-4321' })
  phone: string;

  @ApiProperty({ example: false })
  tutorialSeen: boolean;
}
