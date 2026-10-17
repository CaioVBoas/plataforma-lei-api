import { Module } from '@nestjs/common';
import { OrgProfileController } from './orgProfile.controller';
import { OrgProfileService } from './orgProfile.service';

// Fica fora de `org-portal/` (projetos, PLEI-43) para os dois módulos
// evoluírem sem conflito; as rotas compartilham o prefixo `/org-portal`.
@Module({
  controllers: [OrgProfileController],
  providers: [OrgProfileService],
})
export class OrgProfileModule {}
