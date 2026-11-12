import "./config.js";
import { createApp } from "./app.js";
import { createService } from "./service.js";
const service = createService();
const port = Number(process.env.PORT || 5000);
const server = createApp(service).listen(
  port,
  process.env.HOST || "127.0.0.1",
  () => console.log(`SprintPilot running at http://localhost:${port}`),
);
function shutdown() {
  server.close(() => {
    service.close();
    process.exit(0);
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
