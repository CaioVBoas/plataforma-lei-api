# Spec Delta

## Purpose

Permite ao docente conhecer as organizações parceiras e seu histórico com o CIn, sem expor dado pessoal do ponto focal antes da hora (Regra 6).

## ADDED Requirements

### Requirement: Catálogo de organizações

O sistema SHALL expor `GET /organizations` (apenas docente), retornando `OrganizationSummaryDto[]` com `openDemands`, igual ao número de demandas do parceiro com `stage = PUBLICADA` e sem `Project` vinculado. `type` SHALL sair como rótulo legível. Campos nulos SHALL sair como string vazia. `id` SHALL ser string.

#### Scenario: Contagem de demandas abertas
- **WHEN** um parceiro tem uma demanda publicada sem projeto, uma publicada com projeto e uma em rascunho
- **THEN** `openDemands` é `1`

#### Scenario: Rótulo e nulos
- **WHEN** `type` é `ORGAO_PUBLICO` e `location` é nulo
- **THEN** `type` é "Órgão público" e `location` é `""`

### Requirement: Perfil da organização

O sistema SHALL expor `GET /organizations/:id`, retornando o perfil, o `history` (projetos com `ENCERRAMENTO` concluído: `title`, `semester`, `disciplineName`, `teacherName` do docente principal, `result`) e listas enxutas `openDemands` e `myProjects` (decisão 1). Organização inexistente SHALL resultar em `404`.

#### Scenario: Histórico
- **WHEN** a organização tem um projeto encerrado e um em curso
- **THEN** só o encerrado aparece em `history`

### Requirement: Contato condicionado (Regra 6)

O sistema SHALL incluir `contact` (`focalName`, `focalRole`, `email` de `Partner.user.email`, `channel`) somente quando o docente autenticado, como principal ou co-docente, tem `Project` com a organização. Nos demais casos `contact` SHALL estar ausente. `phone` SHALL NOT sair em nenhum caso. Nenhum campo sensível SHALL aparecer em `GET /organizations` nem fora de `contact`.

#### Scenario: Com projeto
- **WHEN** o docente tem projeto com a organização
- **THEN** `contact` está presente

#### Scenario: Sem projeto
- **WHEN** o docente não tem projeto com a organização
- **THEN** `contact` está ausente e a resposta não contém `focalName`, `focalRole`, `phone`, `channel` nem e-mail

#### Scenario: Co-docente
- **WHEN** o projeto está numa disciplina em que o docente é co-docente
- **THEN** `contact` está presente
