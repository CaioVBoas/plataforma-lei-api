# Tasks

## 1. Banco

- [x] 1.1 Adicionar `Partner.contactEmail` e `Partner.tutorialSeen` e gerar a migration — verificar: `npx prisma validate` e `npx prisma migrate deploy` em banco novo
- [x] 1.2 Corrigir `ADD COLUMN "updatedAt"` duplicado na migration `20261009120000` — verificar: `migrate deploy` em banco vazio aplica as três migrations
- [x] 1.3 Seed com driver adapter e registrado no `prisma.config.ts` — verificar: `npx prisma db seed` conclui

## 2. Cadastro (user-auth)

- [x] 2.1 `RegisterProfessorDto` com domínio UFPE e `department` obrigatório — verificar: spec de DTO aceita `@ufpe.br`/`@cin.ufpe.br` e recusa `@gmail.com`
- [x] 2.2 `RegisterPartnerDto` com `location`, `focalName` e `focalRole` — verificar: `auth.service.spec.ts` confere os campos gravados
- [x] 2.3 Extrair `parseUserId` para `src/common/utils` — verificar: testes de `me` com `sub` inválido continuam passando

## 3. Conta do docente

- [x] 3.1 `GET/PATCH /account/me` com `@Roles(Role.PROFESSOR)` — verificar: smoke 401 sem token, 403 com token de organização
- [x] 3.2 `photo: ''` remove e data URL inválida é recusada — verificar: `account.service.spec.ts` e smoke

## 4. Calendário

- [x] 4.1 `GET /calendar/current` com datas `YYYY-MM-DD` e `today` em Recife — verificar: `calendar.service.spec.ts` com relógio fixo
- [x] 4.2 404 sem semestre ativo — verificar: teste unitário

## 5. Portal da organização

- [x] 5.1 `GET/PATCH /org-portal/account` mapeando para o ponto focal — verificar: `orgProfile.service.spec.ts`
- [x] 5.2 `GET/PATCH /org-portal/profile` com contato aninhado — verificar: e-mail inválido gera 400 e o nome não é editável
- [x] 5.3 `PATCH /org-portal/profile/images` com `''` removendo — verificar: smoke com capa de ~600KB

## 6. Infra e validação

- [x] 6.1 Corpo JSON até 5mb — verificar: o smoke envia foto e capa de ~600KB com 200
- [x] 6.2 `npx tsc --noEmit`, `npm run lint`, `npm test` e `npm run build` sem erros
- [x] 6.3 Smoke E2E contra a API real e Swagger com as rotas novas
