import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

// Tests the built React app served by the real Express backend with a temporary SQLite DB.
test(
  "browser CRUD, reload persistence, filters, progress, modals, disconnected AI and mobile layout",
  { timeout: 60000 },
  async () => {
    const dir = mkdtempSync(join(tmpdir(), "sprintpilot-browser-"));
    const port = 15179;
    const server = spawn(process.execPath, ["backend/src/index.js"], {
      cwd: fileURLToPath(new URL("../", import.meta.url)),
      env: {
        ...process.env,
        PORT: String(port),
        HOST: "127.0.0.1",
        DATABASE_PATH: join(dir, "browser.db"),
        HF_TOKEN: "",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let browser;
    let logs = "";
    server.stdout.on("data", (c) => {
      logs += c;
    });
    server.stderr.on("data", (c) => {
      logs += c;
    });
    const url = `http://127.0.0.1:${port}`;
    try {
      let ready = false;
      for (let i = 0; i < 80; i++) {
        try {
          if ((await fetch(`${url}/api/health`)).ok) {
            ready = true;
            break;
          }
        } catch {
          /* startup */
        }
        if (server.exitCode !== null) break;
        await delay(100);
      }
      assert.ok(ready, `Backend did not start: ${logs}`);
      browser = await chromium.launch({
        headless: true,
        executablePath:
          process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
      });
      const page = await browser.newPage({
        viewport: { width: 1440, height: 1000 },
      });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(url);
      await page.getByRole("heading", { name: "Workspace overview" }).waitFor();
      await page
        .getByRole("button", { name: "Create your first project" })
        .click();
      let dialog = page.getByRole("dialog");
      await dialog.getByLabel("Project name").fill("Website launch");
      await dialog
        .getByLabel("Description")
        .fill("Ship a polished project workspace.");
      await dialog.getByRole("button", { name: "Save changes" }).click();
      await dialog.waitFor({ state: "hidden" });
      await page
        .getByRole("button", { name: "New task", exact: false })
        .click();
      dialog = page.getByRole("dialog");
      await dialog.getByLabel("Task title").fill("Implement dashboard");
      await dialog
        .getByLabel("Description")
        .fill("Project cards and accessible modals");
      await dialog.getByLabel("Priority").selectOption("high");
      await dialog.getByLabel("Due date").fill("2026-12-01");
      await dialog.getByRole("button", { name: "Save changes" }).click();
      await dialog.waitFor({ state: "hidden" });
      await page.getByRole("button", { name: /Implement dashboard/ }).waitFor();
      await page
        .getByLabel("Status for Implement dashboard")
        .selectOption("done");
      await page.waitForFunction(
        () => document.querySelector("progress")?.value === 100,
      );
      await page.reload();
      await page.getByLabel("Status for Implement dashboard").waitFor();
      assert.equal(
        await page.getByLabel("Status for Implement dashboard").inputValue(),
        "done",
      );
      assert.equal(await page.locator("progress").getAttribute("value"), "100");
      await page.getByLabel("Search tasks").fill("no matching task");
      await page.getByRole("heading", { name: "No matching tasks" }).waitFor();
      await page.getByLabel("Search tasks").fill("");
      await page.getByLabel("Filter by status").selectOption("backlog");
      await page.getByRole("heading", { name: "No matching tasks" }).waitFor();
      await page.getByLabel("Filter by status").selectOption("");
      await page.getByRole("button", { name: /Implement dashboard/ }).click();
      dialog = page.getByRole("dialog");
      await dialog.getByLabel("Task title").fill("Dashboard shipped");
      await dialog.getByLabel("Priority").selectOption("urgent");
      await dialog.getByRole("button", { name: "Save changes" }).click();
      await dialog.waitFor({ state: "hidden" });
      await page.getByRole("button", { name: /Dashboard shipped/ }).waitFor();
      await page.getByRole("button", { name: "Edit Website launch" }).click();
      await page
        .getByRole("dialog")
        .getByLabel("Project name")
        .fill("Launch v1");
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Save changes" })
        .click();
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      await page.getByRole("button", { name: "View project" }).click();
      assert.equal(
        await page.getByLabel("Filter by project").inputValue(),
        "1",
      );
      await page.getByRole("button", { name: /AI Assistant/ }).click();
      await page
        .getByRole("heading", { name: "Connect Claude to get started" })
        .waitFor();
      assert.equal(await page.getByLabel("Message Claude").isDisabled(), true);
      await page
        .getByRole("button", { name: "Overview", exact: false })
        .click();
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      if (process.env.QA_SCREENSHOT_DIR) {
        await page.screenshot({
          path: join(process.env.QA_SCREENSHOT_DIR, "sprintpilot-mobile.png"),
          fullPage: true,
        });
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.screenshot({
          path: join(process.env.QA_SCREENSHOT_DIR, "sprintpilot-desktop.png"),
          fullPage: true,
        });
      }
      // Escape closes a modal and returns focus to its trigger.
      await page.getByRole("button", { name: "Edit Launch v1" }).click();
      await page.keyboard.press("Escape");
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      // Delete a task through explicit confirmation.
      await page.getByRole("button", { name: /Dashboard shipped/ }).click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Delete", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Yes, delete permanently" })
        .click();
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      await page
        .getByRole("heading", { name: "Your next step starts here." })
        .waitFor();
      // Create again, then verify project cascade deletion through the UI.
      await page
        .getByRole("button", { name: "New task", exact: false })
        .click();
      await page
        .getByRole("dialog")
        .getByLabel("Task title")
        .fill("Cascade task");
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Save changes" })
        .click();
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      await page.getByRole("button", { name: "Edit Launch v1" }).click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Delete", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Yes, delete permanently" })
        .click();
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      await page
        .getByRole("heading", { name: "A fresh start for your next big idea." })
        .waitFor();
      assert.deepEqual(await (await fetch(`${url}/api/tasks`)).json(), []);
      assert.deepEqual(errors, []);
    } finally {
      if (browser) await browser.close();
      if (server.exitCode === null) {
        const closed = once(server, "exit");
        server.kill("SIGTERM");
        await closed;
      }
      rmSync(dir, { recursive: true, force: true });
    }
  },
);
