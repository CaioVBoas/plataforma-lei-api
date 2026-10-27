import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
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
import { JwtAuthGuard } from '../auth/guards/jwtAuth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdoptProjectDto } from './dto/adoptProject.dto';
import { CompleteMilestoneDto } from './dto/completeMilestone.dto';
import { UpdatePlanDto } from './dto/updatePlan.dto';
import { UpdateTeamsDto } from './dto/updateTeams.dto';
import { ProjectsService } from './projects.service';
import { MilestoneStep } from './projects.steps';

type AuthUser = { userId: string };

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PROFESSOR)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post('adopt')
  @ApiOperation({ summary: 'Adotar uma demanda reservada e gerar o projeto' })
  @ApiResponse({ status: 201, description: 'Projeto criado com as 6 etapas' })
  @ApiResponse({ status: 422, description: 'Regra de negócio violada' })
  adopt(@CurrentUser() user: AuthUser, @Body() dto: AdoptProjectDto) {
    return this.projectsService.adopt(user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar os projetos do docente' })
  findAll(@CurrentUser() user: AuthUser) {
    return this.projectsService.findAll(user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Workspace do projeto: etapas e seções do plano' })
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.projectsService.findOne(user.userId, id);
  }

  @Patch(':id/plan')
  @ApiOperation({ summary: 'Editar o texto do plano SIGAA' })
  @ApiResponse({ status: 422, description: 'Plano bloqueado após o SIGAA' })
  updatePlan(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePlanDto,
  ) {
    return this.projectsService.updatePlan(user.userId, id, dto);
  }

  @Patch(':id/teams')
  @ApiOperation({ summary: 'Ajustar as equipes alocadas na turma' })
  updateTeams(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTeamsDto,
  ) {
    return this.projectsService.updateTeams(user.userId, id, dto);
  }

  @Patch(':id/milestones/:step')
  @ApiOperation({ summary: 'Concluir uma etapa (sequencial)' })
  @ApiResponse({
    status: 422,
    description: 'Etapa fora de ordem ou dados faltando',
  })
  completeMilestone(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('step', new ParseEnumPipe(MilestoneStep)) step: MilestoneStep,
    @Body() dto: CompleteMilestoneDto,
  ) {
    return this.projectsService.completeMilestone(user.userId, id, step, dto);
  }

  @Delete(':id/withdraw')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Desistir do projeto (somente antes do SIGAA)' })
  @ApiResponse({
    status: 204,
    description: 'Projeto removido; demanda liberada',
  })
  @ApiResponse({
    status: 422,
    description: 'Desistência bloqueada após o SIGAA',
  })
  withdraw(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.projectsService.withdraw(user.userId, id);
  }
}
