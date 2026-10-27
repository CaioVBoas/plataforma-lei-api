# Design

## Decisões abertas (§9 da task) — aguardam aval

| # | Decisão | Recomendação | Alternativa |
|---|---|---|---|
| 1 | Conteúdo de `GET /organizations/:id` | `organization`, `contact?` e listas **enxutas** `openDemands` e `myProjects` (id, título, semestre, nome da disciplina) | Omitir as duas listas nesta task |
| 2 | Competência fora do catálogo | `upsert` em `Skill` por `name` (nome normalizado com `trim`) | `400` para nome fora do catálogo |
| 3 | Convite para e-mail sem conta | Só e-mail com conta de docente; `404` com mensagem clara. Lacuna de schema registrada | Novo modelo de convite pendente (exige a frente do schema) |
| 4 | Filtro de `openDemands` | `stage = PUBLICADA` e sem `Project` | Qualquer demanda sem projeto |
| 5 | `syllabus` / `acceptsDemands` | Não expor | Expor como opcionais |

Os specs deste change assumem as recomendações. Se algum item mudar, os specs são ajustados antes da implementação.

Pontos que a spec da task deixa em aberto e que precisam de confirmação:

- **Forma de `GET /organizations/:id`**: o §5.4 define `OrganizationDto`, mas o §5.5 diz "perfil + histórico + `contact` condicional". Proposta: resposta `{ organization: OrganizationDto, contact?: OrganizationContactDto, openDemands, myProjects }`.
- **Resolução do docente**: `@CurrentUser().userId` (string) → `Professor` via `userId`. Se o usuário tem papel PROFESSOR mas não há `Professor`, responder `404`.
- **Co-docente com `name`**: `CoTeacherDto.name` sai de `Professor.name`. Como só há convite para quem tem conta, nunca é pendente.
- **Calendário sem `isCurrent`**: `POST` falha com `409` e mensagem clara ("Não há semestre letivo corrente configurado."). `GET` trata `isCurrent = false` para todas.
- **`DELETE` de co-docente que não está na disciplina**: `404`.
- **Quem pode convidar/remover co-docente**: principal ou co-docente (mesma regra de acesso do §5.7). A spec da task não restringe ao principal.

## Arquitetura

- Um módulo por raiz de rota. `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(Role.PROFESSOR)` + `@ApiBearerAuth()` no controller.
- `DisciplinesService` centraliza o acesso: `findAccessible(courseId, professorId)` com `OR [professorId, coTeachers.some]`; `404` caso contrário.
- `activeProjects`: `Project` com `milestones: { none: { step: ENCERRAMENTO, doneAt: { not: null } } }`, via `_count` com filtro no `select`.
- `POST`/`PATCH` em `$transaction`: upsert das skills e `CourseSkill` (revincular = `deleteMany` + `createMany`).
- `P2002` → `409` (unicidade `[professorId, code, semester]`).
- Ids de rota: `ParseIntPipe` na borda; `String(id)` na saída.
- `:email` do co-docente: `decodeURIComponent` é feito pelo Express; normalizar com `trim().toLowerCase()`.
- Regra 6: `contact` montado com `select` explícito (`focalName`, `focalRole`, `channel`, `user.email`) apenas após consulta de existência de `Project` do docente (principal ou co-docente) com a organização; `phone` nunca sai. Listagem e perfil base nunca selecionam campos sensíveis.
- `history`: projetos da organização com `ENCERRAMENTO` concluído; `result` = `outcomeSummary ?? ""`.
- Nulos → `""` na saída de organização.

## Sobreposição com `origin/PLEI-42`

PLEI-42 define localmente `PARTNER_TYPE_LABELS`, `LEVEL_MAP` e DTOs de organização como interfaces sem Swagger. Esta task cria mappers comuns e DTOs-classe próprios em `organizations/`, sem importar de `demands/`. Migração da branch alheia fica como débito.

## Débitos a registrar

- Schema sem convite pendente de co-docente.
- `JWT_SECRET` duplicado com fallback hardcoded (`auth.module.ts`, `jwt.strategy.ts`).
- `package.json#prisma.seed` depreciado no Prisma 7.
- Duplicatas em `modules/demands` (PLEI-42).
- Sem filtro global de exceções nem paginação em `GET /organizations`.
