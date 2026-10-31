# Plataforma LEI — API (Backend NestJS + Prisma + PostgreSQL)

API RESTful do **Laboratório de Experiências Inovadoras (L.E.I. — CIn/UFPE)** responsável pela gestão de usuários (Docentes e Organizações Parceiras), Calendário Acadêmico, Disciplinas, Cardápio de Demandas, Triagem, Reservas e Ciclo de Vida de Projetos em 6 etapas.

---

## 1. Execução Rápida com Docker Compose (Stack Completa Local)

Para subir o PostgreSQL e a API já compilada (com aplicação automática de migrations no entrypoint):

```bash
cp .env.example .env
docker compose up --build -d
```

- **API**: `http://localhost:3000`
- **Healthcheck**: `http://localhost:3000/health`
- **Swagger / OpenAPI**: `http://localhost:3000/api/docs`

> Caso queira popular o banco com dados iniciais de demonstração na subida do container, defina `RUN_SEED=true` no `.env` ou execute `npx prisma db seed`.

---

## 2. Desenvolvimento Local (Node.js no Host + Banco no Docker)

```bash
# 1. Subir apenas o container do PostgreSQL
docker compose up -d postgres

# 2. Instalar dependências e gerar o Prisma Client
npm install
npx prisma generate

# 3. Aplicar migrations e seed inicial
npx prisma migrate deploy
npx prisma db seed

# 4. Iniciar a API em modo watch
npm run start:dev
```

---

## 3. Scripts Disponíveis

| Script | Descrição |
| --- | --- |
| `npm run start:dev` | Inicia a API em modo watch |
| `npm run build` | Compila a aplicação para `dist/` |
| `npm run start:prod` | Executa o build de produção (`node dist/src/main.js`) |
| `npm run lint:check` | Valida regras do ESLint + Prettier (usado no CI) |
| `npm run lint` | Corrige problemas de lint automaticamente |
| `npm test` | Executa a suíte de testes unitários com Jest |

---

## 4. Arquitetura de Deploy na VM do CIn (Isolamento Físico de Diretórios)

Para garantir que **nenhum deploy automatizado da API ou do Frontend possa apagar ou afetar o banco de dados**, a infraestrutura na VM do CIn é dividida em **3 diretórios independentes**, comunicando-se pela rede Docker externa `plataforma_lei_net`:

1. **`/srv/plataforma-lei/db/` (Banco de Dados — Isolado do CI/CD)**:
   - Contém `docker-compose.db.yml` e o diretório persistente `/srv/plataforma-lei/db/pgdata`.
   - Inicializado uma única vez na VM:
     ```bash
     docker network create plataforma_lei_net
     mkdir -p /srv/plataforma-lei/db/pgdata
     cd /srv/plataforma-lei/db
     # Copie docker-compose.db.yml e crie o .env com POSTGRES_PASSWORD
     docker compose -f docker-compose.db.yml up -d
     ```
2. **`/srv/plataforma-lei/api/` (API NestJS — Alvo do CD deste repositório)**:
   - Contém apenas `docker-compose.prod.yml` e o `.env` de produção da API (`DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`).
   - Atualizado automaticamente via GitHub Actions (`.github/workflows/deploy.yml`) a cada push na `main`.
3. **`/srv/plataforma-lei/web/` (Frontend Nginx + React — Alvo do CD do repositório web)**:
   - Contém apenas o `docker-compose.prod.yml` do frontend, servindo a SPA na porta `80` e fazendo *reverse proxy* de `/api/*` para `http://plataforma_lei_api:3000/`.

### Secrets Necessários no GitHub (`Settings > Secrets and variables > Actions`)

| Secret | Descrição |
| --- | --- |
| `VM_HOST` | Endereço IP ou hostname da VM do CIn |
| `VM_USER` | Usuário SSH na VM do CIn |
| `VM_SSH_KEY` | Chave privada SSH para conexão na VM |
| `VM_SSH_PORT` | *(Opcional)* Porta SSH (padrão `22`) |
| `VM_API_DIR` | *(Opcional)* Caminho do diretório da API na VM (padrão `/srv/plataforma-lei/api`) |
