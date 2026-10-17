# Spec Delta

## Purpose

Fecha o cadastro institucional: docente só com e-mail da UFPE e com departamento, e organização parceira com local e ponto focal.

## MODIFIED Requirements

### Requirement: Registro de docente

O sistema SHALL expor `POST /auth/register/professor`, aceitando `email`, `password`, `name` e `department`, e SHALL criar o usuário e o perfil de docente de forma atômica. O `email` SHALL terminar em `@ufpe.br` ou `@cin.ufpe.br`, sem diferenciar maiúsculas. O `department` SHALL ser obrigatório e persistido. Os demais campos do perfil que têm valor padrão na persistência SHALL NOT ser aceitos na requisição.

#### Scenario: Registro bem-sucedido de docente

- **WHEN** a requisição traz um `email` institucional ainda não cadastrado e os demais campos válidos
- **THEN** o sistema responde `201` com `user` e `accessToken`
- **AND** o perfil de docente é persistido com o `department` informado

#### Scenario: E-mail fora da UFPE

- **WHEN** o `email` não termina em `@ufpe.br` nem em `@cin.ufpe.br`
- **THEN** o sistema responde `400` com a mensagem "Use seu e-mail @ufpe.br ou @cin.ufpe.br." e nada é criado

#### Scenario: Departamento ausente

- **WHEN** a requisição não traz `department` ou o traz vazio
- **THEN** o sistema responde `400` e nada é criado

### Requirement: Registro de parceiro

O sistema SHALL expor `POST /auth/register/partner`, aceitando `email`, `password`, `name` (da organização), `type`, `location`, `focalName` e `focalRole`, todos obrigatórios. O sistema SHALL criar o usuário e o perfil de parceiro de forma atômica. O `type` SHALL trafegar com os valores do enum de persistência, sem tradução. O `name` da resposta SHALL ser o nome da organização.

#### Scenario: Registro bem-sucedido de parceiro

- **WHEN** a requisição traz um `email` ainda não cadastrado e todos os campos válidos
- **THEN** o sistema responde `201` com `user` e `accessToken`
- **AND** o parceiro é persistido com `location`, `focalName` e `focalRole` informados

#### Scenario: Ponto focal ausente

- **WHEN** a requisição não traz `location`, `focalName` ou `focalRole`
- **THEN** o sistema responde `400` e nada é criado
