import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwtAuth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/currentUser.decorator';
import { OrgDemandsService } from './orgDemands.service';
import { SaveDraftDto } from './dto/saveDraft.dto';
import { AnswerQuestionDto } from './dto/answerQuestion.dto';

@ApiTags('org-portal-demands')
@Controller('org-portal/demands')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ORGANIZATION)
@ApiBearerAuth()
export class OrgDemandsController {
  constructor(private readonly orgDemandsService: OrgDemandsService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar resumo das demandas da organização parceira',
  })
  async getDemands(@CurrentUser() user: { userId: string }) {
    return this.orgDemandsService.listDemands(user.userId);
  }

  @Get('questions')
  @ApiOperation({
    summary: 'Listar demandas com perguntas da organização parceira',
  })
  async getQuestions(@CurrentUser() user: { userId: string }) {
    return this.orgDemandsService.listQuestionDemands(user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter detalhe da demanda da organização parceira' })
  async getDemand(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
  ) {
    return this.orgDemandsService.getDemand(user.userId, id);
  }

  @Post('draft')
  @ApiOperation({ summary: 'Criar ou atualizar rascunho de demanda' })
  async saveDraft(
    @CurrentUser() user: { userId: string },
    @Body() dto: SaveDraftDto,
  ) {
    return this.orgDemandsService.saveDraft(user.userId, dto);
  }

  @Post('submit')
  @ApiOperation({ summary: 'Enviar demanda para triagem' })
  async submitForReview(
    @CurrentUser() user: { userId: string },
    @Body() dto: SaveDraftDto,
  ) {
    return this.orgDemandsService.submitForReview(user.userId, dto);
  }

  @Delete('draft/:id')
  @ApiOperation({ summary: 'Excluir rascunho de demanda' })
  async deleteDraft(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
  ) {
    return this.orgDemandsService.deleteDraft(user.userId, id);
  }

  @Post(':demandId/questions/:questionId/answer')
  @ApiOperation({ summary: 'Responder pergunta de um docente' })
  async answerQuestion(
    @CurrentUser() user: { userId: string },
    @Param('demandId') demandId: string,
    @Param('questionId') questionId: string,
    @Body() dto: AnswerQuestionDto,
  ) {
    return this.orgDemandsService.answerQuestion(
      user.userId,
      demandId,
      questionId,
      dto.text,
    );
  }
}
