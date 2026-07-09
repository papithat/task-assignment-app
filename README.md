# Task Assignment Application

A task assignment platform where tasks (and nested subtasks) are matched to developers by required skill, with Gemini-based auto-classification when skills aren't specified.

A full-stack Task Assignment app built for the xDigital AI Products Team.

- **Frontend:** TypeScript + React (Vite)
- **Backend:** TypeScript + Node.js + Express
- **Database:** PostgreSQL
- **LLM integration:** Google Gemini (free tier) for automatic skill classification, with a keyword-based fallback so the app works with zero external setup

## Quick start (Docker)

Requires Docker and Docker Compose.

Credentials are **not** stored as plaintext in `docker-compose.yml`. They're read from files under `secrets/` at container start, using Docker's file-based secrets (`*_FILE` env var convention) — this works with plain `docker compose`, no Swarm mode required.

```bash
# secrets/*.txt are gitignored; defaults are provided so this runs out of the box
cat secrets/postgres_password.txt   # empty by default -> provide the postgres password
cat secrets/gemini_api_key.txt      # empty by default -> provide the Gemini API key

docker-compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:4000/api
- Postgres: localhost:5432 (user: `postgres`, password: contents of `secrets/postgres_password.txt`, db: `task_assignment`)

### How the secrets wiring works

- `docker-compose.yml` declares two file-based secrets (`postgres_password`, `gemini_api_key`), each mounted read-only into its container at `/run/secrets/<name>`.
- The `postgres` service is given `POSTGRES_PASSWORD_FILE` instead of `POSTGRES_PASSWORD` — the official Postgres image supports reading the password from a file directly.
- The `backend` service gets `PGPASSWORD_FILE` and `GEMINI_API_KEY_FILE`. A small helper (`backend/src/secrets.ts`) reads those files at startup and sets the corresponding plain env var (`PGPASSWORD`, `GEMINI_API_KEY`) in-process — `node-postgres` then picks up `PGHOST`/`PGUSER`/`PGPASSWORD`/`PGDATABASE` automatically.
- Nothing sensitive appears in `docker-compose.yml`, `docker inspect`, or `docker-compose config` output — only file paths do.

**To change the password:** edit `secrets/postgres_password.txt` before first bringing the stack up (Postgres only sets the password on first cluster initialization; if you change it after the `pgdata` volume already exists, run `docker-compose down -v` first to reset the volume, or update the password inside the running container manually).

**Note on "encryption":** this isn't encryption exactly — the secret files sit on disk in plaintext, just outside the compose file. For genuine encryption at rest, use Docker Swarm secrets (encrypted in the Swarm raft log), a vault (HashiCorp Vault, AWS Secrets Manager, etc.), or `git-crypt`/`sops` if committing an encrypted version of the secrets files. The file-based approach here solves the more common problem: keeping credentials out of source control and out of the compose file itself.

The database is automatically migrated and seeded on backend startup with:

| Developer | Skills              |
|-----------|---------------------|
| Alice     | Frontend            |
| Bob       | Backend             |
| Carol     | Frontend, Backend   |
| Dave      | Backend             |

### Enabling real LLM skill classification

By default `secrets/gemini_api_key.txt` is empty, so the backend uses a simple keyword-based fallback classifier (still fully functional, just less "smart"). To use the real Gemini API:

1. Get a free API key at https://aistudio.google.com/apikey
2. Put it in `secrets/gemini_api_key.txt` (no quotes, no trailing newline needed)
3. Re-run `docker-compose up --build`

## Running without Docker (local dev)

**Postgres:** run your own instance and create a `task_assignment` database, or just run `docker-compose up postgres`.

**Backend:**
```bash
cd backend
cp .env.example .env   # edit DATABASE_URL / GEMINI_API_KEY as needed
npm install
npm run dev
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```
Then open http://localhost:5173. The frontend defaults to calling the backend at `http://localhost:4000/api` (see `VITE_API_BASE_URL` in `frontend/vite.config.ts` usage / `.env`).

## Project structure

```
backend/
  src/
    db/            schema.sql, seed.sql, connection pool + migration runner
    routes/        tasks.ts, developers.ts, skills.ts (Express routers)
    services/      taskService.ts (business logic), llmSkillClassifier.ts
    types.ts
    secrets.ts
    index.ts       app entrypoint
frontend/
  src/
    pages/         TaskListPage.tsx, TaskCreationPage.tsx
    components/    TaskRow.tsx (recursive), SubtaskForm.tsx (recursive)
    api.ts         typed fetch client
    types.ts
secrets/
  gemini_api_key.
  postgres_password.txt
docker-compose.yml
```

## Data model

- **developers** (id, name)
- **skills** (id, name) — not unique to a developer; many-to-many via `developer_skills`
- **tasks** (id, title, status, `parent_task_id` self-reference for subtasks, `assigned_developer_id`)
- **task_skills** — many-to-many between tasks and skills

Subtasks are simply tasks whose `parent_task_id` points at another task, so subtasks can be nested arbitrarily deep (subtasks of subtasks, etc.) using the same table and the same business rules.

## Business rules implemented

1. **Assignment requires matching skills.** A task can only be assigned to a developer who has *all* the skill(s) the task requires (checked in `taskService.assignDeveloper`). If no eligible developer exists, the dropdown shows "No developer has the required skill(s)".
2. **"Done" requires all subtasks to be "Done".** Enforced server-side in `taskService.updateTaskStatus` using a recursive SQL query over all descendants; attempting to mark a task "Done" while any subtask isn't "Done" returns a 409 error with an explanation.
3. **Automatic skill classification.** When a task (or subtask) is created without any skills explicitly selected, the backend calls the LLM classifier (`services/llmSkillClassifier.ts`) to infer `Frontend`, `Backend`, or both from the title, before saving.
4. **Nested subtask creation in one request.** The Task Creation page lets you add subtasks and nested subtasks dynamically (mirroring the wireframe's "Add Subtask" button), and submits the whole tree in a single `POST /api/tasks` call, which the backend inserts recursively inside one transaction.

## API reference

| Method | Path                | Description |
|--------|---------------------|--------------|
| POST   | `/api/tasks`        | Create a task, optionally with nested `subtasks` and/or `skillIds`. Skills are auto-classified via LLM if omitted. |
| GET    | `/api/tasks`        | List all top-level tasks with their full subtask tree. |
| GET    | `/api/tasks/:id`    | Get a single task and its subtask tree. |
| PATCH  | `/api/tasks/:id`    | Update `assignedDeveloperId` and/or `status`. |
| GET    | `/api/developers`   | List developers with their skills. |
| GET    | `/api/skills`       | List all skills. |

Example create request:
```json
POST /api/tasks
{
  "title": "As a visitor, I want to see a responsive homepage...",
  "subtasks": [
    { "title": "Build responsive nav bar" },
    { "title": "Build homepage API endpoint", "skillIds": [2] }
  ]
}
```

## Notes / assumptions

- Status values are `To-do`, `In Progress`, `Done` (the test only specified "To-do", "Done", "etc.", so an intermediate state was added as a reasonable default; this can be trimmed to just two states if preferred).
- A developer must have **all** skills a task requires to be assignable (not just any one of them), matching the "Frontend, Backend" example in the spec.
- If the Gemini API call fails for any reason (no key, network error, quota), the backend transparently falls back to the keyword classifier rather than failing task creation.
