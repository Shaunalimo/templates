# REST API Starter

Express CRUD API with a JSON-file `tasks` store at `lib/data/tasks.json`. Pre-seeded with 10 realistic sample records on first boot — writes survive container restarts (EFS-persisted).

## Endpoints

| Method | Path             | Description                                  |
| ------ | ---------------- | -------------------------------------------- |
| GET    | `/health`        | Liveness probe                               |
| GET    | `/api/tasks`     | List tasks (`?limit`, `?offset`, `?status`)  |
| GET    | `/api/tasks/:id` | Get one task                                 |
| POST   | `/api/tasks`     | Create a task (`{ title, status, priority }`)|
| PUT    | `/api/tasks/:id` | Update a task (partial body OK)              |
| DELETE | `/api/tasks/:id` | Delete a task                                |

`/` serves a docs page listing every endpoint with sample requests/responses.

## Start it locally

```bash
npm install
npm start
```

## Try it

```bash
curl http://localhost:3000/api/tasks
curl -X POST http://localhost:3000/api/tasks \
  -H 'Content-Type: application/json' \
  -d '{"title":"Try the API"}'
curl -X DELETE http://localhost:3000/api/tasks/1
```

## What to ask the agent

JSON-file persistence works for small workloads. When you outgrow it, ask the agent to migrate `lib/store.js` to managed Postgres — that's the swap point. The route handlers only depend on the exported function signatures, so the change is contained to one file.

Other extensions: add new resources (`/api/users`, `/api/projects`) using the same pattern, or add auth via an API key middleware.
