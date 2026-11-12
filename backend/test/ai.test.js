import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAI } from '../src/ai.js';
import { createService } from '../src/service.js';
import { connectMcp } from '../src/mcp-client.js';

test('Hugging Face tool loop executes real MCP writes and confirms deletion', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sprintpilot-ai-'));
  const path = join(dir, 'data.db');
  const service = createService(path);
  const project = service.createProject({ name: 'Roadmap' });
  const calls = [];
  const replies = [
    { tool_calls: [{ id: 'one', type: 'function', function: { name: 'create_task', arguments: JSON.stringify({ project_id: project.id, title: 'Ship MVP', priority: 'high' }) } }] },
    { content: 'Created the task.' },
  ];
  const ai = createAI(service, {
    apiKey: 'test-token', model: 'openai/gpt-oss-120b:cerebras',
    connect: () => connectMcp({ databasePath: path }),
    fetchImpl: async (url, options) => {
      calls.push({ url, ...options });
      return { ok: true, json: async () => ({ choices: [{ message: replies.shift() }] }) };
    },
  });
  try {
    const response = await ai.chat({ message: 'Create a task' });
    assert.equal(response.changed, true);
    assert.equal(response.operations[0].tool, 'create_task');
    assert.equal(service.listTasks({})[0].title, 'Ship MVP');
    assert.equal(calls[0].url, 'https://router.huggingface.co/v1/chat/completions');
    assert.equal(calls[0].headers.Authorization, 'Bearer test-token');
    assert.equal(JSON.parse(calls[0].body).tools.length, 7);
    assert.match(calls[1].body, /Ship MVP/);
    const taskId = service.listTasks({})[0].id;
    const deletion = createAI(service, {
      apiKey: 'test-token', connect: () => connectMcp({ databasePath: path }),
      fetchImpl: async () => ({ ok: true, json: async () => ({ choices: [{ message: { tool_calls: [{ id: 'delete', type: 'function', function: { name: 'delete_task', arguments: JSON.stringify({ id: taskId }) } }] } }] }) }),
    });
    const pending = await deletion.chat({ message: 'Delete task' });
    assert.equal(pending.changed, false);
    assert.ok(service.getTask(taskId));
    assert.equal((await deletion.confirm({ id: pending.pending.id })).changed, true);
    assert.equal(service.listTasks({}).length, 0);
    const ollamaRequests = [];
    const ollamaReplies = [
      { tool_calls: [{ function: { name: 'list_projects', arguments: {} } }] },
      { content: 'Local AI found the Roadmap project.' },
    ];
    const ollama = createAI(service, {
      provider: 'ollama', model: 'qwen3:4b',
      connect: () => connectMcp({ databasePath: path }),
      fetchImpl: async (url, options) => {
        ollamaRequests.push({ url, ...options });
        return { ok: true, json: async () => ({ choices: [{ message: ollamaReplies.shift() }] }) };
      },
    });
    assert.deepEqual(ollama.status(), { connected: true, provider: 'ollama', model: 'qwen3:4b' });
    assert.equal((await ollama.chat({ message: 'List projects' })).reply, 'Local AI found the Roadmap project.');
    assert.equal(ollamaRequests[0].url, 'http://127.0.0.1:11434/v1/chat/completions');
    assert.equal(ollamaRequests[0].headers.Authorization, undefined);
    assert.match(ollamaRequests[1].body, /Roadmap/);
  } finally { service.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('provider and disconnected errors are safe and never claim a write', async () => {
  const service = createService(':memory:');
  try {
    await assert.rejects(createAI(service, { provider: 'huggingface', apiKey: '' }).chat({ message: 'Hello' }), (e) => e.status === 503);
    for (const fetchImpl of [
      async () => ({ ok: false, status: 401 }),
      async () => { throw new Error('secret-token'); },
      async () => ({ ok: true, json: async () => ({ choices: [] }) }),
    ]) {
      const ai = createAI(service, { apiKey: 'secret-token', fetchImpl });
      await assert.rejects(ai.chat({ message: 'hello' }), (e) => e.status >= 500 && !e.message.includes('secret-token'));
    }
    const ai = createAI(service, { apiKey: 'test-token', fetchImpl: async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: 'Done!' } }] }) }) });
    assert.equal((await ai.chat({ message: 'Create a task' })).changed, false);
  } finally { service.close(); }
});
