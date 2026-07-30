import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('projects')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZATION)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cadastrar projeto (Apenas ONGs)' })
  create(
    @Body() createProjectDto: CreateProjectDto,
    @CurrentUser() user: { userId: string },
  ) {
    return this.projectsService.create({
      ...createProjectDto,
      organizationId: user.userId,
    });
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos os projetos' })
  findAll() {
    return this.projectsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar projeto por ID' })
  findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }
}
