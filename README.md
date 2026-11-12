# SprintPilot

A focused, Linear-inspired project workspace built on the original React + Vite frontend and Node.js + Express backend. All application code is JavaScript.

## What works

- Responsive dark overview, project cards, live completion metrics and progress bars.
- Create, view, edit and delete projects and tasks through accessible native dialog modals. Project deletion requires confirmation and deletes its tasks.
- Task search, project/status filters, priorities, due dates and inline status updates.
- Validated REST APIs, structured errors and persistent SQLite storage.
- A separate Node.js MCP process exposing real task tools through the official MCP SDK's stdio transport.
- A Claude planning assistant with workspace context. Without an API key it explicitly stays disconnected, disables chat, and returns HTTP 503 rather than fabricated responses.

This is a **local, single-user MVP**. It has no accounts, authorization, multi-user collaboration, notifications or deployment hardening. The server binds to `127.0.0.1` by default. Add authentication and deployment controls before exposing it publicly.

## Quick start

Use **Node.js 24+** and npm. Node's built-in `node:sqlite` stores the data; no database installation or native npm database module is needed.

From the repository root:

```sh
npm ci
npm run setup
```

Optional: copy `backend/.env.example` to `backend/.env`. Defaults work without it. For Windows PowerShell use `Copy-Item backend/.env.example backend/.env`; on macOS/Linux use `cp backend/.env.example backend/.env`.

Start two terminals from the repository root:

```sh
# Terminal 1: Express API at http://localhost:5000
npm run dev:backend
```

```sh
# Terminal 2: React at http://localhost:5173
npm run dev:frontend
```

Open **http://localhost:5173**. Create your first project, add tasks, and change their status to see progress update. The initial database is empty; there are no fake records or automatic demo data.

To run the production build locally:

```sh
npm run build
npm start
```

Open **http://localhost:5000**. Express serves the built frontend and `/api` on the same origin. Restart the backend if you build the frontend after starting it for the first time.

## Configuration

| Backend variable | Default / purpose |
| --- | --- |
| `PORT` | `5000` |
| `HOST` | `127.0.0.1`; local access only |
| `CLIENT_URL` | `http://localhost:5173`; permitted frontend origin |
| `DATABASE_PATH` | Absolute repository-relative default: `backend/data/sprintpilot.db`. If overriding, use an **absolute filesystem path** shared by the API and MCP processes. |
| `ANTHROPIC_API_KEY` | Optional server-side Claude credential; empty means disconnected |
| `CLAUDE_MODEL` | `claude-sonnet-4-5`; override with an available model for your account |

`backend/.env` is loaded from its own directory even when starting MCP from another directory. Environment variables take precedence. SQLite uses foreign keys, WAL and a busy timeout so the API and MCP can access the same database. Data survives application restarts. Back up the database with a SQLite-aware backup tool or while both processes are stopped.

The optional `frontend/.env.example` documents `VITE_API_URL`. Leave it unset for the Vite proxy and same-origin production server. If the API port changes, also update the Vite proxy target (or set `VITE_API_URL` and the appropriate backend `CLIENT_URL`). **Never put API keys in `VITE_*` variables**; those become public browser code. Local `.env` files and databases are ignored by git.

## Claude assistant

1. Put `ANTHROPIC_API_KEY` in `backend/.env` (never commit it).
2. Set `CLAUDE_MODEL` if your account requires another model.
3. Restart the backend and reload the UI.
4. Open **AI Assistant** and ask about your tasks.

“Claude configured” means a credential is present, **not that it has been verified**. Authentication, quota, unavailable-model, timeout and network failures are reported as errors. No live Claude call has been verified in this environment because no credential was available. Adapter tests use an explicitly mocked HTTP transport.

Each request sends the question plus a bounded snapshot of up to 50 projects and 200 tasks (newest first, descriptions truncated to 300 characters) to Anthropic. The model receives total counts so it can recognize truncation. Chat history is session-only and previous messages are not sent to the provider. The assistant provides read-only advice; it cannot create or modify tasks through the web chat. MCP writes are a separate, independently usable integration. One assistant request runs at a time, output is bounded, and provider requests time out after 30 seconds.

## MCP server

The MCP server is a separate process using the official `@modelcontextprotocol/sdk`, **not** an HTTP route with an MCP label. REST and MCP both call `backend/src/service.js`, so validation, database access and business rules are shared. MCP does not require a Claude API key.

```sh
npm run mcp
# Or: node /absolute/path/to/SprintPilot/mcp-server/index.js
```

A stdio server waits for an MCP client; it does not open a web page. For a stdio-compatible client, configure:

```json
{
  "mcpServers": {
    "sprintpilot": {
      "command": "node",
      "args": ["/absolute/path/to/SprintPilot/mcp-server/index.js"]
    }
  }
}
```

Use your real absolute path; on Windows a JSON path can use forward slashes such as `C:/Users/you/SprintPilot/mcp-server/index.js`. If overriding the database path, supply `DATABASE_PATH` in the client's `env` with the same absolute path as the backend.

| Tool | Required arguments | Optional arguments |
| --- | --- | --- |
| `list_projects` | none | none |
| `list_tasks` | none | `project_id`, `status`, `priority`, `search` |
| `create_task` | `project_id`, `title` | `description`, `status`, `priority`, `due_date` |
| `update_task` | `id`, at least one changed field | Same task fields as creation |

Create a project through the dashboard or REST first, then use `list_projects` to discover its ID. MCP writes persist immediately. Reload the dashboard to see changes made by another process. stdout is reserved for MCP JSON-RPC; diagnostics go to stderr.

## REST API

All endpoints use `/api`. Create/update requests use `Content-Type: application/json`. Errors return `{ "error": "message" }` with HTTP 400, 403, 404, 413, 429, 502 or 503 as appropriate; unexpected server errors return a sanitized 500 response.

| Method | Endpoint | Behavior |
| --- | --- | --- |
| GET | `/health` | `{ "status": "ok" }` |
| GET / POST | `/projects` | List / create a project |
| GET / PATCH / DELETE | `/projects/:id` | Read / partially update / delete, cascading tasks |
| GET / POST | `/tasks` | List / create a task |
| GET / PATCH / DELETE | `/tasks/:id` | Read / partially update / delete |
| GET | `/ai/status` | Credential-presence status, provider and model; no secrets |
| POST | `/ai/chat` | `{ "message": "Plan my next sprint" }` → `{ "reply", "model" }` |

Task filters: `?project_id=1&status=done&priority=high&search=dashboard`.

Project fields: `name` (required, 1–160 trimmed characters), `description` (up to 4000).

Task fields: `project_id` (existing project), `title` (required, 1–160 trimmed characters), `description` (up to 4000), `status` (`backlog`, `in_progress`, `done`), `priority` (`low`, `medium`, `high`, `urgent`), `due_date` (real `YYYY-MM-DD` date, `null` or empty to clear). Defaults: backlog, medium, no due date. IDs must be positive safe integers. Unknown body fields, invalid enums, empty updates, malformed JSON and nonexistent parent records are rejected. Successful POST returns 201, PATCH returns the updated record, and DELETE returns 204.

## Verification

```sh
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
# All of the above except browser installation:
npm run check
```

- `npm test`: Node's built-in test runner verifies REST CRUD, filters, invalid inputs, malformed/oversized JSON, origin rejection, cascade deletion, database reopening, the disconnected AI state and mocked Claude request/error handling.
- The MCP integration test spawns a real stdio child process, negotiates the protocol, discovers tools, creates/updates tasks, rejects invalid inputs and confirms API-service visibility through shared SQLite.
- `test:e2e` starts the built app on an isolated test port with a temporary database and uses Playwright to cover project/task CRUD, status/progress, reload persistence, search/filters, modal dismissal, disconnected AI, project cascade deletion, console errors and mobile overflow.
- GitHub Actions runs lint, API/MCP tests, build and the browser workflow and uploads dashboard screenshots. No secrets are needed for CI.

If a preinstalled Chromium must be used, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable. Set `QA_SCREENSHOT_DIR` to an existing directory to retain test screenshots. On Linux CI, install browser OS dependencies with `npx playwright install --with-deps chromium`.

Verified in [GitHub Actions run 43172187483](https://github.com/Garyleo369/SprintPilot/actions/runs/43172187483): clean installation, lint (0 warnings/errors), all 7 API/persistence/AI-adapter/MCP test groups, the production build and the real Chromium browser workflow passed. The browser workflow verified project/task CRUD, reload persistence, progress, filters, modals, disconnected AI and mobile overflow with no browser errors; desktop/mobile screenshots are attached to that run. Local lint, API/MCP tests and build also passed; local browser startup was restricted by the agent host, so browser verification was performed in CI. Live Claude behavior remains unverified until a real credential is configured.

## Architecture

```text
frontend/                 Existing React + Vite application
  src/App.jsx             Dashboard, project/task views, dialogs and assistant
  src/api.js              Shared JSON request/error handling
backend/                  Existing Express application
  src/index.js            Environment configuration and server lifecycle
  src/app.js              REST routes, origin checks, errors and built frontend hosting
  src/service.js          Shared validation and SQLite business logic
  src/ai.js               Claude Messages API adapter
  src/mcp.js              MCP SDK tool registration and stdio transport
  test/                   REST, persistence, AI adapter and MCP protocol tests
mcp-server/index.js       Standalone Node.js MCP entry point
test/browser.test.js      Production-build browser workflow
```

The original frontend/backend packages and entry points are preserved. New runtime dependencies are limited to the MCP SDK and its schema validator, Zod. Claude uses Node's built-in `fetch`; SQLite uses `node:sqlite`. Playwright is a development-only dependency.
