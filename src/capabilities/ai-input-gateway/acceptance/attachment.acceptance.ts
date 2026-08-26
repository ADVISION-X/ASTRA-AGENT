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
  readonly surfaceSelectors: string[] = [];
  surfaceReads = 0;

  public async executeDomIntent(intent: Parameters<AttachmentMutationBrowser["executeDomIntent"]>[0]): Promise<unknown> {
    if (intent.kind === "document") return { url: "https://chatgpt.com/c/attachment-acceptance", title: "ChatGPT" };
    if (intent.kind === "find"
      && intent.selector?.includes("#prompt-textarea")
      && intent.selector.includes("form:has(#prompt-textarea)")
      && !intent.selector.includes("#upload-files")
      && !intent.selector.includes("#composer-submit-button")) {
      this.surfaceReads += 1;
      this.surfaceSelectors.push(intent.selector);
      const base = {
        disabled: false,
      };
      const matches = [
        { ...base, id: "", tagName: "FORM", text: this.registeredNames.join("\n") },
        { ...base, id: "prompt-textarea", tagName: "DIV", text: "" },
      ];
      return { count: matches.length, matches };
    }
    throw new Error("BROWSER_TARGET_INVALID");
  }

  public async wait(): Promise<void> {}

  public async attachFile(input: Parameters<AttachmentMutationBrowser["attachFile"]>[0]): Promise<void> {
    this.attachmentBatches.push(input);
  }
}

class OutcomeUnknownAttachmentLeaseFixture extends AttachmentLeaseFixture {
  public override async attachFile(): Promise<void> {
    throw new Error("BROWSER_OUTCOME_UNKNOWN");
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
  assert.deepEqual(
    completed.attachmentUploadProof.files.map((file) => file.displayFileName),
    ["001_01-fixture.json", "002_02-fixture.json"],
    "attachment display names are deterministic across process attempts",
  );
  assert.equal(browser.surfaceReads, 2, "attachment flow uses one precondition surface and one direct postcondition surface");
  assert.equal(
    browser.surfaceSelectors.every((selector) =>
      selector.includes("form:has(#prompt-textarea)")
      && !selector.includes("#upload-files")
      && !selector.includes("#composer-submit-button")
      && !selector.includes("button")
      && !selector.includes("aria-label")),
    true,
    "visible attachment permission must not duplicate the Browser Authority hidden target or pre-read send readiness",
  );
  assert.equal(
    browser.attachmentBatches.length,
    1,
    "exact attachments must stabilize before prompt entry even while the send button is correctly disabled",
  );

  const recoveredBrowser = new AttachmentLeaseFixture();
  recoveredBrowser.registeredNames.push("001_01-fixture.json", "002_02-fixture.json");
  let recoveredRegistrationCount = 0;
  const recovered = await attachApprovedWebChatFilesOnce({
    browser: recoveredBrowser,
    request: await buildRequest(dataDir, 2),
    context: {
      dataDir,
      registerBrowserFileArtifact: async () => { recoveredRegistrationCount += 1; },
      issueBrowserFileArtifactGrant: async (input) => grantFor(input.artifactRef, input.expectedSha256, input.maxBytes),
    },
  });
  assert.equal(recovered.attachmentUploadProof.status, "attachments_stable");
  assert.equal(recovered.uploadedFiles.length, 2);
  assert.equal(recoveredRegistrationCount, 0);
  assert.equal(recoveredBrowser.attachmentBatches.length, 0,
    "an exact deterministic attachment set after restart is recovered with zero mutation");
  assert.equal(recoveredBrowser.surfaceReads, 1,
    "restart recovery uses one current-surface decision and no polling ceremony");

  const unknownBrowser = new OutcomeUnknownAttachmentLeaseFixture();
  await assert.rejects(
    attachApprovedWebChatFilesOnce({
      browser: unknownBrowser,
      request: await buildRequest(dataDir, 1),
      context: {
        dataDir,
        registerBrowserFileArtifact: async (input) => {
          unknownBrowser.registeredNames.push(path.basename(input.filePath));
        },
        issueBrowserFileArtifactGrant: async (input) => grantFor(input.artifactRef, input.expectedSha256, input.maxBytes),
      },
    }),
    (error: unknown) => error instanceof WebChatAttachmentCapabilityFailure
      && error.attachmentUploadProof.status === "review_required"
      && error.uploadedFiles.length === 0,
    "an outcome-unknown attachment mutation must fail closed and never gain replay authority",
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

process.stdout.write("[ACCEPTANCE] AI Input Gateway attachment child uses deterministic names, zero-mutation restart recovery and at most one exact-target batch\n");
emitQualityProofObservation({ passed: true, findings: [], lawId: "LAW-AI-INPUT-GATEWAY-004-V1", evidenceMode: "exam.golden", clauses: ["forbidden:0","forbidden:1","forbidden:2","forbidden:3","summary"], locator: "acceptance:attachment:opaque-grant-proof", observedValue: "staged artifacts and opaque grants retain exact proof" });
emitQualityProofObservation({ passed: true, findings: [], lawId: "LAW-AI-INPUT-GATEWAY-007-V2", evidenceMode: "exam.golden", clauses: ["forbidden:0","summary"], locator: "acceptance:attachment:approved-input-refs", observedValue: "caller inputRefs bind staged file hashes and one exact-target batch" });
