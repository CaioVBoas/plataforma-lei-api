# Design

## Context

- O esqueleto de autenticação (PLEI-32) é a base: `JwtAuthGuard`, `RolesGuard`, `@Roles`, `@CurrentUser` e o payload `{ sub, email, role }` não mudam.
- O front (`plataforma-lei-web`) já tem os tipos que estas rotas atendem: `Account`, `SemesterCalendar`, `OrgAccount`, `OrgProfile` e `OrgImagesInput`. Os nomes de campo seguem esses tipos (`site`, `meetingCadence`, `onSiteVisit`, `midtermAt`, `finalAt`), e não os nomes do texto da história.
- Branches abertas: o PLEI-43 cria `src/modules/org-portal/` (rotas `org-portal/projects`) e o PLEI-41 cria `src/common/mappers/partnerType.mapper.ts`.

## Goals / Non-Goals

**Goals:**
- Cumprir os critérios de aceite do PLEI-40 com os contratos que o front já usa.
- Barrar acesso por perfil em todas as rotas novas: 401 sem token, 403 com papel errado.
- Não colidir com os arquivos das branches abertas.

**Non-Goals:**
- Histórico da organização (PLEI-41), troca de e-mail e senha, e filtro global de exceções.

## Decisions

### 1. Representante da organização é o ponto focal

A conta (`name`, `position`, `phone`) grava nas mesmas colunas do contato (`focalName`, `focalRole`, `phone`).

**Por quê:** o mock do front já trata os dois como a mesma pessoa, e o cadastro coleta um nome e um cargo só.

**Alternativa descartada:** colunas próprias para o representante. Duplicariam dado que hoje é sempre igual.

### 2. `contactEmail` nulo significa "o mesmo e-mail do login"

O PATCH do perfil só grava `contactEmail` quando o e-mail difere de `User.email`, comparando sem diferenciar maiúsculas.

**Por quê:** enquanto forem iguais, há uma fonte só de verdade.

**Alternativa descartada:** copiar o e-mail no cadastro. Ficaria desatualizado se o login mudasse.

### 3. Imagens como data URL no JSON, com `''` para remover

O formato é o mesmo que o front já produz (`resizeToSquare`, `resizeToFit`, `resizeToCover`). A validação aceita só `data:image/(png|jpeg|webp|gif);base64,…` e no máximo 2 MB de texto por imagem. SVG fica de fora por poder carregar script. O corpo JSON passa a aceitar 5mb.

**Alternativa descartada:** upload multipart para storage. Exige infraestrutura que o projeto ainda não tem.

### 4. `today` vem do servidor, no fuso `America/Recife`

O front calcula prazos, semanas e avisos a partir de `calendar.today`, nunca do relógio do navegador.

**Por quê:** servir `today` mantém a fonte única e permite congelar a data em demonstração no futuro.

### 5. Código em `src/modules/orgProfile/`, com `@Controller('org-portal')`

**Por quê:** se o mesmo arquivo `org-portal/orgPortal.module.ts` nascesse nas duas branches, haveria conflito com o PLEI-43. As rotas (`account`, `profile`, `profile/images`) não colidem com `projects` nem com `demands`.

### 6. `type` trafega como enum do banco

Segue a regra do `RegisterPartnerDto`: quem traduz para rótulo é o front.

**Por quê:** o mapper de rótulos do PLEI-41 é de mão única e ainda não está na `develop`.

### 7. `parseUserId` vira utilitário comum

Os services novos precisam da mesma conversão `sub` → inteiro com 401. Ela sai do `AuthService` para `src/common/utils/parseUserId.ts`, sem mudança de comportamento.

## Risks / Trade-offs

- **Data URL infla o banco.** Uma capa ocupa algumas centenas de KB por organização. É aceitável no volume atual; storage externo fica para depois.
- **Mensagens de validação aninhadas** saem com prefixo (`contact.Informe…`) pelo `ValidationPipe`. O front valida antes de enviar, então é raro aparecer.
- **Edição de migration já versionada** (`20261009120000`, `ADD COLUMN IF NOT EXISTS`). Ela nunca aplicava em banco novo, então não há ambiente íntegro com o checksum antigo. Quem tiver aplicado o SQL manualmente deve rodar `prisma migrate resolve`.
- **Drift preexistente** entre o schema e as migrations (ações de FK e defaults de `demands`). Não foi incluído aqui para manter a migration focada.

## Migration Plan

1. `docker compose up -d`
2. `npx prisma migrate deploy`
3. `npx prisma db seed`

Rollback: `ALTER TABLE "partners" DROP COLUMN "contactEmail", DROP COLUMN "tutorialSeen";`
