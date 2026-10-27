# Proposal

## Why

O docente não tem onde colocar uma demanda: a plataforma ainda não permite cadastrar as turmas do semestre, declarar as competências que cada uma trabalha, dividir a disciplina com colegas nem consultar as organizações parceiras. As competências e o nível da turma são os insumos da compatibilidade demanda × disciplina (Regra 9), então precisam existir antes de qualquer reserva de demanda.

O frontend (`plataforma-lei-web`) já tem essas telas rodando contra mocks e define o contrato. A API se adapta a ele (PLEI-41).

## What Changes

- **Módulo `disciplines`**: CRUD de turmas do semestre atual (`/disciplines`) e gestão de co-docentes (`/disciplines/:id/co-teachers`). Persistência em `Course`.
- **Módulo `skills`**: `GET /skills/catalog`, retornando `string[]` para autocomplete.
- **Módulo `organizations`**: catálogo de parceiros (`GET /organizations`) e perfil com histórico (`GET /organizations/:id`). Persistência em `Partner`. O contato do ponto focal só é exposto a docente com projeto com a organização (Regra 6, LGPD).
- **Mappers de borda** em `src/common/mappers/`: `courseLevel.mapper.ts` e `partnerType.mapper.ts`, seguindo `role.mapper.ts`.
- Ids trafegam como `string`; DTOs são classes anotadas para Swagger; mensagens de erro em português.

## Capabilities

### New Capabilities
- `disciplines`: gestão de disciplinas do semestre e co-docentes.
- `skills-catalog`: catálogo de competências.
- `organizations`: catálogo e perfil de organizações parceiras.

### Modified Capabilities
Nenhuma.

## Non-goals

Alterar `prisma/schema.prisma` ou criar migration; qualquer coisa em `src/modules/demands/` (branch `PLEI-42`); filtro/interceptor globais; cálculo de compatibilidade; reserva de demanda e criação de projeto; fluxo de aceite de convite; alterações em `plataforma-lei-web`.

## Impact

- Novos: `src/modules/{disciplines,skills,organizations}/`, dois mappers, testes dos três services.
- Alterado: `src/app.module.ts` (registro dos módulos).
- Sem dependência nova, sem migration.
- Sobreposição com `origin/PLEI-42` (mappers e DTOs de organização duplicados, sem Swagger): ver design.md. Sem colisão de rotas.
