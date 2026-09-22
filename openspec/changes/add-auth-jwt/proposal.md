# Proposal

## Why

A Plataforma LEI não tem porta de entrada: nada nela é público, toda funcionalidade exige usuário logado com papel definido, mas hoje **nenhum endpoint de autenticação está exposto**. O esqueleto JWT já existe no repositório (estratégia, guards, decorators); faltam `AuthController` e `AuthService`, então é impossível criar uma conta ou obter um token.

O frontend (`plataforma-lei-web`, repositório separado) já implementou sua camada de autenticação contra um contrato fechado e hoje não tem contraparte. Esta mudança entrega registro, login e identificação do usuário autenticado (PLEI-32).

## What Changes

- **Novo `AuthService`** com registro por perfil, login e resolução do usuário do token, usando `prisma.$transaction` para criar `User` + perfil atomicamente e `select` explícito em toda query de usuário (o `passwordHash` nunca sai do service).
- **Novo `AuthController`** expondo cinco endpoints: `POST /auth/register/student`, `POST /auth/register/professor`, `POST /auth/register/partner`, `POST /auth/login` e `GET /auth/me`.
- **Três DTOs de registro** (`RegisterStudentDto`, `RegisterProfessorDto`, `RegisterPartnerDto`) derivados de um `BaseRegisterDto` (`email` + `password`), mais o `LoginDto`. Um endpoint por perfil, em vez de rota única com validação condicional, para que o schema OpenAPI não declare como opcional um campo que é obrigatório.
- **Tradução de papéis na borda**: novo mapper bidirecional `Role` (`STUDENT` / `PROFESSOR` / `ORGANIZATION`) ↔ `PapelUsuario` (`ESTUDANTE` / `DOCENTE` / `PARCEIRO`). O JWT e todas as respostas carregam o papel **em inglês**.
- **BREAKING (interno)**: `Role.ADMIN` é **removido** de `src/common/enums/role.enum.ts`. Não existe papel de administrador no banco — mantê-lo faria o `ValidationPipe` aceitar um valor sem destino no mapper. Nenhum consumidor atual depende dele.
- **`AuthModule` passa a declarar `controllers` e `providers`**, mantendo as exportações atuais (`JwtAuthGuard`, `RolesGuard`, `PassportModule`, `JwtModule`) intactas para não quebrar quem já as importa.
- **Migration inicial** em `prisma/migrations/`, materializando o `schema.prisma` que já está versionado no repositório — sem nenhuma alteração de schema.
- **Testes unitários do `AuthService`**, cobrindo em especial o payload emitido no JWT (`{ sub, email, role }`), o `200` do login e a mensagem genérica de credencial inválida.

### Decisões abertas (pendentes de aprovação, não executadas nesta fase)

1. **Biblioteca de hash de senha** — nenhuma está instalada e o projeto proíbe adicionar dependência sem aprovação explícita.
2. **Registro faz auto-login** — se os três registros devolvem `AuthResponse` com token ou apenas o usuário criado.

## Capabilities

### New Capabilities
- `user-auth`: registro de usuário por perfil (estudante, docente, parceiro), login com e-mail e senha, emissão e validação de token JWT, identificação do usuário autenticado e tradução de papéis entre a borda da API e a persistência.

### Modified Capabilities
<!-- Nenhuma: não há specs pré-existentes neste projeto (openspec list --specs retorna vazio). -->

## Impact

**Código novo**
- `src/modules/auth/auth.controller.ts`, `auth.service.ts`, `auth.service.spec.ts`
- `src/modules/auth/dto/` — `base-register.dto.ts`, `register-student.dto.ts`, `register-professor.dto.ts`, `register-partner.dto.ts`, `login.dto.ts`
- `src/common/mappers/` (ou equivalente) — mapper `Role` ↔ `PapelUsuario`
- `prisma/migrations/<timestamp>_init/migration.sql`

**Código alterado**
- `src/common/enums/role.enum.ts` — remoção de `ADMIN`
- `src/modules/auth/auth.module.ts` — registro de controller e service

**APIs**: cinco rotas novas sob `/auth`, documentadas no Swagger (`/api/docs`). O contrato de resposta (`AuthResponse` / `UserResponse`) é fechado pelo frontend: `id` como string, `role` em inglês, `accessToken` em camelCase, `name` vindo do perfil.

**Dependências**: exige uma biblioteca de hash de senha, ainda **não aprovada** (decisão aberta 1). Nenhuma outra dependência nova.

**Não afetado / fora do escopo**: `prisma/schema.prisma`, o módulo `projects` (quebrado em tempo de compilação na `develop`, e assim deve permanecer), `src/common/filters/`, `src/common/interceptors/`, e o repositório `plataforma-lei-web`.

**Infra**: Postgres local via `docker compose up -d`; a `DATABASE_URL` é resolvida pelo `prisma.config.ts`, não pelo bloco `datasource` do schema.
