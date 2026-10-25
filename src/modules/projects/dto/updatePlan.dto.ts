import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class PlanSectionTextDto {
  @ApiProperty({ example: 1, description: 'Posição da seção no plano' })
  @IsInt()
  @Min(1)
  order: number;

  @ApiProperty({ example: 'Texto da seção' })
  @IsString()
  text: string;
}

export class UpdatePlanDto {
  @ApiProperty({ type: [PlanSectionTextDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PlanSectionTextDto)
  sections: PlanSectionTextDto[];
}
