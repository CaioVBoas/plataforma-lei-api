import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/createProject.dto';
import { JwtAuthGuard } from '../auth/guards/jwtAuth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('projects')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROFESSOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cadastrar/Adotar projeto (Docentes)' })
  create(@Body() createProjectDto: CreateProjectDto) {
    return this.projectsService.create(createProjectDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos os projetos' })
  findAll() {
    return this.projectsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar projeto por ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.projectsService.findOne(id);
  }
}
