import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/currentUser.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtAuthGuard } from '../auth/guards/jwtAuth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DemandsService } from './demands.service';
import { AskQuestionDto } from './dto/askQuestion.dto';
import { DemandDetailDto, DemandDto } from './types';

@ApiTags('demands')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PROFESSOR)
@Controller('demands')
export class DemandsController {
  constructor(private readonly demandsService: DemandsService) {}

  @Get('menu')
  @ApiOperation({ summary: 'Listar demandas publicadas no cardápio' })
  async getMenu(@CurrentUser() user: { userId: string }): Promise<DemandDto[]> {
    return this.demandsService.getMenu(user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter detalhes de uma demanda do cardápio' })
  async getDemand(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { userId: string },
  ): Promise<DemandDetailDto> {
    return this.demandsService.getDemand(id, user.userId);
  }

  @Post(':id/reserve')
  @ApiOperation({ summary: 'Reservar demanda no cardápio' })
  async reserve(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { userId: string },
  ): Promise<DemandDto> {
    return this.demandsService.reserveDemand(id, user.userId);
  }

  @Post(':id/release')
  @ApiOperation({ summary: 'Liberar reserva de uma demanda' })
  async release(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { userId: string },
  ): Promise<DemandDto> {
    return this.demandsService.releaseReservation(id, user.userId);
  }

  @Post(':id/watch')
  @ApiOperation({
    summary: 'Alternar aviso de liberação (avise-me se liberar)',
  })
  async watch(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { userId: string },
  ): Promise<DemandDto> {
    return this.demandsService.toggleWatch(id, user.userId);
  }

  @Post(':id/questions')
  @ApiOperation({ summary: 'Enviar dúvida sobre a demanda à organização' })
  async askQuestion(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { userId: string },
    @Body() dto: AskQuestionDto,
  ): Promise<DemandDto> {
    return this.demandsService.askQuestion(id, user.userId, dto.text);
  }
}
