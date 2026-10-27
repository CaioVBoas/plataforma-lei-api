# Spec Delta

## Purpose

Dá aos portais as datas de referência do semestre acadêmico ativo.

## ADDED Requirements

### Requirement: Semestre ativo

O sistema SHALL expor `GET /calendar/current` a qualquer usuário autenticado. A resposta SHALL ser o calendário com `isCurrent = true`; havendo mais de um, o de `startsAt` mais recente. A resposta SHALL conter `id` (o semestre), `startsAt`, `endsAt`, `linkDeadline`, `midtermAt` e `finalAt`, em `YYYY-MM-DD`, e `today`, a data corrente no fuso `America/Recife`.

#### Scenario: Semestre cadastrado

- **WHEN** existe o semestre 2026.2 marcado como corrente
- **THEN** o sistema responde `200` com `id: "2026.2"` e as datas do semestre

#### Scenario: Virada do dia em Recife

- **WHEN** são 01:30 UTC de 25/08
- **THEN** `today` é `2026-08-24`

#### Scenario: Sem semestre ativo

- **WHEN** nenhum calendário está marcado como corrente
- **THEN** o sistema responde `404`

#### Scenario: Sem token

- **WHEN** a requisição não traz token Bearer válido
- **THEN** o sistema responde `401`
