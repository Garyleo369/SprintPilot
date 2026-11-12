import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { createService } from "../src/service.js";
import { createApp } from "../src/app.js";

async function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), "sprintpilot-"));
  const path = join(dir, "test.db"),
    service = createService(path);
  const server = createApp(service, { apiKey: "" }).listen(0, "127.0.0.1");
  await once(server, "listening");
  const request = async (route, method = "GET", body, headers = {}) => {
    const res = await fetch(
      `http://127.0.0.1:${server.address().port}/api${route}`,
      {
        method,
        headers: { "Content-Type": "application/json", ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      },
    );
    return {
      status: res.status,
      body: res.status === 204 ? null : await res.json(),
    };
  };
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    service.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return { request, service, path };
}

test("REST project/task CRUD, filters, persistence across connections, and cascade deletion", async (t) => {
  const { request, path } = await fixture(t);
  assert.deepEqual((await request("/health")).body, { status: "ok" });
  assert.deepEqual((await request("/projects")).body, []);
  const project = await request("/projects", "POST", {
    name: "  Release 1  ",
    description: "Ship the MVP",
  });
  assert.equal(project.status, 201);
  assert.equal(project.body.name, "Release 1");
  const p = project.body.id;
  const created = await request("/tasks", "POST", {
    project_id: p,
    title: "Build API",
    priority: "high",
    due_date: "2026-12-01",
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.status, "backlog");
  const id = created.body.id;
  const updated = await request(`/tasks/${id}`, "PATCH", {
    status: "done",
    title: "API shipped",
    due_date: "",
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.status, "done");
  assert.equal(updated.body.due_date, null);
  assert.equal(
    (
      await request(
        `/tasks?project_id=${p}&status=done&priority=high&search=shipped`,
      )
    ).body.length,
    1,
  );
  assert.equal((await request("/tasks?status=backlog")).body.length, 0);
  const second = createService(path);
  assert.equal(second.getTask(id).title, "API shipped");
  second.close();
  assert.equal(
    (await request(`/projects/${p}`, "PATCH", { name: "Released" })).body.name,
    "Released",
  );
  assert.equal((await request(`/projects/${p}`)).body.name, "Released");
  assert.equal((await request(`/tasks/${id}`)).body.title, "API shipped");
  assert.equal((await request(`/tasks/${id}`, "DELETE")).status, 204);
  assert.equal((await request(`/tasks/${id}`)).status, 404);
  await request("/tasks", "POST", { project_id: p, title: "Cascade me" });
  assert.equal((await request(`/projects/${p}`, "DELETE")).status, 204);
  assert.deepEqual((await request("/tasks")).body, []);
  assert.equal((await request(`/projects/${p}`)).status, 404);
});

test("task search, priority filter and validated sorting use persisted records", async (t) => {
  const { request } = await fixture(t);
  const p = (await request("/projects", "POST", { name: "Sort" })).body.id;
  await request("/tasks", "POST", { project_id: p, title: "Later", description: "design roadmap", priority: "urgent", due_date: "2026-12-20" });
  await request("/tasks", "POST", { project_id: p, title: "Soon", priority: "low", due_date: "2026-12-01" });
  await request("/tasks", "POST", { project_id: p, title: "Unscheduled", priority: "high" });
  assert.deepEqual((await request("/tasks?sort_by=due_date&order=asc")).body.map((x) => x.title), ["Soon", "Later", "Unscheduled"]);
  assert.deepEqual((await request("/tasks?sort_by=priority&order=desc")).body.map((x) => x.title), ["Later", "Unscheduled", "Soon"]);
  assert.equal((await request(`/tasks?project_id=${p}&priority=urgent&search=roadmap`)).body[0].title, "Later");
  assert.equal((await request("/tasks?sort_by=DROP%20TABLE%20tasks")).status, 400);
  assert.equal((await request("/tasks?order=sideways")).status, 400);
});

test("REST rejects invalid bodies, IDs, filters, dates and unknown resources", async (t) => {
  const { request } = await fixture(t);
  const p = (await request("/projects", "POST", { name: "Validation" })).body
    .id;
  for (const body of [
    { name: " " },
    { name: "x".repeat(161) },
    { name: 4 },
    { name: "x", unknown: true },
    [],
    {},
  ])
    assert.equal((await request("/projects", "POST", body)).status, 400);
  for (const body of [
    { project_id: p, title: "" },
    { project_id: p, title: "x", priority: "invalid" },
    { project_id: p, title: "x", status: "invalid" },
    { project_id: p, title: "x", due_date: "2026-02-30" },
    { project_id: p, title: "x", due_date: "tomorrow" },
    { title: "x" },
  ])
    assert.equal((await request("/tasks", "POST", body)).status, 400);
  assert.equal(
    (await request("/tasks", "POST", { project_id: 9999, title: "x" })).status,
    404,
  );
  for (const route of [
    "/tasks/0",
    "/tasks/1.5",
    "/tasks/abc",
    "/tasks?project_id=0",
    "/tasks?status=nope",
    "/tasks?unknown=x",
    "/tasks?status=done&status=backlog",
  ])
    assert.equal((await request(route)).status, 400);
  assert.equal((await request(`/projects/${p}`, "PATCH", {})).status, 400);
  assert.equal((await request("/tasks/9999", "DELETE")).status, 404);
  assert.equal((await request("/unknown")).status, 404);
  assert.equal(
    (
      await request(
        "/projects",
        "POST",
        { name: "CSRF" },
        { origin: "https://untrusted.example" },
      )
    ).status,
    403,
  );
});

test("malformed JSON and oversized bodies return structured errors; AI stays disconnected", async (t) => {
  const { request, service } = await fixture(t);
  assert.equal(
    (await request("/projects", "POST", { name: "x".repeat(40000) })).status,
    413,
  );
  assert.deepEqual((await request("/ai/status")).body, {
    connected: false,
    provider: "huggingface",
    model: null,
  });
  assert.equal(
    (await request("/ai/chat", "POST", { message: "Plan my sprint" })).status,
    503,
  );
  assert.equal(
    (await request("/ai/chat", "POST", { message: "" })).status,
    400,
  );
  const server = createApp(service, { apiKey: "" }).listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const res = await fetch(
      `http://127.0.0.1:${server.address().port}/api/projects`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{bad json",
      },
    );
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error, "Invalid JSON body");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("SQLite records survive closing and reopening the database", () => {
  const dir = mkdtempSync(join(tmpdir(), "sprintpilot-durable-")),
    path = join(dir, "durable.db");
  try {
    let service = createService(path);
    const p = service.createProject({ name: "Durable" });
    const task = service.createTask({
      project_id: p.id,
      title: "Survive restart",
    });
    service.close();
    service = createService(path);
    assert.equal(service.getTask(task.id).title, "Survive restart");
    service.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
