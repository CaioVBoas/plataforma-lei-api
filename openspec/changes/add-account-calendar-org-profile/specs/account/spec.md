# Spec Delta

## Purpose

Permite ao docente consultar e manter os próprios dados cadastrais.

## ADDED Requirements

### Requirement: Consulta da conta do docente

O sistema SHALL expor `GET /account/me`, restrito ao papel `PROFESSOR`, resolvendo o docente pelo `sub` do token. A resposta SHALL conter `name`, `email` (do login), `department`, `phone` (vazio quando nulo), `tutorialSeen` e, só quando existir, `photo`.

#### Scenario: Docente autenticado

- **WHEN** um docente com token válido consulta a rota
- **THEN** o sistema responde `200` com os seus dados

#### Scenario: Sem token

- **WHEN** a requisição não traz token Bearer válido
- **THEN** o sistema responde `401`

#### Scenario: Papel errado

- **WHEN** uma organização consulta a rota
- **THEN** o sistema responde `403`

### Requirement: Atualização da conta do docente

O sistema SHALL expor `PATCH /account/me`, restrito ao papel `PROFESSOR`, aceitando parcialmente `name`, `department`, `phone`, `photo` e `tutorialSeen`, e SHALL devolver a conta completa. `photo` SHALL ser uma data URL de imagem (png, jpeg, webp ou gif), ou texto vazio para remover. O `email` SHALL NOT ser aceito.

#### Scenario: Telefone, foto e tutorial

- **WHEN** o docente envia `phone`, `photo` em data URL e `tutorialSeen: true`
- **THEN** o sistema responde `200` e a consulta seguinte devolve os valores gravados

#### Scenario: Remover foto

- **WHEN** o docente envia `photo: ""`
- **THEN** a resposta não contém `photo`

#### Scenario: Foto inválida

- **WHEN** `photo` não é uma data URL de imagem
- **THEN** o sistema responde `400` com "A foto precisa ser uma imagem."
