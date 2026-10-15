# Spec Delta

## Purpose

Alimenta o autocomplete de competências do formulário de disciplina.

## ADDED Requirements

### Requirement: Catálogo de competências

O sistema SHALL expor `GET /skills/catalog`, autenticado, retornando `string[]` com os nomes de `Skill`, em ordem alfabética.

#### Scenario: Catálogo
- **WHEN** existem competências cadastradas
- **THEN** a resposta é um array de strings com os nomes

#### Scenario: Sem autenticação
- **WHEN** não há token
- **THEN** responde `401`
