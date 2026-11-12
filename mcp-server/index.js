import "../backend/src/config.js";
import { runMcpServer } from "../backend/src/mcp.js";
// stdout belongs exclusively to MCP JSON-RPC. Diagnostics go to stderr.
runMcpServer().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
