import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { attachApprovedWebChatFilesOnce, WebChatAttachmentCapabilityFailure } from "../children/attach-approved-web-chat-files-once.js";
import { AiFeedInputSchema } from "../schema.js";
import type { AttachmentMutationBrowser } from "../providers/web-chat-attachment-transport.js";
import type { BrowserFileArtifactGrantV1 } from "../../../lib/browser/browser-authority-api.js";
import { emitQualityProofObservation } from "../../../../scripts/audit/shared/proof-observation.js";

const digest = (bytes: Buffer): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

const buildRequest = async (directory: string, fileCount: number) => {
  const inputRefs = [];
  for (let index = 0; index < fileCount; index += 1) {
    const fileName = `${String(index + 1).padStart(2, "0")}-fixture.json`;
    const filePath = path.join(directory, fileName);
    const bytes = Buffer.from(JSON.stringify({ index }), "utf8");
    await writeFile(filePath, bytes);
    inputRefs.push({
      id: `fixture-${index + 1}`,
      kind: "evidence",
      summary: `fixture ${index + 1}`,
      filePath,
      fileName,
      mimeType: "application/json",
      sha256: digest(bytes),
      byteCount: bytes.byteLength,
    });
  }
  return AiFeedInputSchema.parse({
    providerKind: "gpt-web-chat",
    taskIdentity: { labelKey: "system_acceptance", sourceProject: "agent", taskKind: "attachment-acceptance", sourceTaskId: `attachment-${fileCount}` },
    promptPackageId: `attachment-acceptance-${fileCount}`,
    promptContractId: "attachment-acceptance-v2",
    expectedOutputSchemaRef: null,
    textPrompt: "Attachment child acceptance prompt.",
    inputRefs,
    modelName: null,
    timeoutMs: 180_000,
    maxFileCount: fileCount,
    requestedBy: "acceptance-test",
    missionId: "attachment-acceptance",
    runId: `attachment-${fileCount}`,
    roundId: `attachment-${fileCount}:1`,
  });
};

class AttachmentLeaseFixture implements AttachmentMutationBrowser {
  readonly attachmentBatches: Array<Parameters<AttachmentMutationBrowser["attachFile"]>[0]> = [];
  readonly registeredNames: string[] = [];

  public async executeDomIntent(intent: Parameters<AttachmentMutationBrowser["executeDomIntent"]>[0]): Promise<unknown> {
    if (intent.kind === "document") return { url: "https://chatgpt.com/c/attachment-acceptance", title: "ChatGPT" };
    if (intent.kind === "inspect" && intent.selector === "#prompt-textarea") {
      return { tagName: "DIV", text: "", visible: true, disabled: false };
    }
    if (intent.kind === "inspect" && intent.selector === "#upload-files") {
      return { tagName: "INPUT", type: "file", accept: "", multiple: true, connected: true, disabled: false, visible: false };
    }
    if (intent.kind === "inspect" && intent.selector === "#composer-submit-button[data-testid='send-button']") {
      return { tagName: "BUTTON", visible: true, disabled: true };
    }
    if (intent.kind === "readText" && intent.selector === "form") {
      return this.registeredNames.join("\n");
    }
    if (intent.kind === "find" && intent.selector?.includes("Remove file")) {
      return { count: this.attachmentBatches.at(-1)?.grants.length ?? 0 };
    }
    throw new Error("BROWSER_TARGET_INVALID");
  }

  public async wait(): Promise<void> {}

  public async attachFile(input: Parameters<AttachmentMutationBrowser["attachFile"]>[0]): Promise<void> {
    this.attachmentBatches.push(input);
  }
}

const grantFor = (artifactRef: string, expectedSha256: `sha256:${string}`, maxBytes: number): BrowserFileArtifactGrantV1 => ({
  schemaVersion: "browser-file-artifact-grant-v1",
  grantRef: `grant-${artifactRef}`,
  authorityEpoch: 1,
  executionBindingHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  artifactRef,
  contentHash: expectedSha256,
  maxBytes,
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
});

const dataDir = await mkdtemp(path.join(tmpdir(), "attachment-child-"));
try {
  const zero = await attachApprovedWebChatFilesOnce({
    browser: new AttachmentLeaseFixture(),
    request: await buildRequest(dataDir, 0),
    context: { dataDir },
  });
  assert.equal(zero.attachmentUploadProof.status, "skipped");

  const browser = new AttachmentLeaseFixture();
  let terminalProof: unknown = null;
  const registered: string[] = [];
  const completed = await attachApprovedWebChatFilesOnce({
    browser,
    request: await buildRequest(dataDir, 2),
    context: {
      dataDir,
      registerBrowserFileArtifact: async (input) => {
        registered.push(input.artifactRef);
        browser.registeredNames.push(path.basename(input.filePath));
      },
      issueBrowserFileArtifactGrant: async (input) => grantFor(input.artifactRef, input.expectedSha256, input.maxBytes),
      onAttachmentUploadCompleted: async (proof) => { terminalProof = proof; },
    },
  });
  assert.equal(registered.length, 2);
  assert.deepEqual(browser.attachmentBatches.map((batch) => ({ selector: batch.selector, grantCount: batch.grants.length })), [
    { selector: "#upload-files", grantCount: 2 },
  ], "one exact document-input batch is the only attachment mutation");
  assert.equal((terminalProof as { status?: string } | null)?.status, "attachments_stable");
  assert.equal(completed.uploadedFiles.length, 2);
  assert.equal(
    browser.attachmentBatches.length,
    1,
    "exact attachments must stabilize before prompt entry even while the send button is correctly disabled",
  );

  await assert.rejects(
    attachApprovedWebChatFilesOnce({
      browser: new AttachmentLeaseFixture(),
      request: await buildRequest(dataDir, 1),
      context: { dataDir },
    }),
    /BROWSER_FILE_GRANT_INVALID/u,
  );
} finally {
  await rm(dataDir, { recursive: true, force: true });
}

process.stdout.write("[ACCEPTANCE] AI Input Gateway attachment child registers staged artifacts, issues opaque grants and submits one exact-target batch\n");
emitQualityProofObservation({ lawId: "LAW-AI-INPUT-GATEWAY-004-V1", evidenceMode: "exam.golden", clauses: ["forbidden:0","forbidden:1","forbidden:2","forbidden:3","summary"], locator: "acceptance:attachment:opaque-grant-proof", observedValue: "staged artifacts and opaque grants retain exact proof" });
emitQualityProofObservation({ lawId: "LAW-AI-INPUT-GATEWAY-007-V2", evidenceMode: "exam.golden", clauses: ["forbidden:0","summary"], locator: "acceptance:attachment:approved-input-refs", observedValue: "caller inputRefs bind staged file hashes and one exact-target batch" });
