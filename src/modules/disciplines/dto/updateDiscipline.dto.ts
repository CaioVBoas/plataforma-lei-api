import { PartialType } from '@nestjs/swagger';
import { CreateDisciplineDto } from './createDiscipline.dto';

export class UpdateDisciplineDto extends PartialType(CreateDisciplineDto) {}
