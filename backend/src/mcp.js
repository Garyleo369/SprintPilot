import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createService, STATUSES, PRIORITIES } from "./service.js";
export function createMcpServer(service) {
  const server = new McpServer({ name: "sprintpilot", version: "1.0.0" });
  const id = z.number().int().positive();
  const fields = {
    project_id: id,
    title: z.string().min(1).max(160),
    description: z.string().max(4000).optional(),
    status: z.enum(STATUSES).optional(),
    priority: z.enum(PRIORITIES).optional(),
    due_date: z.string().nullable().optional(),
  };
  const handler = (fn) => async (args) => {
    try {
      return { content: [{ type: "text", text: JSON.stringify(fn(args)) }] };
    } catch (e) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: e.status ? e.message : "Internal task service error",
          },
        ],
      };
    }
  };
  server.registerTool(
    "list_projects",
    {
      description:
        "List workspace projects and IDs to use when creating tasks.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    handler(() => service.listProjects()),
  );
  server.registerTool(
    "list_tasks",
    {
      description:
        "List tasks, optionally filtered by project, status, priority, or title/description search.",
      inputSchema: {
        project_id: id.optional(),
        status: fields.status,
        priority: fields.priority,
        search: z.string().max(160).optional(),
        sort_by: z.enum(["created_at", "due_date", "priority"]).optional(),
        order: z.enum(["asc", "desc"]).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    handler((args) => service.listTasks(args)),
  );
  server.registerTool(
    "create_task",
    {
      description:
        "Create a task in an existing project. Changes are persisted immediately.",
      inputSchema: fields,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
      },
    },
    handler((args) => service.createTask(args)),
  );
  server.registerTool(
    "update_task",
    {
      description:
        "Update an existing task by ID. Pass only the fields to change.",
      inputSchema: {
        id,
        ...Object.fromEntries(
          Object.entries(fields).map(([k, v]) => [k, v.optional()]),
        ),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    handler(({ id: taskId, ...data }) => service.updateTask(taskId, data)),
  );
  server.registerTool(
    "update_task_status",
    {
      description: "Change a task's status to backlog (To Do), in_progress, or done.",
      inputSchema: { id, status: z.enum(STATUSES) },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    handler(({ id: taskId, status }) => service.updateTask(taskId, { status })),
  );
  server.registerTool(
    "delete_task",
    {
      description: "Permanently delete an existing task. The web assistant asks for explicit confirmation first.",
      inputSchema: { id },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    handler(({ id: taskId }) => {
      const task = service.getTask(taskId);
      service.deleteTask(taskId);
      return { deleted: true, task };
    }),
  );
  server.registerTool(
    "get_project_summary",
    {
      description: "Get a project and its real task counts and completion percentage.",
      inputSchema: { id },
      annotations: { readOnlyHint: true },
    },
    handler(({ id: projectId }) => service.getProjectSummary(projectId)),
  );
  return server;
}
export async function runMcpServer() {
  const service = createService();
  const server = createMcpServer(service);
  server.server.onclose = () => {
    service.close();
  };
  await server.connect(new StdioServerTransport());
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => server.close().then(() => process.exit(0)));
}
