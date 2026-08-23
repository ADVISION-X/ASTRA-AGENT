import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { chromium } from "playwright";
import sharp from "sharp";

import { renderAppShell } from "../../src/app/app-shell/app-shell.js";
import { skillRegistry } from "../../src/app/app-shell/skill-registry.js";
import { handleMediaProcessingRequest } from "../../src/app/workbench-media-processing-routes.js";
import { createMediaProcessingAbilityGroupFromFilesystem } from "../../src/capabilities/media-processing/index.js";
import type { GrassEyeWorkbenchHandle } from "../../src/lib/local-runtime/workbench-handle.js";

const mediaOptimizer = skillRegistry.find((skill) => skill.id === "media-optimizer");
assert.ok(mediaOptimizer, "Skill Registry must include media-optimizer.");
assert.equal(mediaOptimizer.category, "content");
assert.equal(mediaOptimizer.route, "/skills/media-optimizer");
assert.equal(mediaOptimizer.primarySurface, "media-optimizer-workspace");
assert.ok(mediaOptimizer.allowedActions.some((action) => action === "Start"));

const dataDir = await mkdtemp(path.join(tmpdir(), "grasseye-media-optimizer-ui-"));
try {
  const deliveryDirectory = path.join(dataDir, "acceptance-downloads");
  const sourceFilePath = path.join(dataDir, "source.png");
  const failingSourceFilePath = path.join(dataDir, "fail-source.png");
  await sharp({
    create: {
      width: 120,
      height: 80,
      channels: 3,
      background: { r: 90, g: 150, b: 60 },
    },
  }).png().toFile(sourceFilePath);
  await writeFile(failingSourceFilePath, "not an image");

  const mediaProcessing = createMediaProcessingAbilityGroupFromFilesystem({ dataDir });
  const workbench = {
    getDataDir: () => dataDir,
    getMediaProcessingAbilityGroup: () => mediaProcessing,
  } as GrassEyeWorkbenchHandle;

  const server = createServer((request, response) => {
    if (request.url === "/" && request.method === "GET") {
      response.setHeader("content-type", "text/html; charset=utf-8");
      response.end(renderAppShell());
      return;
    }
    handleMediaProcessingRequest(request, response, workbench, deliveryDirectory).catch((error) => {
      response.statusCode = 500;
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    });
  });
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        server.off("error", reject);
        resolve();
      });
    });
    const address = server.address();
    assert.ok(address && typeof address === "object", "UI acceptance server must expose a port.");
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      await page.addInitScript(() => {
        const nativeSetTimeout = window.setTimeout;
        window.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) =>
          nativeSetTimeout(handler, Math.min(Number(timeout) || 0, 10), ...args)) as typeof window.setTimeout;
      });
      await page.goto(baseUrl);
      await page.evaluate(() => {
        document.body.dataset.activeSkill = "media-optimizer";
        document.querySelector('[data-skill-workspace="media-optimizer"]')?.classList.remove("hidden");
      });

      await page.setInputFiles('input[name="sourceFile"]', sourceFilePath);
      await page.selectOption('select[name="presetId"]', "web-image");
      await page.dispatchEvent('select[name="presetId"]', "change");
      await page.check('input[name="saveToDownloads"]');
      await page.click('[data-media-optimizer-form] button[type="submit"]');
      await page.waitForSelector('[data-media-optimizer-result].ok-state', { timeout: 5000 });
      await assert.ok(await page.locator('[data-media-optimizer-result]').innerText().then((text) => text.includes("Artifact ready")));
      await assert.ok(await page.locator('[data-media-optimizer-result]').innerText().then((text) => text.includes("Proof: ")));
      await assert.ok(await page.locator('[data-media-optimizer-result]').innerText().then((text) => text.includes("proof.json")));
      await assert.equal(await page.locator("[data-media-optimizer-artifact-list] .record-item").count(), 1);

      await page.click('button[data-workspace-page="artifact"][data-workspace-page-skill="media-optimizer"]');
      await page.click("[data-media-optimizer-artifact-list] .record-item");
      await assert.equal(await page.locator("[data-inspector-kind]").innerText(), "media artifact");
      await assert.ok(await page.locator("[data-inspector-body]").innerText().then((text) => text.includes("proofRef")));

      await page.click('button[data-workspace-page="source"][data-workspace-page-skill="media-optimizer"]');
      await page.setInputFiles('input[name="sourceFile"]', failingSourceFilePath);
      await page.click('[data-media-optimizer-form] button[type="submit"]');
      await page.waitForSelector('[data-media-optimizer-result].failed-state', { timeout: 5000 });
      await assert.ok(await page.locator('[data-media-optimizer-result]').innerText().then((text) => text.includes("image_processing_failed")));
    } finally {
      await browser.close();
    }
  } finally {
    if (server.listening) {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  }
} finally {
  await rm(dataDir, { force: true, recursive: true });
}

process.stdout.write("[ACCEPTANCE][media-optimizer-app-ui] PASS\n");
