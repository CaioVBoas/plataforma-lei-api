# Proposal

## Why

Docentes e representantes de organizações parceiras já conseguem criar conta e entrar (PLEI-32), mas não conseguem **operar os portais** com dados reais (PLEI-40):

- O cadastro de docente aceita qualquer e-mail e descarta o departamento que o formulário coleta.
- O cadastro de parceiro guarda só nome e tipo. Local, cargo e ponto focal se perdem.
- Não há rota para o docente ler ou editar os próprios dados (telefone, foto, tutorial visto).
- Não há rota para a organização ler ou editar a conta do representante e o perfil institucional (sobre, público, site, reuniões, visitas, logo e capa).
- Não há rota para o semestre ativo. O front conta todos os prazos a partir do calendário, e hoje usa datas fixas de demonstração.

O schema já tem quase todas as colunas (PLEI-39). Faltam a exposição na API, a validação e dois campos em `Partner`.

## What Changes

- **MODIFIED `POST /auth/register/professor`**: e-mail obrigatoriamente `@ufpe.br` ou `@cin.ufpe.br`, e `department` obrigatório e persistido.
- **MODIFIED `POST /auth/register/partner`**: `location`, `focalName` e `focalRole` obrigatórios e persistidos. Quem se cadastra é o ponto focal.
- **Novo `GET/PATCH /account/me`** (só docente): `name`, `email` (só leitura), `department`, `phone`, `photo` (data URL; `''` remove) e `tutorialSeen`.
- **Novo `GET /calendar/current`** (qualquer usuário autenticado): semestre com `isCurrent`, datas em `YYYY-MM-DD` e `today` no fuso de Recife.
- **Novo `GET/PATCH /org-portal/account`** (só organização): representante = ponto focal (`name`→`focalName`, `position`→`focalRole`, `phone`), mais `tutorialSeen`.
- **Novo `GET/PATCH /org-portal/profile`** e **`PATCH /org-portal/profile/images`** (só organização): dados institucionais, contato do ponto focal, logo e capa.
- **Migration**: `Partner.contactEmail` (nulo = e-mail de login) e `Partner.tutorialSeen`.
- **Limite do corpo JSON em 5mb**: foto, logo e capa trafegam como data URL; o padrão de 100kb barrava a capa.
- **Correções de base que destravam a validação**: a migration `20261009120000` recriava `references.updatedAt`, que a `init` já cria, e falhava em banco novo. O seed instanciava o `PrismaClient` sem driver adapter, o que o Prisma 7 recusa.

## Capabilities

### New Capabilities
- `account`: conta do docente autenticado.
- `academic-calendar`: semestre acadêmico ativo.
- `org-portal-profile`: conta do representante e perfil institucional da organização.

### Modified Capabilities
- `user-auth`: requisitos "Registro de docente" e "Registro de parceiro".

## Impact

**Código novo**
- `src/modules/account/`, `src/modules/calendar/`, `src/modules/orgProfile/`
- `src/common/utils/parseUserId.ts` (extraído do `AuthService`)
- `src/common/validation/imageDataUrl.ts`
- `prisma/migrations/<timestamp>_add_partner_tutorial_and_contact_email/`

**Código alterado**
- `src/modules/auth/dto/registerProfessor.dto.ts`, `registerPartner.dto.ts`, `auth.service.ts`
- `src/main.ts`, `src/app.module.ts`
- `prisma/schema.prisma`, `prisma/seed.ts`, `prisma.config.ts`

**Fora do escopo**
- Histórico da organização com o CIn: `history` sai vazio aqui; o cálculo está no PLEI-41.
- Troca de e-mail e de senha, e a confirmação de e-mail por código.
- Tradução do tipo de parceiro para rótulo: a API trafega o enum e o front traduz.
