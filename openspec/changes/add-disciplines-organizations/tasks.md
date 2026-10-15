# Tasks

## 1. Mappers
- [x] 1.1 `courseLevel.mapper.ts` (`NivelCurso` ↔ `intro|intermediate|advanced`) + spec
- [x] 1.2 `partnerType.mapper.ts` (`TipoParceiro` → rótulo) + spec

## 2. Skills
- [x] 2.1 `SkillsModule`, `SkillsService.catalog()`, `GET /skills/catalog`
- [x] 2.2 Teste do service

## 3. Disciplines
- [x] 3.1 DTOs (`DisciplineDto`, `CoTeacherDto`, `DisciplineInput`, `UpdateDiscipline`, `InviteCoTeacher`) com class-validator e Swagger
- [x] 3.2 Service: acesso (principal/co-docente → 404), list, get, create, update, delete
- [x] 3.3 Service: validações de §5.6, `activeProjects`, `isCurrent`, `$transaction`, `P2002`
- [x] 3.4 Service: convite e remoção de co-docente
- [x] 3.5 Controller, módulo, registro em `app.module.ts`
- [x] 3.6 Testes do service

## 4. Organizations
- [x] 4.1 DTOs-classe anotados
- [x] 4.2 Service: catálogo com `openDemands`, perfil, histórico, Regra 6
- [x] 4.3 Controller, módulo, registro
- [x] 4.4 Testes do service (contato presente/ausente)

## 5. Verificação
- [x] 5.1 `npm run lint`, `npm run test`, `npm run build`
- [x] 5.2 Teste manual no Swagger com Postgres e seed
- [x] 5.3 Relatório final
