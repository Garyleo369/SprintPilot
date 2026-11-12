import { test } from "node:test";
import assert from "node:assert/strict";
import { createAI } from "../src/ai.js";
import { createService } from "../src/service.js";

test("Claude adapter sends workspace context and server-side authentication (mock transport)", async () => {
  const service = createService(":memory:");
  const p = service.createProject({ name: "Roadmap" });
  service.createTask({ project_id: p.id, title: "Implement auth" });
  let sent;
  const ai = createAI(service, {
    apiKey: "test-key",
    model: "test-model",
    fetchImpl: async (url, options) => {
      sent = { url, ...options };
      return {
        ok: true,
        json: async () => ({
          content: [{ type: "text", text: "Prioritize authentication." }],
        }),
      };
    },
  });
  try {
    assert.equal(ai.status().connected, true);
    assert.equal(
      (await ai.chat({ message: "Plan a sprint" })).reply,
      "Prioritize authentication.",
    );
    assert.equal(sent.url, "https://api.anthropic.com/v1/messages");
    assert.equal(sent.headers["x-api-key"], "test-key");
    assert.match(sent.body, /Implement auth/);
    assert.equal(JSON.parse(sent.body).model, "test-model");
  } finally {
    service.close();
  }
});

test("Claude adapter handles provider, network, timeout, and empty-response failures without exposing secrets", async () => {
  const service = createService(":memory:");
  try {
    for (const fetchImpl of [
      async () => ({ ok: false, status: 401 }),
      async () => {
        throw new Error("secret-key");
      },
      async () => {
        const e = new Error("timeout");
        e.name = "TimeoutError";
        throw e;
      },
      async () => ({ ok: true, json: async () => ({ content: [] }) }),
    ]) {
      const ai = createAI(service, { apiKey: "secret-key", fetchImpl });
      await assert.rejects(
        ai.chat({ message: "hello" }),
        (e) => e.status === 502 && !e.message.includes("secret-key"),
      );
    }
  } finally {
    service.close();
  }
});
