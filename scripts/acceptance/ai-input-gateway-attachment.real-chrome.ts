import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { createAiInputGatewayAbilityGroup } from "../../src/capabilities/ai-input-gateway/index.js";
import { CurrentChromeBrowserController } from "../../src/lib/browser/current-chrome-browser-controller.js";
import { createLocalBrowserSessionConfig } from "../../src/lib/browser/local-browser-session.js";

const requestedCounts = process.argv.slice(2).map((value) => Number(value));
const counts = requestedCounts.length > 0 ? requestedCounts : [1, 10, 17];
assert.equal(counts.every((count) => Number.isInteger(count) && count >= 0), true);

const runRoot = await mkdtemp(path.join(tmpdir(), "grasseye-real-chrome-attachment-"));
const browser = new CurrentChromeBrowserController({
  sessionConfig: createLocalBrowserSessionConfig({ platform: "darwin" }),
  screenshotDir: path.join(runRoot, "browser-captures"),
});
const gateway = createAiInputGatewayAbilityGroup({ dataDir: runRoot }, browser);
const results = [];

for (const count of counts) {
  const runId = randomUUID();
  const fixtureDirectory = path.join(runRoot, `fixtures-${count}-${runId}`);
  const { mkdir } = await import("node:fs/promises");
  await mkdir(fixtureDirectory, { recursive: true });
  const tokens: string[] = [];
  const inputRefs = [];
  for (let index = 0; index < count; index += 1) {
    const token = `ATTACHMENT_${count}_${String(index + 1).padStart(2, "0")}_${runId.slice(0, 8)}`;
    const fileName = `${String(index + 1).padStart(2, "0")}-attachment-proof.json`;
    const filePath = path.join(fixtureDirectory, fileName);
    const bytes = Buffer.from(JSON.stringify({ order: index + 1, token }), "utf8");
    await writeFile(filePath, bytes);
    tokens.push(token);
    inputRefs.push({
      id: `attachment-${index + 1}`,
      kind: "real_chrome_acceptance",
      summary: `real Chrome attachment ${index + 1}`,
      filePath,
      fileName,
      mimeType: "application/json",
      sha256: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
      byteCount: bytes.byteLength,
    });
  }
  const marker = `REAL_CHROME_ATTACHMENT_${count}_${runId.slice(0, 8)}`;
  const result = await gateway.execute({
    providerKind: "gpt-web-chat",
    promptPackageId: `real-chrome-attachment-${count}-${runId}`,
    promptContractId: "real-chrome-attachment-proof-v1",
    expectedOutputSchemaRef: null,
    textPrompt: [
      "请读取本轮全部附件。",
      "只回复一个 JSON 对象，不要 Markdown 代码块，不要解释。",
      `marker 必须等于 ${marker}。`,
      `fileCount 必须等于 ${count}。`,
      "tokens 必须按附件编号顺序列出每个附件中的 token，不能遗漏。",
    ].join("\n"),
    inputRefs,
    modelName: null,
    timeoutMs: 360_000,
    maxInputChars: 20_000,
    maxFileCount: count,
    maxFileBytes: 10_000,
    requestedBy: "acceptance-test",
    missionId: "ai-input-gateway-real-chrome-attachment",
    runId,
    roundId: `ai-input-gateway-real-chrome-attachment:${runId}`,
  });
  assert.equal(result.status, "success", result.failureReason ?? result.reviewRequiredReason ?? "provider feed failed");
  assert.equal(result.providerProof.attachmentUploadProof?.expectedFileCount, count);
  assert.equal(result.providerProof.attachmentUploadProof?.detectedFileCount, count);
  assert.equal(
    result.providerProof.attachmentUploadProof?.status,
    count === 0 ? "skipped" : "attachments_stable",
  );
  assert.match(result.rawResponseText ?? "", new RegExp(marker, "u"));
  for (const token of tokens) {
    assert.match(result.rawResponseText ?? "", new RegExp(token, "u"));
  }
  results.push({
    count,
    marker,
    status: result.status,
    childCapabilityId: result.providerProof.attachmentUploadProof?.childCapabilityId ?? null,
    transportKind: result.providerProof.attachmentUploadProof?.transportKind ?? null,
    expectedFileCount: result.providerProof.attachmentUploadProof?.expectedFileCount ?? null,
    detectedFileCount: result.providerProof.attachmentUploadProof?.detectedFileCount ?? null,
    attachmentStatus: result.providerProof.attachmentUploadProof?.status ?? null,
    stagingManifestHash: result.providerProof.attachmentUploadProof?.stagingManifestHash ?? null,
    rawOutputHash: result.rawOutputHash,
    webChatUrl: result.providerProof.webChatUrl,
  });
}

process.stdout.write(`${JSON.stringify({
  marker: "[ACCEPTANCE][AI-INPUT-GATEWAY][REAL-CHROME]",
  runRoot,
  results,
}, null, 2)}\n`);
