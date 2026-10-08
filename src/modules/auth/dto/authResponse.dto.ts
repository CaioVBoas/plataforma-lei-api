import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '../../../common/enums/role.enum';

export class UserResponseDto {
  // String, e não número: o contrato externo trata o identificador como
  // opaco. A conversão para o inteiro do banco acontece no AuthService.
  @ApiProperty({ example: '1' })
  id: string;

  @ApiProperty({ example: 'maria.silva@ufpe.br' })
  email: string;

  @ApiProperty({ enum: Role, enumName: 'Role', example: Role.STUDENT })
  role: Role;

  // Vem do perfil (Professor, Student ou Partner), não de User.
  // Ausente quando o usuário não tem perfil.
  @ApiPropertyOptional({ example: 'Maria Silva' })
  name?: string;
}

export class AuthResponseDto {
  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;
}
