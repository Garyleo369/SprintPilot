# SprintPilot 🚀

SprintPilot is an intelligent agile sprint and task planning assistant built with a modern JavaScript full-stack architecture.

---

## Tech Stack (Current & Roadmap)

- **Frontend**: React + Vite (JavaScript)
- **Backend**: Node.js + Express (JavaScript, ES Modules)
- **Database**: SQLite (*coming in subsequent step*)
- **MCP Server**: Node.js Model Context Protocol Server (*coming in subsequent step*)
- **AI Integration**: Claude API (*coming in subsequent step*)

---

## Project Structure

```text
sprintpilot/
├── backend/
│   ├── src/
│   │   └── index.js          # Express app & /api/health endpoint
│   ├── .env.example          # Sample environment configuration
│   └── package.json          # Backend dependencies & scripts
├── frontend/
│   ├── src/
│   │   ├── App.jsx           # SprintPilot dashboard & health check probe
│   │   ├── main.jsx          # React DOM entry point
│   │   └── index.css         # Styling
│   ├── index.html            # HTML shell
│   ├── vite.config.js        # Vite configuration
│   └── package.json          # Frontend dependencies & scripts
├── .gitignore                # Root gitignore (node_modules, .env, dist, *.db)
└── README.md                 # Project documentation and startup guide
```

---

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended, v20+ / v24 tested)
- npm (v9+)

---

## Installation

### 1. Install Backend Dependencies

```bash
cd backend
npm install
```

### 2. Install Frontend Dependencies

```bash
cd ../frontend
npm install
```

---

## Local Startup Instructions

To run the application locally, you will start the Express backend and the Vite React frontend in separate terminal windows.

### Terminal 1: Start Express Backend

```bash
cd backend
npm run dev
```

> **Backend Server**: Starts at `http://localhost:5000`  
> *(Alternative production start: `npm start`)*

### Terminal 2: Start Vite Frontend

```bash
cd frontend
npm run dev
```

> **Frontend Application**: Starts at `http://localhost:5173`

---

## API Endpoints

### Health Check

- **URL**: `/api/health`
- **Method**: `GET`
- **Response**:
  ```json
  {
    "status": "ok"
  }
  ```

---

## CORS Configuration

The backend Express server is configured with CORS to accept requests from the Vite React development server:
- `http://localhost:5173`
- `http://127.0.0.1:5173`
- Configurable via `CLIENT_URL` environment variable in `backend/.env`.

