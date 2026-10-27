# Spec Delta

## Purpose

Permite ao representante da organização manter a própria conta e o perfil institucional que os docentes veem.

## ADDED Requirements

### Requirement: Conta do representante

O sistema SHALL expor `GET` e `PATCH /org-portal/account`, restritos ao papel `ORGANIZATION`. A conta SHALL ter `organizationId`, `name`, `email` (do login), `position`, `phone` e `tutorialSeen`. `name` e `position` SHALL ser os campos `focalName` e `focalRole` do parceiro. O PATCH SHALL aceitar parcialmente `name`, `position`, `phone` e `tutorialSeen`.

#### Scenario: Conta recém-cadastrada

- **WHEN** a organização consulta a conta logo após o cadastro
- **THEN** `name` e `position` são o ponto focal e o cargo informados no cadastro

#### Scenario: Tutorial visto

- **WHEN** a organização envia `tutorialSeen: true`
- **THEN** a conta passa a ter `tutorialSeen: true` e os demais campos não mudam

### Requirement: Perfil institucional

O sistema SHALL expor `GET` e `PATCH /org-portal/profile`, restritos ao papel `ORGANIZATION`. A resposta SHALL ter o formato `{ organization, contact }`:

- `organization` traz `id`, `name`, `type` (enum), `location`, `about`, `audience`, `site`, `meetingCadence`, `onSiteVisit`, `history` e, quando existirem, `logo` e `cover`.
- `contact` traz `focalName`, `focalRole`, `email` e `channel`. O `email` SHALL ser `contactEmail` quando preenchido, e senão o e-mail do login.

O PATCH SHALL aceitar parcialmente os campos institucionais e `contact`. O `name` da organização SHALL NOT ser aceito.

#### Scenario: Edição persistida

- **WHEN** a organização envia os campos institucionais e um contato válido
- **THEN** o sistema responde `200` e a consulta seguinte devolve os valores gravados

#### Scenario: Contato inválido

- **WHEN** `contact.focalName` está vazio ou `contact.email` não é um e-mail
- **THEN** o sistema responde `400` e nada é gravado

### Requirement: Logo e capa

O sistema SHALL expor `PATCH /org-portal/profile/images`, restrito ao papel `ORGANIZATION`, aceitando `logo` e `cover` como data URL de imagem, ou texto vazio para remover, e SHALL devolver o perfil completo. O corpo SHALL aceitar imagens de até 2 MB de texto cada.

#### Scenario: Remover o logo

- **WHEN** a organização envia `logo: ""`
- **THEN** a resposta não contém `logo` e a `cover` continua a mesma

#### Scenario: Acesso de docente

- **WHEN** um docente chama qualquer rota de `/org-portal/account` ou `/org-portal/profile`
- **THEN** o sistema responde `403`
