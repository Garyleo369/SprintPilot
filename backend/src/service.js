import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
export const defaultDbPath = fileURLToPath(
  new URL("../data/sprintpilot.db", import.meta.url),
);
export const STATUSES = ["backlog", "in_progress", "done"];
export const PRIORITIES = ["low", "medium", "high", "urgent"];
export class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
function fail(message) {
  throw new AppError(400, message);
}
export function validId(value) {
  if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value)))
    fail("ID must be a positive integer");
  return Number(value);
}
function text(value, name, max, required = false) {
  if (typeof value !== "string") fail(`${name} must be a string`);
  const result = value.trim();
  if (required && !result) fail(`${name} is required`);
  if (result.length > max) fail(`${name} must be at most ${max} characters`);
  return result;
}
function object(data, allowed) {
  if (!data || typeof data !== "object" || Array.isArray(data))
    fail("Body must be a JSON object");
  if (Object.keys(data).some((k) => !allowed.includes(k)))
    fail("Unknown field in request");
  if (!Object.keys(data).length) fail("At least one field is required");
}
function date(value) {
  if (value === null || value === "") return null;
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    fail("due_date must be a valid YYYY-MM-DD date");
  return value;
}
export function createService(
  path = process.env.DATABASE_PATH || defaultDbPath,
) {
  if (path !== ":memory:")
    mkdirSync(dirname(resolve(path)), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'backlog' CHECK(status IN ('backlog','in_progress','done')),
      priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low','medium','high','urgent')), due_date TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    ); CREATE INDEX IF NOT EXISTS tasks_project_id ON tasks(project_id);`);
  const get = (table, id) => {
    const row = db
      .prepare(`SELECT * FROM ${table} WHERE id=?`)
      .get(validId(id));
    if (!row)
      throw new AppError(
        404,
        `${table === "tasks" ? "Task" : "Project"} not found`,
      );
    return row;
  };
  function validate(data, type, partial) {
    const task = type === "tasks";
    object(
      data,
      task
        ? [
            "project_id",
            "title",
            "description",
            "status",
            "priority",
            "due_date",
          ]
        : ["name", "description"],
    );
    const clean = {};
    const title = task ? "title" : "name";
    if (!partial || title in data)
      clean[title] = text(data[title], title, 160, true);
    if ("description" in data)
      clean.description = text(data.description, "description", 4000);
    if (task) {
      if (!partial || "project_id" in data) {
        clean.project_id = validId(data.project_id);
        get("projects", clean.project_id);
      }
      for (const [key, values] of [
        ["status", STATUSES],
        ["priority", PRIORITIES],
      ]) {
        if (key in data) {
          if (!values.includes(data[key]))
            fail(`${key} must be one of: ${values.join(", ")}`);
          clean[key] = data[key];
        }
      }
      if ("due_date" in data) clean.due_date = date(data.due_date);
    }
    return clean;
  }
  function create(table, data) {
    const clean = validate(data, table, false),
      keys = Object.keys(clean);
    const result = db
      .prepare(
        `INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`,
      )
      .run(...Object.values(clean));
    return get(table, Number(result.lastInsertRowid));
  }
  function update(table, id, data) {
    get(table, id);
    const clean = validate(data, table, true);
    db.prepare(
      `UPDATE ${table} SET ${Object.keys(clean)
        .map((k) => `${k}=?`)
        .join(
          ",",
        )}, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?`,
    ).run(...Object.values(clean), validId(id));
    return get(table, id);
  }
  function remove(table, id) {
    get(table, id);
    db.prepare(`DELETE FROM ${table} WHERE id=?`).run(validId(id));
  }
  return {
    listProjects: () =>
      db.prepare("SELECT * FROM projects ORDER BY id DESC").all(),
    getProject: (id) => get("projects", id),
    createProject: (data) => create("projects", data),
    updateProject: (id, data) => update("projects", id, data),
    deleteProject: (id) => remove("projects", id),
    listTasks(filters = {}) {
      const clauses = [],
        params = [];
      object({ ...filters, _check: true }, [
        "project_id",
        "status",
        "priority",
        "search",
        "_check",
      ]);
      for (const key of ["project_id", "status", "priority"]) {
        if (filters[key] !== undefined) {
          if (key === "project_id") validId(filters[key]);
          else if (
            !(key === "status" ? STATUSES : PRIORITIES).includes(filters[key])
          )
            fail(`Invalid ${key} filter`);
          clauses.push(`${key}=?`);
          params.push(filters[key]);
        }
      }
      if (filters.search !== undefined) {
        const value = text(filters.search, "search", 160);
        clauses.push(
          "(instr(lower(title),lower(?))>0 OR instr(lower(description),lower(?))>0)",
        );
        params.push(value, value);
      }
      return db
        .prepare(
          `SELECT * FROM tasks ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""} ORDER BY id DESC`,
        )
        .all(...params);
    },
    getTask: (id) => get("tasks", id),
    createTask: (data) => create("tasks", data),
    updateTask: (id, data) => update("tasks", id, data),
    deleteTask: (id) => remove("tasks", id),
    close: () => db.close(),
  };
}
