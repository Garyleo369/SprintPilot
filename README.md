# SprintPilot

**Full-stack sprint planning assistant — React, Vite, Node.js and Express**

SprintPilot is a JavaScript full-stack project exploring how a sprint-planning dashboard communicates with a REST backend. This repository currently contains the **initial frontend/backend foundation**, including an API health check. The more advanced task management and AI/MCP features are part of the project's intended direction, but are **not present in this published branch**.

## Current implementation

- React + Vite frontend with a backend connectivity status view and a manual health-check button
- Express server exposing `GET /api/health`
- Configurable backend port and frontend CORS origin using environment variables
- Separate frontend and backend packages

## Architecture

```text
Browser
  |
  v
React + Vite frontend (localhost:5173)
  |
  | GET /api/health
  v
Node.js + Express API (localhost:5000)
  |
  v
{ "status": "ok" }
```

## Run locally

**Requirements:** Node.js and npm.

Terminal 1 — backend:

```bash
cd backend
npm install
npm run dev
```

Terminal 2 — frontend:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The UI checks the backend at http://localhost:5000/api/health.

The backend reads `PORT` and `CLIENT_URL` from environment variables. See [backend/.env.example](backend/.env.example).

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Returns `{ "status": "ok" }` when the API is running |

## Repository structure

```text
backend/
  src/index.js       Express server and health endpoint
  .env.example       Example configuration
frontend/
  src/App.jsx        React status dashboard
  src/App.css        Component styling
  src/index.css      Global styling
README.md
```

## Planned extensions

- Persistent task and project management with SQLite
- Search, filtering, priorities, due dates and progress analytics
- MCP tools for structured task operations
- Local AI-assisted task workflows and validation

> **Implementation note:** These are planned capabilities for this published repository, not claims about the current code. If you have a newer local version with SQLite, MCP and Ollama integrations, push it first and update this README to describe the actual implementation.

## Engineering focus

This foundation demonstrates the separation of client and server responsibilities, local development configuration, REST connectivity and frontend handling of API loading/error states.

## License

No license file is currently included. All rights reserved unless a license is added.
