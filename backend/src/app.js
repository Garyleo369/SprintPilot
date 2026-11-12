import express from "express";
import cors from "cors";
import { createAI } from "./ai.js";
import { AppError } from "./service.js";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
export function createApp(service, aiOptions = {}) {
  const app = express(),
    ai = createAI(service, aiOptions);
  app.disable("x-powered-by");
  app.use(
    cors({
      origin: [
        process.env.CLIENT_URL || "http://localhost:5173",
        "http://127.0.0.1:5173",
      ],
    }),
  );
  app.use(express.json({ limit: "32kb" }));
  // MVP is local/single-user; reject cross-origin writes even though CORS alone only hides responses.
  app.use("/api", (req, res, next) => {
    const origin = req.get("origin");
    const allowed = [
      process.env.CLIENT_URL || "http://localhost:5173",
      "http://127.0.0.1:5173",
      `http://${req.get("host")}`,
      `https://${req.get("host")}`,
    ];
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      origin &&
      !allowed.includes(origin)
    )
      return next(new AppError(403, "Origin is not allowed"));
    next();
  });
  app.get("/api/health", (req, res) => res.json({ status: "ok" }));
  for (const [path, entity] of [
    ["projects", "Project"],
    ["tasks", "Task"],
  ]) {
    app.get(`/api/${path}`, (req, res) =>
      res.json(
        path === "tasks"
          ? service.listTasks(req.query)
          : service.listProjects(),
      ),
    );
    app.get(`/api/${path}/:id`, (req, res) =>
      res.json(service[`get${entity}`](req.params.id)),
    );
    app.post(`/api/${path}`, (req, res) =>
      res.status(201).json(service[`create${entity}`](req.body)),
    );
    app.patch(`/api/${path}/:id`, (req, res) =>
      res.json(service[`update${entity}`](req.params.id, req.body)),
    );
    app.delete(`/api/${path}/:id`, (req, res) => {
      service[`delete${entity}`](req.params.id);
      res.status(204).end();
    });
  }
  app.get("/api/ai/status", (req, res) => res.json(ai.status()));
  let aiInFlight = false;
  app.post("/api/ai/chat", async (req, res, next) => {
    if (aiInFlight)
      return next(
        new AppError(
          429,
          "An assistant request is already running. Please wait.",
        ),
      );
    aiInFlight = true;
    try {
      res.json(await ai.chat(req.body));
    } catch (e) {
      next(e);
    } finally {
      aiInFlight = false;
    }
  });
  app.post("/api/ai/confirm", async (req, res, next) => {
    if (aiInFlight)
      return next(new AppError(429, "An assistant request is already running. Please wait."));
    aiInFlight = true;
    try {
      res.json(await ai.confirm(req.body));
    } catch (e) {
      next(e);
    } finally {
      aiInFlight = false;
    }
  });
  app.use("/api", (req, res) =>
    res.status(404).json({ error: "API endpoint not found" }),
  );
  const frontend = fileURLToPath(
    new URL("../../frontend/dist/", import.meta.url),
  );
  if (existsSync(frontend)) {
    app.use(express.static(frontend));
    app.get("*", (req, res) => res.sendFile(`${frontend}index.html`));
  } else
    app.get("/", (req, res) =>
      res.json({ name: "SprintPilot API", frontend: "http://localhost:5173" }),
    );
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    const status = err.status || 500;
    if (status >= 500 && !(err instanceof AppError))
      console.error("Unexpected API error:", err.message);
    res
      .status(status)
      .json({
        error:
          err.type === "entity.parse.failed"
            ? "Invalid JSON body"
            : err.type === "entity.too.large"
              ? "Request body too large"
              : status < 500 || err instanceof AppError
                ? err.message
                : "Internal server error",
      });
  });
  return app;
}
