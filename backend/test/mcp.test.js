import { test } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { createService } from "../src/service.js";

test("real stdio MCP handshake, discovery, list/create/update, validation and shared SQLite visibility", async () => {
  const dir = mkdtempSync(join(tmpdir(), "sprintpilot-mcp-")),
    path = join(dir, "mcp.db");
  const service = createService(path),
    p = service.createProject({ name: "MCP project" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [
      fileURLToPath(new URL("../../mcp-server/index.js", import.meta.url)),
    ],
    env: { ...process.env, DATABASE_PATH: path },
    stderr: "pipe",
  });
  const client = new Client({ name: "sprintpilot-test", version: "1.0.0" });
  try {
    await client.connect(transport);
    const names = (await client.listTools()).tools.map((t) => t.name);
    assert.deepEqual(names.sort(), [
      "create_task",
      "list_projects",
      "list_tasks",
      "update_task",
    ]);
    const call = async (name, args) =>
      client.callTool({ name, arguments: args });
    assert.equal(
      JSON.parse((await call("list_projects", {})).content[0].text)[0].id,
      p.id,
    );
    const created = await call("create_task", {
      project_id: p.id,
      title: "From MCP",
      priority: "high",
    });
    assert.ok(!created.isError);
    const task = JSON.parse(created.content[0].text);
    assert.equal(service.getTask(task.id).title, "From MCP");
    const updated = await call("update_task", { id: task.id, status: "done" });
    assert.ok(!updated.isError);
    assert.equal(service.getTask(task.id).status, "done");
    assert.equal(
      JSON.parse(
        (await call("list_tasks", { project_id: p.id, status: "done" }))
          .content[0].text,
      ).length,
      1,
    );
    assert.equal(
      (await call("create_task", { project_id: p.id, title: "  " })).isError,
      true,
    );
    assert.equal(
      (await call("update_task", { id: task.id, due_date: "2026-02-30" }))
        .isError,
      true,
    );
    assert.equal(
      (await call("update_task", { id: 99999, title: "missing" })).isError,
      true,
    );
    assert.equal(
      (
        await call("create_task", {
          project_id: p.id,
          title: "x",
          status: "invalid",
        })
      ).isError,
      true,
    );
  } finally {
    await client.close();
    service.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
