import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, ValidateNested } from 'class-validator';
import { DemandDraftDto } from './demandDraft.dto';

export class SaveDraftDto {
  @ApiProperty({ example: '1', required: false })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ type: DemandDraftDto })
  @ValidateNested()
  @Type(() => DemandDraftDto)
  draft: DemandDraftDto;
}
