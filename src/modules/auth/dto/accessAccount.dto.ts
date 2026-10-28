import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'senhaAtual123' })
  @IsString()
  @IsNotEmpty({ message: 'Informe a senha atual.' })
  current: string;

  @ApiProperty({ example: 'senhaNova123' })
  @IsString()
  @IsNotEmpty({ message: 'Informe a senha nova.' })
  next: string;

  @ApiProperty({ example: 'senhaNova123' })
  @IsString()
  @IsNotEmpty({ message: 'Repita a senha nova.' })
  confirm: string;
}

export class DeleteAccountDto {
  @ApiProperty({ example: 'paola@cin.ufpe.br' })
  @IsString()
  @IsNotEmpty({
    message: 'Digite o e-mail da conta exatamente como aparece acima.',
  })
  typedEmail: string;
}
