import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private static pool: Pool;
  private static adapter: PrismaPg;

  constructor() {
    if (!PrismaService.pool) {
      PrismaService.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
      });
      PrismaService.adapter = new PrismaPg(PrismaService.pool);
    }

    super({
      adapter: PrismaService.adapter,
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    if (PrismaService.pool) {
      await PrismaService.pool.end();
    }
  }
}
