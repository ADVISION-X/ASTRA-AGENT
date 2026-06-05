import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import sharp from "sharp";

import { createMediaProcessingAbilityGroupFromFilesystem } from "../../src/capabilities/media-processing/index.js";
import { handleMediaProcessingRequest } from "../../src/app/workbench-media-processing-routes.js";
import type { GrassEyeWorkbenchHandle } from "../../src/lib/local-runtime/workbench-handle.js";

const dataDir = await mkdtemp(path.join(tmpdir(), "grasseye-media-processing-route-"));
const inputFilePath = path.join(dataDir, "source.png");
await sharp({
  create: {
    width: 180,
    height: 120,
    channels: 3,
    background: { r: 20, g: 200, b: 120 },
  },
}).png().toFile(inputFilePath);

const workbench = {
  getDataDir: () => dataDir,
  getMediaProcessingAbilityGroup: () => createMediaProcessingAbilityGroupFromFilesystem({ dataDir }),
} as GrassEyeWorkbenchHandle;

const server = createServer((request, response) => {
  handleMediaProcessingRequest(request, response, workbench).catch((error) => {
    response.statusCode = 500;
    response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
  });
});

await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert.ok(address && typeof address === "object", "Test server must expose a port.");
const baseUrl = `http://127.0.0.1:${address.port}`;

try {
  const presets = await fetch(`${baseUrl}/api/media-processing/presets`).then((response) => response.json() as Promise<{ presets: unknown[] }>);
  assert.ok(Array.isArray(presets.presets));
  assert.ok(presets.presets.length >= 5);

  const rejected = await fetch(`${baseUrl}/api/media-processing/start-async`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      inputFilePath,
      childCapabilityId: "optimize-image-for-web-once",
      outputFormat: "webp",
      quality: 80,
    }),
  });
  assert.equal(rejected.status, 400, "Direct inputFilePath outside governed roots must be rejected.");

  const started = await fetch(`${baseUrl}/api/media-processing/start-async`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      fileName: "source.png",
      fileContentBase64: (await readFile(inputFilePath)).toString("base64"),
      childCapabilityId: "generate-responsive-image-variants-once",
      outputFormat: "webp",
      quality: 80,
      variantWidths: [64, 128],
      saveToDownloads: true,
    }),
  }).then((response) => response.json() as Promise<{ taskId: string; status: string }>);
  assert.equal(started.status, "running");
  assert.ok(started.taskId);

  let current: {
    status: string;
    downloadsPath?: string | null;
    downloadsPaths?: string[];
    record?: {
      status?: string;
      result?: {
        output?: {
          status?: string;
          proofRef?: string;
          outputArtifacts?: unknown[];
        };
      };
    } | null;
  } = started;
  for (let index = 0; index < 20 && current.status === "running"; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    current = await fetch(`${baseUrl}/api/media-processing/status?taskId=${encodeURIComponent(started.taskId)}`).then((response) => response.json() as Promise<typeof current>);
  }
  assert.equal(current.status, "success");
  assert.equal(current.record?.status, "success");
  assert.equal(current.record?.result?.output?.status, "success");
  assert.ok(current.record?.result?.output?.proofRef);
  assert.equal(current.record?.result?.output?.outputArtifacts?.length, 2, "Responsive route must produce every requested variant.");
  assert.equal(current.downloadsPaths?.length, 2, "Async route must copy every responsive artifact to downloads.");
  assert.equal(current.downloadsPath, current.downloadsPaths?.[0] ?? null, "Legacy downloadsPath must remain the first copied artifact.");
  for (const downloadsPath of current.downloadsPaths ?? []) {
    const copied = await stat(downloadsPath);
    assert.ok(copied.size > 0, "Copied downloads artifact must exist and be non-empty.");
  }
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

process.stdout.write("[ACCEPTANCE][media-processing-async-route] PASS\n");
