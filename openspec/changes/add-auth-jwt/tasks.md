# Tasks

> As tarefas 1.1 e 1.2 são portões: nada depois delas começa sem o aval do responsável pela task.
> As duas Open Questions do `design.md` são resolvidas ali, e não por suposição no meio da implementação.

## 1. Portões de decisão

- [x] 1.1 Obter aprovação explícita da biblioteca de hash de senha (recomendação: `bcrypt` com 10 salt rounds; alternativa `bcryptjs` se houver risco de build nativo) — verificar: decisão registrada por escrito antes de qualquer `npm install`
- [x] 1.2 Obter aprovação explícita sobre registro fazer auto-login (recomendação: sim, devolver `AuthResponse`) — verificar: decisão registrada; se for "não", os três registros passam a devolver apenas `UserResponse` e os testes correspondentes acompanham

## 2. Banco e migration inicial

- [x] 2.1 Criar o `.env` local a partir do `.env.example` (o repositório não versiona `.env`) e verificar que `npx prisma validate` resolve a `DATABASE_URL` pelo `prisma.config.ts`
- [x] 2.2 Subir o Postgres com `docker compose up -d` e verificar que o container `plataforma_lei_postgres` responde na porta 5432
- [x] 2.3 Gerar a migration inicial com `npx prisma migrate dev --name init` e verificar que `prisma/migrations/<timestamp>_init/migration.sql` existe e foi aplicado — **se o comando pedir reset do banco, parar e pedir autorização antes**
- [x] 2.4 Revisar o SQL gerado e verificar que ele reflete o `schema.prisma` do repositório sem nenhuma alteração de modelo (`git status` não deve mostrar `prisma/schema.prisma` modificado)

## 3. Contrato de papéis na borda

- [x] 3.1 Remover `ADMIN` de `src/common/enums/role.enum.ts`, deixando `STUDENT`, `PROFESSOR` e `ORGANIZATION` — verificar com `grep -rn "ADMIN" src/` sem resultados
- [x] 3.2 Criar o mapper bidirecional `Role` ↔ `PapelUsuario` (`STUDENT`↔`ESTUDANTE`, `PROFESSOR`↔`DOCENTE`, `ORGANIZATION`↔`PARCEIRO`) como função total nas duas direções — verificar: teste unitário cobrindo os três pares em ambos os sentidos

## 4. DTOs e contrato Swagger

- [x] 4.1 Criar `BaseRegisterDto` com `email` (`@IsEmail`) e `password` (`@IsString`, comprimento mínimo), anotados com `@ApiProperty` — verificar: campos aparecem como obrigatórios em `/api/docs`
- [x] 4.2 Criar `RegisterStudentDto` (herda base + `name`, `registrationNumber`) — verificar: os quatro campos obrigatórios no schema OpenAPI
- [x] 4.3 Criar `RegisterProfessorDto` (herda base + `name`), sem nenhum campo que tenha default no model `Professor` — verificar: `academicRole`, `paused` e `projectsPerSemester` ausentes do schema OpenAPI
- [x] 4.4 Criar `RegisterPartnerDto` (herda base + `name`, `type` validado com `@IsEnum(TipoParceiro)`) — verificar: os cinco valores de `TipoParceiro` listados em `/api/docs`, sem tradução
- [x] 4.5 Criar `LoginDto` (`email`, `password`) — verificar: presente no schema OpenAPI
- [x] 4.6 Criar os tipos/DTOs de resposta `UserResponse` (`id: string`, `email`, `role`, `name?`) e `AuthResponse` (`user`, `accessToken`) documentados com `@ApiProperty` — verificar: `/api/docs` mostra `accessToken` em camelCase e `id` como string

## 5. AuthService

- [x] 5.1 Criar o `AuthService` injetando `PrismaService` e `JwtService` — verificar: o módulo instancia sem erro no boot da aplicação
- [x] 5.2 Implementar o hash e a verificação de senha com a biblioteca aprovada em 1.1, isolados no service — verificar: teste unitário confirma que o valor persistido difere da senha enviada
- [x] 5.3 Implementar a emissão do token com payload **exatamente** `{ sub: string, email: string, role: Role }`, com o papel já traduzido — verificar: teste unitário inspeciona o objeto passado ao `JwtService.sign`
- [x] 5.4 Implementar a conversão de `sub` (string) para o inteiro do banco em um único ponto, validando que o resultado é inteiro e lançando `UnauthorizedException` caso contrário — verificar: teste com `sub: 'abc'` resulta em `401` e nenhuma chamada ao Prisma
- [x] 5.5 Implementar `registerStudent` criando `User` + `Student` em `prisma.$transaction`, com `select` explícito — verificar: teste unitário confirma que ambas as criações ocorrem dentro da transação
- [x] 5.6 Implementar `registerProfessor` criando `User` + `Professor` em `prisma.$transaction`, com `select` explícito — verificar: idem 5.5
- [x] 5.7 Implementar `registerPartner` criando `User` + `Partner` em `prisma.$transaction`, com `select` explícito — verificar: idem 5.5
- [x] 5.8 Tratar colisão de `email` com `ConflictException` (409) e mensagem explícita, sem deixar resíduo — verificar: teste unitário para e-mail duplicado
- [x] 5.9 Tratar colisão de `registrationNumber` com `ConflictException` (409) — verificar: teste unitário para matrícula duplicada
- [x] 5.10 Implementar `login` com mensagem de erro **idêntica** para e-mail inexistente e senha incorreta — verificar: teste compara as duas mensagens e confirma que são iguais
- [x] 5.11 Implementar a resolução do usuário autenticado a partir do `sub` do token, com `select` explícito, devolvendo `401` se o usuário não existir — verificar: testes para usuário existente e inexistente
- [x] 5.12 Implementar a montagem de `UserResponse`: `id` convertido para string, `role` traduzido para inglês e `name` resolvido do perfil (omitido quando não há perfil) — verificar: testes cobrindo os três perfis e o caso sem perfil

## 6. AuthController e módulo

- [x] 6.1 Criar o `AuthController` com `@ApiTags('auth')`, controller fino delegando tudo ao service — verificar: as rotas aparecem em `/api/docs`
- [x] 6.2 Expor `POST /auth/register/student`, `/professor` e `/partner`, com `@ApiOperation` e `@ApiResponse` — verificar: retornam `201` no Swagger
- [x] 6.3 Expor `POST /auth/login` com `@HttpCode(HttpStatus.OK)` — verificar: teste confirma `200`, não `201`
- [x] 6.4 Expor `GET /auth/me` com `@UseGuards(JwtAuthGuard)`, `@ApiBearerAuth()` e `@CurrentUser()`, resolvendo o usuário **apenas** pelo token — verificar: nenhum parâmetro de cliente identifica o usuário no handler
- [x] 6.5 Registrar `AuthController` e `AuthService` no `AuthModule`, preservando os `exports` atuais (`JwtAuthGuard`, `RolesGuard`, `PassportModule`, `JwtModule`) — verificar: a aplicação sobe e `projects` continua importando os guards sem alteração

## 7. Testes unitários do AuthService

- [x] 7.1 Montar o `TestingModule` com `PrismaService` e `JwtService` mockados — verificar: `npm run test` executa a suíte do `AuthService`
- [x] 7.2 Cobrir os três registros: transação usada, perfil correto criado, `201` com `AuthResponse` — verificar: testes passam
- [x] 7.3 Cobrir os conflitos `409` de e-mail e de matrícula — verificar: testes passam
- [x] 7.4 Cobrir o login: sucesso, senha errada e e-mail inexistente com mensagem idêntica — verificar: testes passam
- [x] 7.5 Cobrir o payload do JWT (`{ sub, email, role }` com papel em inglês) — verificar: teste inspeciona o argumento do `sign`
- [x] 7.6 Cobrir o `sub` inválido (`NaN`) resultando em `UnauthorizedException` — verificar: teste passa
- [x] 7.7 Cobrir a ausência de `passwordHash` em toda resposta do service — verificar: teste passa
- [x] 7.8 Cobrir a resolução de `name` a partir de cada perfil e a omissão quando não há perfil — verificar: teste passa

## 8. Verificação final

- [x] 8.1 Rodar `npm run lint` e verificar ausência de erros nos arquivos da task
- [x] 8.2 Rodar `npm run test` e verificar a suíte inteira passando — **não rodar `npm run build`**: ele falha pelo módulo `projects`, que está fora do escopo
- [x] 8.3 Validar manualmente os cinco endpoints no Swagger (`/api/docs`) com o Postgres no ar: os três registros (`201`), login (`200`), `/auth/me` com token (`200`) e sem token (`401`)
- [x] 8.4 Verificar no banco que a senha está hasheada e que `User` e perfil foram criados juntos em cada registro
- [x] 8.5 Confirmar que o working tree tem apenas os arquivos previstos, **sem nenhum commit e sem Pull Request**, na branch `feature/PLEI-32-auth`
- [x] 8.6 Escrever o relatório final: arquivos criados e alterados, saída do lint e dos testes, débitos técnicos (módulo `projects` quebrado, `JWT_SECRET` duplicado, `Professor.userId` obrigatório enquanto `Student.userId` e `Partner.userId` são opcionais) e pendências com justificativa
