import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
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
import { JwtAuthGuard } from '../auth/guards/jwtAuth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  OrganizationDetailDto,
  OrganizationSummaryDto,
} from './dto/organization.dto';
import { OrganizationsService } from './organizations.service';

@ApiTags('organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PROFESSOR)
@ApiResponse({
  status: 401,
  description: 'Token ausente, inválido ou expirado',
})
@ApiResponse({ status: 403, description: 'Apenas docentes' })
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  @ApiOperation({ summary: 'Catálogo de organizações parceiras' })
  @ApiResponse({ status: 200, type: [OrganizationSummaryDto] })
  list(): Promise<OrganizationSummaryDto[]> {
    return this.organizationsService.list();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Perfil da organização e histórico com o CIn',
    description:
      '`contact` só aparece quando o docente tem projeto com a organização (Regra 6).',
  })
  @ApiResponse({ status: 200, type: OrganizationDetailDto })
  @ApiResponse({ status: 404, description: 'Organização não encontrada' })
  get(
    @CurrentUser() user: { userId: string },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<OrganizationDetailDto> {
    return this.organizationsService.get(user.userId, id);
  }
}
