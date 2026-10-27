import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwtAuth.guard';
import { SkillsService } from './skills.service';

@ApiTags('skills')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('skills')
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  @Get('catalog')
  @ApiOperation({ summary: 'Catálogo de competências para autocomplete' })
  @ApiResponse({ status: 200, type: [String] })
  @ApiResponse({ status: 401, description: 'Token ausente ou inválido' })
  catalog(): Promise<string[]> {
    return this.skillsService.catalog();
  }
}
