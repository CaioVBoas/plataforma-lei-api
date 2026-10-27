# Spec Delta

## Purpose

Permite ao docente gerenciar as turmas do semestre atual, as competências que cada uma trabalha e os colegas que compartilham a disciplina.

## ADDED Requirements

### Requirement: Listagem de disciplinas do docente

O sistema SHALL expor `GET /disciplines`, retornando apenas as disciplinas em que o docente autenticado é principal ou co-docente, cada uma com `activeProjects` e `isCurrent`. O docente SHALL ser resolvido a partir do token, nunca de parâmetro do cliente.

#### Scenario: Principal e co-docente enxergam a disciplina
- **WHEN** um docente é principal de uma disciplina e co-docente de outra
- **THEN** ambas aparecem na resposta e disciplinas de terceiros não aparecem

#### Scenario: activeProjects ignora projetos encerrados
- **WHEN** uma disciplina tem um projeto com `ENCERRAMENTO` concluído e outro sem
- **THEN** `activeProjects` é `1`

#### Scenario: isCurrent
- **WHEN** o `semester` da disciplina é o do calendário com `isCurrent = true`
- **THEN** `isCurrent` é `true`; caso contrário `false`

### Requirement: Detalhe da disciplina

O sistema SHALL expor `GET /disciplines/:id`, com competências (nomes) e co-docentes. Se o docente não for principal nem co-docente, ou o id não existir, o sistema SHALL responder `404`.

#### Scenario: Disciplina de terceiro
- **WHEN** o docente pede uma disciplina na qual não é principal nem co-docente
- **THEN** o sistema responde `404`

#### Scenario: Id inválido
- **WHEN** o id não é um inteiro
- **THEN** o sistema responde `400` sem consultar o banco

### Requirement: Cadastro de disciplina

O sistema SHALL expor `POST /disciplines`, criando a turma no semestre do calendário com `isCurrent = true` e vinculando as competências de forma atômica, e responder `201` com `DisciplineDto`. `semester` e `coTeachers` SHALL NOT ser aceitos no corpo. O contrato SHALL usar `level`, `students` e `projectSlots`, com `level` em `intro|intermediate|advanced`.

#### Scenario: Cadastro bem-sucedido
- **WHEN** o corpo é válido
- **THEN** responde `201`, o `semester` é o corrente e as competências ficam vinculadas

#### Scenario: Sem semestre corrente
- **WHEN** nenhum calendário tem `isCurrent = true`
- **THEN** responde `409` com mensagem clara

#### Scenario: Código duplicado
- **WHEN** já existe `[professorId, code, semester]` igual
- **THEN** responde `409`, inclusive em condição de corrida (`P2002`)

### Requirement: Validação de disciplina

O sistema SHALL rejeitar com `400`: `name` vazio; `students < 1`; `teamSize < 1`; `teamSize > students` ("O tamanho da equipe precisa caber na turma."); `projectSlots < 1`; `skills` vazio.

#### Scenario: Equipe maior que a turma
- **WHEN** `teamSize` é maior que `students`
- **THEN** responde `400` com a mensagem em português

#### Scenario: Sem competências
- **WHEN** `skills` é uma lista vazia
- **THEN** responde `400`

#### Scenario: Competência fora do catálogo
- **WHEN** uma competência não existe em `Skill`
- **THEN** ela é criada por `name` e vinculada à disciplina

### Requirement: Atualização de disciplina

O sistema SHALL expor `PATCH /disciplines/:id` com campos parciais, revinculando as competências em transação quando `skills` vier no corpo. A validação de `teamSize` SHALL considerar os valores resultantes (enviados ou existentes). O sistema SHALL responder `409` quando `projectSlots < activeProjects` ("A disciplina já tem N projetos em curso. As vagas não podem ficar abaixo disso."). Co-docente SHALL poder editar.

#### Scenario: Vagas abaixo dos projetos em curso
- **WHEN** a disciplina tem 2 projetos ativos e `projectSlots` é `1`
- **THEN** responde `409`

#### Scenario: Revincular competências
- **WHEN** `skills` vem no corpo
- **THEN** o conjunto de competências passa a ser exatamente o enviado

### Requirement: Exclusão de disciplina

O sistema SHALL expor `DELETE /disciplines/:id`, respondendo `204` sem corpo quando não há `Project` vinculado, e `409` ("Esta disciplina tem projetos. Ela fica guardada com o histórico deles.") quando há, inclusive projetos encerrados.

#### Scenario: Com projeto
- **WHEN** existe qualquer projeto vinculado
- **THEN** responde `409` e nada é excluído

### Requirement: Convite de co-docente

O sistema SHALL expor `POST /disciplines/:id/co-teachers` com `{ email }`, normalizando por `trim()` e `toLowerCase()` antes de comparar e persistir, e responder com `DisciplineDto`. Erros: `400` se o e-mail não casar com `/@(cin\.)?ufpe\.br$/i` ("Use o e-mail @ufpe.br ou @cin.ufpe.br do colega."); `409` se a disciplina não é do semestre atual ("Só disciplinas de {semestre} aceitam convite."); `409` se é o próprio docente ("Você já é docente desta disciplina."); `409` se já vinculado ("Este colega já está na disciplina."); `404` se o e-mail não tem conta de docente (decisão 3).

#### Scenario: Convite bem-sucedido
- **WHEN** o e-mail `  Colega@CIN.UFPE.BR ` pertence a um docente existente
- **THEN** o vínculo é criado com o e-mail normalizado

#### Scenario: Domínio inválido
- **WHEN** o e-mail é `x@gmail.com`
- **THEN** responde `400`

#### Scenario: Disciplina de semestre passado
- **WHEN** `isCurrent` é `false`
- **THEN** responde `409`

#### Scenario: Docente sem conta
- **WHEN** o e-mail não corresponde a nenhum docente
- **THEN** responde `404` com mensagem clara

### Requirement: Remoção de co-docente

O sistema SHALL expor `DELETE /disciplines/:id/co-teachers/:email`, normalizando o e-mail, removendo o vínculo e retornando a disciplina atualizada (`200`).

#### Scenario: Remoção
- **WHEN** o e-mail está vinculado
- **THEN** o vínculo é removido e o `DisciplineDto` retornado não o contém

#### Scenario: Não vinculado
- **WHEN** o e-mail não está vinculado
- **THEN** responde `404`

### Requirement: Autorização

Todas as rotas de `/disciplines` SHALL exigir autenticação e papel de docente, e estar documentadas no Swagger com `@ApiBearerAuth()`. Ids SHALL trafegar como `string`.

#### Scenario: Papel incorreto
- **WHEN** um estudante chama `GET /disciplines`
- **THEN** responde `403`
