# Spec Delta

## Purpose

Porta de entrada da Plataforma LEI: permite que estudantes, docentes e parceiros criem conta, autentiquem-se com e-mail e senha, e sejam identificados em cada requisição por um token JWT que carrega seu papel. Nenhuma outra funcionalidade da plataforma é acessível sem passar por aqui.

## ADDED Requirements

### Requirement: Registro de estudante

O sistema SHALL expor `POST /auth/register/student`, aceitando `email`, `password`, `name` e `registrationNumber`, e SHALL criar o usuário e o perfil de estudante de forma atômica: ou ambos são persistidos, ou nenhum é.

#### Scenario: Registro bem-sucedido de estudante

- **WHEN** a requisição traz um `email` ainda não cadastrado, um `registrationNumber` ainda não cadastrado e os demais campos válidos
- **THEN** o sistema responde `201` com um corpo contendo `user` e `accessToken`
- **AND** o usuário é persistido com papel de estudante e com a senha armazenada como hash
- **AND** o perfil de estudante é persistido vinculado a esse usuário, com o `name` e o `registrationNumber` informados

#### Scenario: Falha na criação do perfil não deixa usuário órfão

- **WHEN** a persistência do perfil de estudante falha após o usuário ter sido criado na mesma operação
- **THEN** o sistema não deixa nenhum usuário persistido para aquele e-mail

### Requirement: Registro de docente

O sistema SHALL expor `POST /auth/register/professor`, aceitando `email`, `password` e `name`, e SHALL criar o usuário e o perfil de docente de forma atômica. Campos do perfil que possuem valor padrão na persistência SHALL NOT ser aceitos na requisição.

#### Scenario: Registro bem-sucedido de docente

- **WHEN** a requisição traz um `email` ainda não cadastrado e os demais campos válidos
- **THEN** o sistema responde `201` com um corpo contendo `user` e `accessToken`
- **AND** o usuário é persistido com papel de docente e o perfil de docente é persistido vinculado a ele

#### Scenario: Campo com valor padrão é rejeitado

- **WHEN** a requisição inclui um campo de perfil que não faz parte do contrato do endpoint
- **THEN** o sistema responde `400` sem criar usuário nem perfil

### Requirement: Registro de parceiro

O sistema SHALL expor `POST /auth/register/partner`, aceitando `email`, `password`, `name` e `type`, e SHALL criar o usuário e o perfil de parceiro de forma atômica. O campo `type` SHALL trafegar exatamente com os valores do tipo de parceiro usados na persistência, sem tradução, e SHALL estar documentado com seus valores possíveis.

#### Scenario: Registro bem-sucedido de parceiro

- **WHEN** a requisição traz um `email` ainda não cadastrado e um `type` válido
- **THEN** o sistema responde `201` com um corpo contendo `user` e `accessToken`
- **AND** o usuário é persistido com papel de parceiro e o perfil de parceiro é persistido vinculado a ele, com o `type` informado

#### Scenario: Tipo de parceiro inválido

- **WHEN** a requisição traz um `type` fora dos valores aceitos
- **THEN** o sistema responde `400` sem criar usuário nem perfil

### Requirement: E-mail único no registro

O sistema SHALL rejeitar o registro de um e-mail já cadastrado em qualquer um dos três endpoints de registro, respondendo `409` com mensagem explícita, e SHALL NOT deixar qualquer resíduo no armazenamento.

#### Scenario: E-mail já cadastrado

- **WHEN** um registro é feito com um `email` que já pertence a outro usuário
- **THEN** o sistema responde `409` com mensagem indicando que o e-mail já está cadastrado
- **AND** nenhum usuário ou perfil adicional é persistido

### Requirement: Matrícula única de estudante

O sistema SHALL rejeitar o registro de estudante cujo `registrationNumber` já esteja cadastrado, respondendo `409`.

#### Scenario: Matrícula já cadastrada

- **WHEN** um registro de estudante é feito com um `registrationNumber` que já pertence a outro estudante
- **THEN** o sistema responde `409`
- **AND** nenhum usuário ou perfil adicional é persistido

### Requirement: Login com e-mail e senha

O sistema SHALL expor `POST /auth/login`, aceitando `email` e `password`, e SHALL responder `200` — e não `201` — com `user` e `accessToken` quando as credenciais conferirem.

#### Scenario: Credenciais válidas

- **WHEN** a requisição traz um `email` cadastrado e a senha correspondente
- **THEN** o sistema responde com status `200`
- **AND** o corpo contém `user` e `accessToken`

#### Scenario: Senha incorreta

- **WHEN** a requisição traz um `email` cadastrado e uma senha que não corresponde
- **THEN** o sistema responde `401` com uma mensagem genérica de credenciais inválidas

#### Scenario: E-mail não cadastrado

- **WHEN** a requisição traz um `email` que não pertence a nenhum usuário
- **THEN** o sistema responde `401` com exatamente a mesma mensagem do cenário de senha incorreta, sem revelar que o e-mail não existe

### Requirement: Identificação do usuário autenticado

O sistema SHALL expor `GET /auth/me`, protegido por token Bearer, e SHALL resolver o usuário exclusivamente a partir do identificador contido no token, nunca a partir de dado enviado pelo cliente na requisição.

#### Scenario: Token válido

- **WHEN** a requisição traz um token Bearer válido de um usuário existente
- **THEN** o sistema responde `200` com o usuário correspondente ao identificador do token

#### Scenario: Token ausente, inválido ou expirado

- **WHEN** a requisição não traz token, ou traz um token malformado, com assinatura inválida ou expirado
- **THEN** o sistema responde `401`

#### Scenario: Identificador do token não é utilizável

- **WHEN** o token traz um identificador de usuário que não é um inteiro válido
- **THEN** o sistema responde `401`
- **AND** nenhum erro da camada de persistência vaza na resposta

#### Scenario: Usuário do token não existe mais

- **WHEN** o token é válido mas o usuário correspondente não existe mais
- **THEN** o sistema responde `401`

### Requirement: Formato da resposta de autenticação

Toda resposta de autenticação SHALL expor o usuário com `id` como string, `email`, `role` e, quando houver perfil, `name`. As respostas de registro e login SHALL adicionalmente conter `accessToken`. O `name` SHALL ser resolvido a partir do perfil do usuário (docente, estudante ou parceiro) e SHALL ser omitido quando o usuário não possuir perfil.

#### Scenario: Identificador é string

- **WHEN** qualquer endpoint de autenticação devolve um usuário
- **THEN** o campo `id` é uma string, mesmo que a persistência use um inteiro

#### Scenario: Nome vem do perfil

- **WHEN** o usuário autenticado possui perfil
- **THEN** o campo `name` da resposta é o nome registrado naquele perfil

#### Scenario: Usuário sem perfil

- **WHEN** o usuário autenticado não possui nenhum perfil associado
- **THEN** a resposta omite o campo `name`

### Requirement: Papel traduzido na borda da API

O sistema SHALL expor o papel do usuário em inglês — `STUDENT`, `PROFESSOR` ou `ORGANIZATION` — em toda resposta da API e dentro do token emitido, traduzindo-o a partir do papel usado na persistência. O contrato externo SHALL NOT conter nenhum papel que não tenha correspondente na persistência.

#### Scenario: Papel na resposta

- **WHEN** um estudante, docente ou parceiro se registra ou faz login
- **THEN** o `role` da resposta é, respectivamente, `STUDENT`, `PROFESSOR` ou `ORGANIZATION`

#### Scenario: Papel no token

- **WHEN** o sistema emite um token
- **THEN** o papel contido no token está em inglês, no mesmo formato da resposta

### Requirement: Segredo da senha nunca é exposto

O sistema SHALL armazenar a senha exclusivamente como hash e SHALL NOT incluir o hash da senha em nenhuma resposta da API. A exclusão do campo SHALL ser garantida na própria consulta à persistência, e não por filtragem na camada de serialização.

#### Scenario: Senha ausente em toda resposta

- **WHEN** qualquer endpoint de autenticação devolve um usuário
- **THEN** a resposta não contém o hash da senha nem a senha em texto puro

#### Scenario: Senha armazenada com hash

- **WHEN** um usuário é registrado
- **THEN** o valor persistido para a senha é diferente da senha enviada e não permite recuperá-la

### Requirement: Token aceito pelos guardas existentes

O token emitido SHALL conter o identificador do usuário, seu e-mail e seu papel traduzido, no formato que a estratégia de autenticação já existente no projeto consome, de modo que as rotas protegidas e a autorização por papel funcionem sem alteração.

#### Scenario: Token emitido é aceito em rota protegida

- **WHEN** um token obtido no registro ou no login é enviado a uma rota protegida
- **THEN** a requisição é autenticada e o usuário resolvido traz identificador, e-mail e papel

### Requirement: Validação e documentação do contrato

Todos os corpos de requisição SHALL ser validados, respondendo `400` quando inválidos, e todas as rotas e campos SHALL estar documentados na documentação OpenAPI publicada pela API, incluindo a exigência de token Bearer nas rotas protegidas. A documentação SHALL NOT declarar como opcional um campo que é obrigatório.

#### Scenario: Corpo inválido

- **WHEN** uma requisição de registro ou login traz campo obrigatório ausente, com tipo errado ou com campo não previsto
- **THEN** o sistema responde `400` com a mensagem de validação, sem criar nada

#### Scenario: Contrato publicado

- **WHEN** a documentação OpenAPI da API é consultada
- **THEN** os cinco endpoints de autenticação aparecem com seus campos de entrada, seus formatos de resposta e a indicação de token Bearer na rota de identificação
