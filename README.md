# SprintPilot

A local, single-user project management MVP built on the existing React + Vite frontend, Express backend, SQLite database and Node.js MCP server. The dark dashboard shows real project/task data and progress. All application code is JavaScript.

## Features

- Create, view, edit and delete projects and tasks. Project deletion cascades to its tasks and asks for confirmation.
- Assign tasks to projects; set descriptions, due dates, status (To Do, In Progress, Done) and priority (Low, Medium, High, Urgent).
- Search titles and descriptions; filter by project, status or priority; sort by creation date, due date or priority. Project cards open scoped task views and show completion progress.
- Validated REST APIs and SQLite persistence. The dashboard includes responsive loading, empty and error states.
- Seven real MCP stdio tools work independently of any AI credential. Optional Hugging Face assistant uses those tools through an MCP client for factual queries, task changes, summaries and task breakdown. Task deletion needs explicit confirmation.

## Quick start

Install **Node.js 24+** and npm. From the repository root:

```sh
npm ci
npm run setup
```

On Windows PowerShell, optionally run `Copy-Item backend/.env.example backend/.env`; on macOS/Linux use `cp backend/.env.example backend/.env`. Leave `HF_TOKEN` blank for a disconnected AI assistant. SQLite uses Node's built-in `node:sqlite`, so no separate SQLite install is required.

Run two terminals at the repository root:

```sh
npm run dev:backend
```

```sh
npm run dev:frontend
```

Open [http://localhost:5173](http://localhost:5173). The database starts empty: create a project, add tasks, then change statuses to see progress. `npm run dev` alone is not defined; use both commands. For a single production server, run `npm run build && npm start` and open [http://localhost:5000](http://localhost:5000).

## Configuration and security

| `backend/.env` variable | Purpose |
| --- | --- |
| `HF_TOKEN` | Hugging Face access token; optional; never put it in frontend configuration |
| `HF_MODEL` | Defaults to `openai/gpt-oss-120b:cerebras` |
| `PORT` | Express port; default `5000` |
| `HOST` | Bind address; default `127.0.0.1` |
| `CLIENT_URL` | Allowed dev frontend origin; default `http://localhost:5173` |
| `DATABASE_PATH` | Absolute path to a shared SQLite database; default `backend/data/sprintpilot.db` |

Only put the token in your local `backend/.env`. `.env` variants and SQLite files are git-ignored; `.env.example` contains placeholders. Never use `VITE_` for secrets. The browser calls Express, and only Express sends the Bearer token to Hugging Face. The MCP child process does not receive the token. The assistant's configured status means a token exists, **not** that the provider has accepted it. Missing/invalid credentials and provider outages return safe errors.

This is a local single-user MVP without accounts or authentication. Keep `HOST=127.0.0.1`; add authentication and rate controls before deploying or exposing its REST or AI endpoints to other users. The MCP server uses local stdio and is not a public HTTP service.

## AI and MCP architecture

```text
React → Express /api/ai/chat → Hugging Face Inference Providers
                                   ↓ tool calls
                            MCP SDK client → local stdio MCP server
                                             ↓ shared service → SQLite
```

The backend uses Hugging Face's OpenAI-compatible chat-completions endpoint. `HF_MODEL` is configurable; the default provider/model has documented tool-call support, but model availability and account quota depend on your Hugging Face account. The assistant discovers MCP tools, passes schemas to the model, validates requested arguments, executes the tools, and returns results to the model for a final reply. Successful mutations are returned in `operations`, and the frontend refreshes data after changes. It never treats plain model text as proof of a mutation. Deletion is held pending for a five-minute explicit browser confirmation. Project deletion remains a dashboard action.

**Live Hugging Face inference was not tested without a user token.** Automated tests mock the provider's tool-call messages but use an actual MCP client/server and SQLite database. If your provider does not return usable tool calls, the assistant reports that no workspace changes were made; use the dashboard controls or choose a compatible model. Chat history exists only in the current browser session; each request contains its own prompt and the tools discover current database state.

Run the MCP server separately for another MCP client:

```sh
npm run mcp
```

It waits on stdio. A client configuration can use `{"mcpServers":{"sprintpilot":{"command":"node","args":["/absolute/path/to/SprintPilot/mcp-server/index.js"]}}}`. On Windows, forward slashes in the absolute path work in JSON. Set `DATABASE_PATH` in the client environment to the same absolute path as Express if you override it.

| MCP tool | Behavior |
| --- | --- |
| `list_projects` | List projects and IDs |
| `list_tasks` | List, search, filter and sort tasks |
| `create_task` | Persist a new task |
| `update_task` | Change task fields |
| `update_task_status` | Change status |
| `delete_task` | Delete a task |
| `get_project_summary` | Real status counts and completion percentage |

## REST API

All routes start with `/api`. JSON validation errors return `{ "error": "..." }` with an appropriate status. POST returns 201, PATCH returns the updated row and DELETE returns 204.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Server status |
| GET, POST | `/projects`, `/tasks` | List/create records |
| GET, PATCH, DELETE | `/projects/:id`, `/tasks/:id` | Read/update/delete records |
| GET | `/ai/status` | Provider configuration state, no credential |
| POST | `/ai/chat` | `{ "message": "..." }` → reply, successful operations, changed flag, optional pending deletion |
| POST | `/ai/confirm` | `{ "id": "pending-confirmation-id" }` → confirmed deletion |

`GET /tasks` supports `project_id`, `status`, `priority`, `search`, `sort_by` (`created_at`, `due_date`, `priority`) and `order` (`asc`, `desc`). Status values are `backlog`, `in_progress`, `done`; the UI calls `backlog` “To Do”. Due dates use real `YYYY-MM-DD` dates. Unknown fields, invalid IDs and dates are rejected. SQLite foreign keys cascade project deletion. The service and MCP process access the same database path.

## Verification and demo

```sh
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

The Node tests cover REST CRUD/validation/persistence, real MCP stdio discovery and execution, and a mocked provider round trip through real MCP into SQLite, including deletion confirmation and safe provider errors. The browser test covers dashboard CRUD, persistence after reload, filters, progress, dialogs, disconnected AI and mobile layout. The browser test needs Playwright Chromium installed. GitHub Actions runs these checks and uploads dashboard screenshots. To demo manually, create a project, add multiple priority and status tasks, filter/sort them, click its project card, and open the AI Assistant; with a local `HF_TOKEN`, try a task query and creation request, then verify the task appears in the dashboard.

## Limitations

There is no multi-user authentication, hosted deployment, live credential verification in automated tests, or long-term AI conversation history. Model tool support may vary by provider and account. For public use, add authentication, request limits and deployment hardening. Future improvements include project-level MCP deletion with confirmation, recurring tasks and team collaboration.
