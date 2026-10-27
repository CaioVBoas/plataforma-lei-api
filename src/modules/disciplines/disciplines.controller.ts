import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import { DisciplinesService } from './disciplines.service';
import { CreateDisciplineDto } from './dto/createDiscipline.dto';
import { DisciplineDto } from './dto/discipline.dto';
import { InviteCoTeacherDto } from './dto/inviteCoTeacher.dto';
import { UpdateDisciplineDto } from './dto/updateDiscipline.dto';

interface AuthUser {
  userId: string;
}

@ApiTags('disciplines')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PROFESSOR)
@ApiResponse({
  status: 401,
  description: 'Token ausente, inválido ou expirado',
})
@ApiResponse({ status: 403, description: 'Apenas docentes' })
@Controller('disciplines')
export class DisciplinesController {
  constructor(private readonly disciplinesService: DisciplinesService) {}

  @Get()
  @ApiOperation({ summary: 'Disciplinas do docente (principal ou co-docente)' })
  @ApiResponse({ status: 200, type: [DisciplineDto] })
  list(@CurrentUser() user: AuthUser): Promise<DisciplineDto[]> {
    return this.disciplinesService.list(user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe da disciplina' })
  @ApiResponse({ status: 200, type: DisciplineDto })
  @ApiResponse({
    status: 404,
    description: 'Disciplina não encontrada ou sem acesso',
  })
  get(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DisciplineDto> {
    return this.disciplinesService.get(user.userId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Cadastrar turma no semestre atual' })
  @ApiResponse({ status: 201, type: DisciplineDto })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  @ApiResponse({
    status: 409,
    description: 'Código já usado no semestre, ou sem semestre corrente',
  })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateDisciplineDto,
  ): Promise<DisciplineDto> {
    return this.disciplinesService.create(user.userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar turma (campos parciais)' })
  @ApiResponse({ status: 200, type: DisciplineDto })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  @ApiResponse({
    status: 404,
    description: 'Disciplina não encontrada ou sem acesso',
  })
  @ApiResponse({
    status: 409,
    description: 'Vagas abaixo dos projetos em curso, ou código duplicado',
  })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDisciplineDto,
  ): Promise<DisciplineDto> {
    return this.disciplinesService.update(user.userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Excluir disciplina sem projetos' })
  @ApiResponse({ status: 204, description: 'Excluída' })
  @ApiResponse({
    status: 404,
    description: 'Disciplina não encontrada ou sem acesso',
  })
  @ApiResponse({ status: 409, description: 'Disciplina tem projetos' })
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    return this.disciplinesService.remove(user.userId, id);
  }

  @Post(':id/co-teachers')
  @ApiOperation({ summary: 'Convidar colega por e-mail institucional' })
  @ApiResponse({ status: 201, type: DisciplineDto })
  @ApiResponse({
    status: 400,
    description: 'E-mail fora de @ufpe.br / @cin.ufpe.br',
  })
  @ApiResponse({
    status: 404,
    description: 'Disciplina ou docente não encontrado',
  })
  @ApiResponse({
    status: 409,
    description: 'Semestre passado, próprio docente ou colega já vinculado',
  })
  invite(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: InviteCoTeacherDto,
  ): Promise<DisciplineDto> {
    return this.disciplinesService.inviteCoTeacher(user.userId, id, dto.email);
  }

  @Delete(':id/co-teachers/:email')
  @ApiOperation({ summary: 'Remover colega da disciplina' })
  @ApiResponse({ status: 200, type: DisciplineDto })
  @ApiResponse({
    status: 404,
    description: 'Disciplina não encontrada ou colega não vinculado',
  })
  removeCoTeacher(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('email') email: string,
  ): Promise<DisciplineDto> {
    return this.disciplinesService.removeCoTeacher(user.userId, id, email);
  }
}
