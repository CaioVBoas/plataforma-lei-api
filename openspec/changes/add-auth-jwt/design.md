# Design

## Context

Ver `proposal.md` — Why. O que molda o desenho é o estado atual do repositório:

- **O esqueleto JWT já existe e é imutável nesta mudança.** `JwtStrategy` recebe `{ sub, email, role }` e devolve `{ userId, email, role }`; `JwtAuthGuard` e `RolesGuard` já estão prontos; `@CurrentUser()` entrega `{ userId, email, role }` com `userId: string`. Assinar um payload diferente quebra o guard **silenciosamente** — sem erro de compilação e sem exceção óbvia em runtime.
- **O banco fala português, o contrato externo fala inglês.** `PapelUsuario` tem três valores (`DOCENTE`, `ESTUDANTE`, `PARCEIRO`) e não tem administrador; o frontend declara `'STUDENT' | 'PROFESSOR' | 'ORGANIZATION'`.
- **O `id` do `User` é inteiro autoincremento**, enquanto o frontend declara `id: string` e a `JwtStrategy` já tipa `sub` como string.
- **O contrato com o frontend é fechado.** Os dois repositórios não compartilham tipos TypeScript: o Swagger é o único canal do contrato, então a documentação é parte da entrega, não um acessório.
- **`ValidationPipe` global já está configurado** com `whitelist`, `forbidNonWhitelisted` e `transform`.
- **`PrismaService` é `@Global()`** (Prisma 7 com driver adapter `@prisma/adapter-pg`) e pode ser injetado direto.
- **O schema nunca foi versionado em migrations.** Não existe `prisma/migrations/`.

## Goals / Non-Goals

**Goals:**
- Preencher o vão entre o esqueleto JWT existente e o contrato que o frontend já consome, sem tocar em nada do esqueleto.
- Concentrar toda tradução de fronteira — papel e tipo do identificador — em pontos únicos e explícitos.
- Tornar impossível, por construção, que o hash da senha escape em uma resposta.
- Garantir que `User` e perfil nasçam juntos ou não nasçam.

**Non-Goals:**
- Desenhar tratamento global de erros: o formato nativo de erro do NestJS já é o que o frontend lê em `error.response.data.message`. Filtro de exceção e interceptor de resposta são de outra task, e nada será criado em `src/common/filters/` ou `src/common/interceptors/`.
- Resolver a duplicação do `JWT_SECRET` (hoje repetido com fallback hardcoded em `auth.module.ts` e `jwt.strategy.ts`). Registrado como débito.
- Corrigir o módulo `projects`, quebrado em tempo de compilação na `develop`. Consequentemente, `npm run build` **não é gate** desta mudança.
- Refresh token, revogação, blacklist, recuperação de senha e verificação de e-mail.

## Decisions

### 1. Três endpoints de registro, um por perfil, com DTOs por herança

`BaseRegisterDto` (`email` + `password`) e três DTOs que o estendem, um por rota.

**Por quê:** num endpoint único, os campos de cada perfil apareceriam todos como opcionais no schema OpenAPI — e é dele que o time de frontend parte para construir a tela de cadastro. A documentação mentiria sobre o que é obrigatório. Como bônus, o `forbidNonWhitelisted: true` já global passa a rejeitar campo de perfil trocado (mandar `registrationNumber` no registro de docente) sem nenhum código extra.

**Alternativa descartada:** união discriminada com `@ApiExtraModels` + `oneOf`. É frágil com `class-validator` e cara de manter para um time com desenvolvedores juniores.

### 2. `Role` é o enum da borda; `PapelUsuario` fica na persistência; um mapper bidirecional entre os dois

`src/common/enums/role.enum.ts` perde `ADMIN` e fica com exatamente os três valores do contrato externo.

**Por quê remover `ADMIN`:** não existe papel de administrador no banco. Com o valor no enum, o `ValidationPipe` aceitaria `role: 'ADMIN'` e o mapper não teria destino — erro de runtime ou fallback silencioso. A regra é: **nenhum valor do contrato externo pode ser irrepresentável na persistência.** O mapper é total nas duas direções, por construção.

**Consequência deliberada:** o JWT carrega o papel **já traduzido**. Com isso, `RolesGuard`, `@Roles()` e `@CurrentUser()` continuam funcionando sem uma linha alterada — o guard compara `user.role` com valores de `Role`, e é exatamente isso que chega.

### 3. O identificador trafega como string na borda; a conversão acontece em um único ponto

`sub` do token, `id` das respostas e `@CurrentUser().userId` são string. A conversão para inteiro acontece **dentro do `AuthService`, imediatamente antes da query do Prisma**, e em nenhum outro lugar.

**Por quê:** a `JwtStrategy` já tipa `sub` como string, então strategy, guard e decorator não mudam; alinha com a RFC 7519 (`sub` é `StringOrURI`) e com o `id: string` declarado pelo frontend.

**Armadilha tratada explicitamente:** `Number('abc')` devolve `NaN` e o Prisma lança um erro obscuro sobre tipo de argumento. A conversão valida que o resultado é inteiro **antes** de tocar o banco e lança `UnauthorizedException` se não for — um token com `sub` adulterado vira `401`, não `500`.

### 4. `select` explícito no Prisma, em toda query de usuário

Nenhuma query de usuário usa o retorno padrão do Prisma. O `passwordHash` só é selecionado onde é indispensável — na verificação de credenciais do login — e nunca cruza a fronteira do service.

**Por quê:** esconder o campo por serialização (`@Exclude`, interceptor) depende de o desenvolvedor lembrar de aplicar o filtro na rota nova. O `select` explícito falha para o lado seguro: campo novo no schema não aparece sozinho na resposta. Além disso, interceptor global está fora de escopo.

### 5. Os três registros usam `prisma.$transaction`

Criar `User` sem perfil — ou o contrário — deixa dado órfão que nenhuma rota posterior sabe tratar. A transação cobre a criação do usuário e a do perfil.

Colisão de `email` e de `registrationNumber` é tratada como `409`. A restrição de unicidade do banco é a autoridade final: a transação aborta e nada é persistido, o que satisfaz "não deixa resíduo" mesmo sob concorrência. Uma verificação prévia serve para produzir a mensagem explícita, mas não é o que garante a unicidade.

### 6. Login responde `200` explicitamente

NestJS devolve `201` por padrão em `POST`. O login recebe `@HttpCode(HttpStatus.OK)`, e isso é coberto por teste — o frontend espera `200` e a falha seria silenciosa no servidor.

### 7. Mensagem de erro idêntica para e-mail inexistente e senha errada

Ambos os caminhos do login lançam a mesma `UnauthorizedException`, com a mesma mensagem genérica, para não permitir enumeração de contas.

### 8. Registro devolve `AuthResponse` (auto-login) — **pendente de aprovação**

Recomendação: sim. A tela de cadastro leva o usuário direto para dentro, sem uma segunda chamada, e a resposta fica idêntica à do login — um único tipo para o frontend modelar. O frontend ainda não consome o registro, então o formato não está travado; se for recusado, os registros passam a devolver apenas `UserResponse` e a única mudança é não emitir o token. Ver **Open Questions**.

### 9. Biblioteca de hash — **pendente de aprovação**

Recomendação: `bcrypt` com 10 salt rounds. Ver **Open Questions**. O ponto de desenho relevante é que o hash fica isolado atrás do `AuthService`, então a troca entre `bcrypt` e `bcryptjs` é de uma linha de import e não afeta specs nem tasks.

### 10. Migration inicial apenas materializa o schema existente

`prisma migrate dev --name init` gera a primeira migration a partir do `schema.prisma` **já versionado**, sem nenhuma alteração de modelo. A `DATABASE_URL` vem do `prisma.config.ts` — o bloco `datasource db` do schema não declara `url`.

## Risks / Trade-offs

- **Payload do JWT diferente de `{ sub, email, role }` quebra o guard sem erro visível** → teste unitário que inspeciona exatamente o objeto passado ao `JwtService.sign`.
- **`Number()` sobre `sub` inválido gera `NaN` e erro obscuro do Prisma** → validação de inteiro antes da query, com `UnauthorizedException`; coberto por teste.
- **`User` ou perfil órfão** → `prisma.$transaction` nos três registros.
- **Vazamento do `passwordHash`** → `select` explícito em todas as queries de usuário; teste verificando a ausência do campo na resposta.
- **Enumeração de contas pelo login** → mensagem idêntica nos dois caminhos; teste comparando as duas mensagens.
- **Esquecer `@HttpCode(HttpStatus.OK)` no login** → o frontend recebe `201` onde espera `200`; coberto por teste.
- **Remover `Role.ADMIN` é breaking para quem o referencie** → varredura confirma que nenhum arquivo do repositório usa `Role.ADMIN` hoje. `Role.ORGANIZATION`, usado por `projects.controller.ts`, permanece.
- **`migrate dev` pode exigir reset do banco local** se o schema já tiver sido aplicado diretamente — é o caso esperado aqui, já que nunca houve migrations. **Reset não será executado sem autorização explícita.**
- **Sem refresh token e sem revogação**: um token vazado vale até expirar (`1d`). Limitação conhecida e aceita nesta fase.
- **`JWT_SECRET` duplicado com fallback hardcoded** em dois arquivos: se um for alterado sem o outro, todo token emitido passa a ser rejeitado. Débito registrado, correção fora do escopo.

## Migration Plan

1. `docker compose up -d` para subir o Postgres local.
2. Confirmar que a `DATABASE_URL` está sendo resolvida pelo `prisma.config.ts` — o `datasource db` não declara `url`. Exige um `.env` local, que hoje não existe no repositório (só `.env.example`).
3. `npx prisma migrate dev --name init`, gerando `prisma/migrations/<timestamp>_init/`.
4. Conferir que o SQL gerado reflete o `schema.prisma` do repositório e **não contém nenhuma alteração de modelo**.
5. Se o comando pedir reset do banco: **parar e pedir autorização.**

Rollback: a mudança não altera dados existentes nem o modelo. Reverter é descartar o working tree — não há commit nem deploy envolvido nesta entrega.

## Open Questions

Ambas as decisões abaixo estão **abertas por decisão do documento da task (§9) e não serão executadas sem aval explícito.** Nenhuma altera as specs; ambas afetam as tasks, por isso estão registradas e bloqueiam o início da implementação.

1. **Biblioteca de hash de senha.** Nenhuma está instalada, e o projeto proíbe dependência nova sem aprovação. Recomendação: **`bcrypt` com 10 salt rounds** — é o padrão de fato no ecossistema NestJS, tem `@types/bcrypt` mantido e 10 rounds é o equilíbrio usual entre custo e segurança. Ressalva honesta: `bcrypt` é um módulo nativo e depende de `node-gyp`/prebuild; em Node 24 ou em máquinas sem toolchain de compilação isso já causou atrito em outros times. `bcryptjs` é JavaScript puro, sem build nativo, API compatível e desde a versão 3 traz tipos próprios — o custo é ser mais lento, o que em `hash`/`compare` de login é irrelevante nesta escala. **Se houver qualquer chance de alguém no time não conseguir compilar, `bcryptjs` é a escolha mais segura para o time, com perda desprezível.**
2. **Registro faz auto-login.** Recomendação: **sim** — ver Decisão 8.
