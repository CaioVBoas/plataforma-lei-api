import { Module } from '@nestjs/common';
import { DisciplinesController } from './disciplines.controller';
import { DisciplinesService } from './disciplines.service';

@Module({
  controllers: [DisciplinesController],
  providers: [DisciplinesService],
})
export class DisciplinesModule {}
