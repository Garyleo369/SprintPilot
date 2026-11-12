import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import { defaultDbPath } from "./service.js";

export async function connectMcp({ databasePath = process.env.DATABASE_PATH || defaultDbPath } = {}) {
  const { HF_TOKEN, ANTHROPIC_API_KEY, ...safeEnvironment } = process.env;
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL("../../mcp-server/index.js", import.meta.url))],
    env: { ...safeEnvironment, DATABASE_PATH: databasePath },
    stderr: "pipe",
  });
  const client = new Client({ name: "sprintpilot-api", version: "1.0.0" });
  await client.connect(transport);
  return client;
}
