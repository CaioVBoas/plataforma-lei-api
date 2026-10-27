import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/currentUser.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtAuthGuard } from '../auth/guards/jwtAuth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OrgPortalService } from './orgPortal.service';

@ApiTags('org-portal')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ORGANIZATION)
@Controller('org-portal/projects')
export class OrgPortalController {
  constructor(private readonly orgPortalService: OrgPortalService) {}

  @Get()
  @ApiOperation({ summary: 'Projetos das demandas da organização' })
  findAll(@CurrentUser() user: { userId: string }) {
    return this.orgPortalService.findAll(user.userId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Acompanhamento do projeto (sem anotações internas do docente)',
  })
  findOne(
    @CurrentUser() user: { userId: string },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.orgPortalService.findOne(user.userId, id);
  }
}
