import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/currentUser.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import {
  ChangePasswordDto,
  DeleteAccountDto,
} from '../auth/dto/accessAccount.dto';
import { JwtAuthGuard } from '../auth/guards/jwtAuth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AccountService } from './account.service';
import { AccountDto } from './dto/account.dto';
import { UpdateAccountDto } from './dto/updateAccount.dto';

@ApiTags('account')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PROFESSOR)
@ApiResponse({
  status: 401,
  description: 'Token ausente, inválido ou expirado',
})
@ApiResponse({ status: 403, description: 'Apenas docentes' })
@Controller('account')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Get('me')
  @ApiOperation({ summary: 'Dados cadastrais do docente autenticado' })
  @ApiResponse({ status: 200, type: AccountDto })
  get(@CurrentUser() user: { userId: string }): Promise<AccountDto> {
    return this.accountService.get(user.userId);
  }

  @Patch('me')
  @ApiOperation({
    summary: 'Atualizar dados cadastrais do docente',
    description:
      'Atualização parcial. `photo` vazio remove a foto. O e-mail não muda por aqui.',
  })
  @ApiResponse({ status: 200, type: AccountDto })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  update(
    @CurrentUser() user: { userId: string },
    @Body() dto: UpdateAccountDto,
  ): Promise<AccountDto> {
    return this.accountService.update(user.userId, dto);
  }

  @Post('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Trocar senha do docente autenticado' })
  @ApiResponse({ status: 204, description: 'Senha atualizada' })
  changePassword(
    @CurrentUser() user: { userId: string },
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    return this.accountService.changePassword(user.userId, dto);
  }

  @Post('me/delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Excluir conta do docente autenticado' })
  @ApiResponse({ status: 204, description: 'Conta excluída' })
  deleteAccount(
    @CurrentUser() user: { userId: string },
    @Body() dto: DeleteAccountDto,
  ): Promise<void> {
    return this.accountService.deleteAccount(user.userId, dto);
  }
}
