import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { chromium } from "playwright";
import sharp from "sharp";

import { renderAppShell } from "../../src/app/app-shell/app-shell.js";
import { skillRegistry } from "../../src/app/app-shell/skill-registry.js";
import { handleMediaProcessingRequest } from "../../src/app/workbench-media-processing-routes.js";
import {
  MEDIA_PROCESSING_ABILITY_GROUP_ID,
  type MediaProcessingAbilityGroup,
  type MediaProcessingPublicRequest,
  type MediaProcessingResult,
} from "../../src/capabilities/media-processing/index.js";
import type { GrassEyeWorkbenchHandle } from "../../src/lib/local-runtime/workbench-handle.js";

const mediaOptimizer = skillRegistry.find((skill) => skill.id === "media-optimizer");
assert.ok(mediaOptimizer, "Skill Registry must include media-optimizer.");
assert.equal(mediaOptimizer.category, "content");
assert.equal(mediaOptimizer.route, "/skills/media-optimizer");
assert.equal(mediaOptimizer.primarySurface, "media-optimizer-workspace");
assert.ok(mediaOptimizer.allowedActions.some((action) => action === "Start"));

const buildResult = (input: MediaProcessingPublicRequest, artifactFilePath: string): MediaProcessingResult => {
  const now = new Date().toISOString();
  const failed = path.basename(input.inputFilePath).includes("fail");
  const artifact = {
    artifactRef: `mp_artifact_${randomUUID()}`,
    storageRef: artifactFilePath,
    filePath: artifactFilePath,
    contentType: "image/webp",
    byteSize: 1280,
    sha256: "b".repeat(64),
    width: 80,
    height: 60,
    durationMs: null,
    format: "webp",
    videoCodec: null,
    audioCodec: null,
    fastStart: null,
    targetMaxBytes: null,
    targetBitrateKbps: null,
    compressionRatio: null,
    derivativeKind: "optimized" as const,
  };
  const proof = {
    proofId: `mp_proof_${randomUUID()}`,
    missionId: input.missionId,
    runId: input.runId,
    capabilityCallId: `acceptance_${randomUUID()}`,
    abilityGroupId: MEDIA_PROCESSING_ABILITY_GROUP_ID,
    childCapabilityId: input.childCapabilityId,
    status: failed ? "failed" as const : "success" as const,
    failureReason: failed ? "acceptance_forced_failure" : null,
    reviewRequiredReason: null,
    inputFilePath: input.inputFilePath,
    inputByteSize: null,
    outputArtifacts: failed ? [] : [artifact],
    startedAt: now,
    endedAt: now,
    durationMsTotal: 0,
  };
  return failed
    ? {
        abilityGroupId: MEDIA_PROCESSING_ABILITY_GROUP_ID,
        childCapabilityId: input.childCapabilityId,
        status: "failed",
        failureReason: "acceptance_forced_failure",
        reviewRequiredReason: null,
        output: {
          status: "failed",
          errorCode: "acceptance_forced_failure",
          reason: "acceptance_forced_failure",
          proofRef: proof.proofId,
        },
        runtimeProof: proof,
      }
    : {
        abilityGroupId: MEDIA_PROCESSING_ABILITY_GROUP_ID,
        childCapabilityId: input.childCapabilityId,
        status: "success",
        failureReason: null,
        reviewRequiredReason: null,
        output: {
          status: "success",
          outputArtifacts: [artifact],
          proofRef: proof.proofId,
        },
        runtimeProof: proof,
      };
};

const dataDir = await mkdtemp(path.join(tmpdir(), "grasseye-media-optimizer-ui-"));
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
await writeFile(failingSourceFilePath, await readFile(sourceFilePath));
const artifactDir = path.join(dataDir, "runtime-data", "media-processing-artifacts");
await mkdir(artifactDir, { recursive: true });
const artifactFilePath = path.join(artifactDir, "optimized.webp");
await writeFile(artifactFilePath, "optimized artifact");

const mediaProcessing = {
  abilityGroupId: MEDIA_PROCESSING_ABILITY_GROUP_ID,
  listChildCapabilityIds: () => [
    "optimize-image-for-web-once",
    "resize-image-for-web-once",
    "generate-responsive-image-variants-once",
    "optimize-video-for-web-once",
    "compress-video-for-web-once",
    "generate-video-poster-once",
  ],
  processMedia: async (input: MediaProcessingPublicRequest) => buildResult(input, artifactFilePath),
  execute: async () => {
    throw new Error("not used");
  },
} as MediaProcessingAbilityGroup;

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
  handleMediaProcessingRequest(request, response, workbench).catch((error) => {
    response.statusCode = 500;
    response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
  });
});

await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert.ok(address && typeof address === "object", "UI acceptance server must expose a port.");
const baseUrl = `http://127.0.0.1:${address.port}`;

let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
try {
  browser = await chromium.launch();
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
  await assert.ok(await page.locator('[data-media-optimizer-result]').innerText().then((text) => text.includes("Proof: mp_proof_")));
  await assert.equal(await page.locator("[data-media-optimizer-artifact-list] .record-item").count(), 1);

  await page.click('button[data-workspace-page="artifact"][data-workspace-page-skill="media-optimizer"]');
  await page.click("[data-media-optimizer-artifact-list] .record-item");
  await assert.equal(await page.locator("[data-inspector-kind]").innerText(), "media artifact");
  await assert.ok(await page.locator("[data-inspector-body]").innerText().then((text) => text.includes("proofRef")));

  await page.click('button[data-workspace-page="source"][data-workspace-page-skill="media-optimizer"]');
  await page.setInputFiles('input[name="sourceFile"]', failingSourceFilePath);
  await page.click('[data-media-optimizer-form] button[type="submit"]');
  await page.waitForSelector('[data-media-optimizer-result].failed-state', { timeout: 5000 });
  await assert.ok(await page.locator('[data-media-optimizer-result]').innerText().then((text) => text.includes("acceptance_forced_failure")));
} finally {
  if (browser) {
    await browser.close();
  }
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

process.stdout.write("[ACCEPTANCE][media-optimizer-app-ui] PASS\n");
