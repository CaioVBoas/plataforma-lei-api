import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/currentUser.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtAuthGuard } from '../auth/guards/jwtAuth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OrgAccountDto } from './dto/orgAccount.dto';
import { OrgProfileDto } from './dto/orgProfile.dto';
import { UpdateOrgAccountDto } from './dto/updateOrgAccount.dto';
import { UpdateOrgImagesDto } from './dto/updateOrgImages.dto';
import { UpdateOrgProfileDto } from './dto/updateOrgProfile.dto';
import { OrgProfileService } from './orgProfile.service';

@ApiTags('org-portal')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ORGANIZATION)
@ApiResponse({
  status: 401,
  description: 'Token ausente, inválido ou expirado',
})
@ApiResponse({ status: 403, description: 'Apenas organizações parceiras' })
@ApiResponse({ status: 404, description: 'Perfil de organização ausente' })
@Controller('org-portal')
export class OrgProfileController {
  constructor(private readonly orgProfileService: OrgProfileService) {}

  @Get('account')
  @ApiOperation({ summary: 'Dados do representante da organização' })
  @ApiResponse({ status: 200, type: OrgAccountDto })
  getAccount(@CurrentUser() user: { userId: string }): Promise<OrgAccountDto> {
    return this.orgProfileService.getAccount(user.userId);
  }

  @Patch('account')
  @ApiOperation({
    summary: 'Atualizar dados do representante',
    description: 'Atualização parcial. O e-mail não muda por aqui.',
  })
  @ApiResponse({ status: 200, type: OrgAccountDto })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  updateAccount(
    @CurrentUser() user: { userId: string },
    @Body() dto: UpdateOrgAccountDto,
  ): Promise<OrgAccountDto> {
    return this.orgProfileService.updateAccount(user.userId, dto);
  }

  @Get('profile')
  @ApiOperation({ summary: 'Dados institucionais da organização' })
  @ApiResponse({ status: 200, type: OrgProfileDto })
  getProfile(@CurrentUser() user: { userId: string }): Promise<OrgProfileDto> {
    return this.orgProfileService.getProfile(user.userId);
  }

  @Patch('profile')
  @ApiOperation({
    summary: 'Atualizar dados institucionais e o ponto focal',
    description: 'O nome da organização não muda por aqui.',
  })
  @ApiResponse({ status: 200, type: OrgProfileDto })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  updateProfile(
    @CurrentUser() user: { userId: string },
    @Body() dto: UpdateOrgProfileDto,
  ): Promise<OrgProfileDto> {
    return this.orgProfileService.updateProfile(user.userId, dto);
  }

  @Patch('profile/images')
  @ApiOperation({
    summary: 'Trocar ou remover logo e capa',
    description: 'Data URL da imagem; texto vazio remove.',
  })
  @ApiResponse({ status: 200, type: OrgProfileDto })
  @ApiResponse({ status: 400, description: 'Não é uma imagem' })
  updateImages(
    @CurrentUser() user: { userId: string },
    @Body() dto: UpdateOrgImagesDto,
  ): Promise<OrgProfileDto> {
    return this.orgProfileService.updateImages(user.userId, dto);
  }
}
