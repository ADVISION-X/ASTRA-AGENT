import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { attachApprovedWebChatFilesOnce } from "../children/attach-approved-web-chat-files-once.js";
import { AiFeedInputSchema } from "../schema.js";
import type {
  BrowserTargetSession,
  BrowserStateSnapshot,
} from "../../../lib/browser/browser-controller.js";
import {
  actionResult,
  readExpectedAttachmentNames,
  readExpectedPageUrl,
} from "./attachment-script-fixture-support.js";
const ATTACHMENT_STABILITY_REQUIRED_DURATION_MS = 30_000;
const sha256 = (bytes: Buffer): `sha256:${string}` =>
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
      sha256: sha256(bytes),
      byteCount: bytes.byteLength,
    });
  }
  return AiFeedInputSchema.parse({
    providerKind: "gpt-web-chat",
    taskIdentity: {
      labelKey: "system_acceptance",
      sourceProject: "agent",
      taskKind: "attachment-acceptance",
      sourceTaskId: `attachment-${fileCount}`,
    },
    promptPackageId: `attachment-acceptance-${fileCount}`,
    promptContractId: "attachment-acceptance-v1",
    expectedOutputSchemaRef: null,
    textPrompt: "Attachment child acceptance prompt.",
    inputRefs,
    modelName: null,
    timeoutMs: 180_000,
    maxInputChars: 10_000,
    maxFileCount: fileCount,
    requestedBy: "acceptance-test",
    missionId: "attachment-acceptance",
    runId: `attachment-${fileCount}`,
    roundId: `attachment-${fileCount}:1`,
  });
};

type FixtureBrowserInput = {
  fileInputMutationOk?: boolean;
  invalidFileInputTopology?: boolean;
  onFileInput?: (filePath: string) => Promise<void>;
  identityDriftAfterSelection?: boolean;
  conversationTurnLeakAfterSelection?: boolean;
  pendingAtExactRead?: number;
};

const buildFixtureExactAttachmentEvaluation = (input: {
  fixture: FixtureBrowserInput;
  script: string;
  currentNames: string[];
  currentUrl: string;
  exactReadCount: number;
}) => {
  const expectedNames = readExpectedAttachmentNames(input.script);
  const expectedUrl = readExpectedPageUrl(input.script);
  const identityMatches = expectedUrl === null || input.currentUrl === expectedUrl;
  const conversationTurnCountInScope = input.fixture.conversationTurnLeakAfterSelection
    && input.currentNames.length > 0
    ? 1
    : 0;
  const forcedPending = input.fixture.pendingAtExactRead === input.exactReadCount;
  const exactNames = input.currentNames.length === expectedNames.length
    && input.currentNames.every((name) => expectedNames.includes(name));
  const status = !identityMatches || conversationTurnCountInScope > 0
    ? "review_required"
    : forcedPending || !exactNames
      ? "pending"
      : "success";
  return {
    status,
    message: !identityMatches
      ? "WEB_CHAT_PROVIDER_IDENTITY_DRIFT"
      : conversationTurnCountInScope > 0
        ? "WEB_CHAT_COMPOSER_SCOPE_AMBIGUOUS"
        : "fixture attachment count",
    pageUrl: input.currentUrl,
    attachmentCount: input.currentNames.length,
    attachmentNames: input.currentNames,
    attachmentScope: "composer",
    composerCandidateCount: 1,
    composerRootCount: 1,
    conversationTurnCountInScope,
    generalFileInputCount: 1,
    imageFileInputCountInScope: 0,
    pendingAttachmentCount: forcedPending ? 1 : 0,
    sendReady: !forcedPending,
    attachmentDelta: input.currentNames.length,
    composerTextLength: 0,
  };
};

class FixtureBrowserController implements BrowserTargetSession {
  private currentNames: string[] = [];
  private currentUrl = "https://chatgpt.com/";
  private exactReadCount = 0;
  readonly actionLabels: string[] = [];
  readonly waitDurations: number[] = [];
  lastPendingWaitCount: number | null = null;

  constructor(private readonly input: FixtureBrowserInput) {}

  getHealth() {
    return { ok: true, detail: "fixture" };
  }

  getSessionState(): BrowserStateSnapshot {
    return {
      open: true,
      currentUrl: this.currentUrl,
      currentTitle: "ChatGPT",
      browserExecutable: "fixture",
      browserMode: "fixture",
      browserProfileRef: "fixture",
      browserExecutablePath: null,
      profileStatus: "profile_ready",
      profileDirectory: "fixture",
      profileProvisioning: "managed_default",
      profileVerificationStatus: "default_unverified",
      profileVerificationReason: null,
      loginState: "logged_in",
      lastLoginCheckAt: new Date().toISOString(),
      loginRequiredReason: null,
      reviewRequiredReason: null,
    };
  }

  async getGeometrySnapshot(): Promise<never> {
    throw new Error("not used");
  }

  async open() {
    return actionResult("open");
  }

  async scroll() {
    return actionResult("scroll");
  }

  async click(input: Parameters<BrowserTargetSession["click"]>[0]) {
    this.actionLabels.push(input.targetLabel);
    return actionResult("click");
  }

  async clickLocatedDomElement() {
    return actionResult("dom-click");
  }

  async textInput() {
    return actionResult("text");
  }

  async screenshotRegion(): Promise<never> {
    throw new Error("not used");
  }

  async evaluate<T>(evaluation: { script: string; description: string }): Promise<T> {
    if (evaluation.description === "clear stale AI web chat draft and attachments") {
      this.currentNames = [];
      return {
        status: "success",
        message: "fixture composer cleared",
        pageUrl: this.currentUrl,
        composerTextLength: 0,
      } as T;
    }
    if (evaluation.description === "read exact fresh web chat composer attachment state") {
      this.exactReadCount += 1;
      const result = buildFixtureExactAttachmentEvaluation({
        fixture: this.input,
        script: evaluation.script,
        currentNames: this.currentNames,
        currentUrl: this.currentUrl,
        exactReadCount: this.exactReadCount,
      });
      if (result.status === "pending") this.lastPendingWaitCount = this.waitDurations.length;
      return result as T;
    }
    if (evaluation.description === "locate the unique ChatGPT document file input") {
      return {
        status: this.input.invalidFileInputTopology ? "review_required" : "success",
        message: this.input.invalidFileInputTopology
          ? "CHATGPT_DOCUMENT_FILE_INPUT_AMBIGUOUS"
          : "ChatGPT exact document file input ready",
        pageUrl: this.currentUrl,
        candidateCount: this.input.invalidFileInputTopology ? 0 : 1,
      } as T;
    }
    return {
      status: "success",
      message: "fixture DOM action",
      pageUrl: this.currentUrl,
    } as T;
  }

  async setFileInputFiles(input: Parameters<BrowserTargetSession["setFileInputFiles"]>[0]) {
    this.actionLabels.push(input.description);
    await this.input.onFileInput?.(input.filePath);
    if (this.input.fileInputMutationOk === false) {
      return { ...actionResult("file-input"), ok: false, message: "FILE_INPUT_MUTATION_FAILED" };
    }
    this.currentNames.push(path.basename(input.filePath));
    if (this.input.identityDriftAfterSelection) {
      this.currentUrl = "https://chatgpt.com/c/identity-drift";
    }
    return actionResult("file-input");
  }

  async wait(durationMs: number) {
    this.waitDurations.push(durationMs);
    return actionResult("wait");
  }

  async closeTarget() {
    return actionResult("close-tab");
  }

  async close() {
    return actionResult("close");
  }
}

const buildBrowser = (input: FixtureBrowserInput = {}): BrowserTargetSession => new FixtureBrowserController(input);

const dataDir = await mkdtemp(path.join(tmpdir(), "attachment-child-"));
try {
  const zeroProofs = [];
  const zero = await attachApprovedWebChatFilesOnce({
    browser: buildBrowser(),
    request: await buildRequest(dataDir, 0),
    context: {
      dataDir,
      onAttachmentUploadCompleted: async (proof) => {
        zeroProofs.push(proof);
      },
    },
  });
  assert.equal(zero.attachmentUploadProof.status, "skipped");
  assert.equal(zeroProofs.length, 1);

  const single = await attachApprovedWebChatFilesOnce({ browser: buildBrowser(), request: await buildRequest(dataDir, 1), context: { dataDir } });
  assert.deepEqual(
    [single.attachmentUploadProof.transportKind, single.attachmentUploadProof.status, single.attachmentUploadProof.detectedFileCount],
    ["exact_target_file_input_batch", "attachments_stable", 1],
  );

  for (const fileCount of [2, 10]) {
    let observedStagingDirectory: string | null = null;
    const observedFilePaths: string[] = [];
    let callbackCount = 0;
    const result = await attachApprovedWebChatFilesOnce({
      browser: buildBrowser({
        onFileInput: async (filePath) => {
          observedStagingDirectory = path.dirname(filePath);
          observedFilePaths.push(filePath);
          assert.equal(existsSync(filePath), true);
        },
      }),
      request: await buildRequest(dataDir, fileCount),
      context: {
        dataDir,
        onAttachmentUploadCompleted: async () => {
          callbackCount += 1;
        },
      },
    });
    assert.equal(result.attachmentUploadProof.transportKind, "exact_target_file_input_batch");
    assert.equal(result.attachmentUploadProof.status, "attachments_stable");
    assert.equal(result.attachmentUploadProof.expectedFileCount, fileCount);
    assert.equal(result.attachmentUploadProof.detectedFileCount, fileCount);
    assert.equal(result.attachmentUploadProof.files.length, fileCount);
    assert.equal(observedFilePaths.length, fileCount);
    assert.equal(new Set(result.attachmentUploadProof.files.map((file) => file.displayFileName)).size, fileCount);
    assert.match(result.attachmentUploadProof.stagingManifestHash ?? "", /^sha256:[a-f0-9]{64}$/u);
    assert.equal(callbackCount, 1);
    assert.equal(observedStagingDirectory === null ? true : existsSync(observedStagingDirectory), false);
  }

  const pluginBrowser = new FixtureBrowserController({});
  const pluginResult = await attachApprovedWebChatFilesOnce({
    browser: pluginBrowser,
    request: await buildRequest(dataDir, 2),
    context: { dataDir },
  });
  assert.equal(pluginResult.attachmentUploadProof.status, "attachments_stable");
  assert.deepEqual(
    pluginBrowser.actionLabels,
    pluginResult.attachmentUploadProof.files.map(
      (file) => `set approved attachment ${file.displayFileName} on the ChatGPT document file input`,
    ),
    "attachment upload must use only exact-target plugin mutations without focus-mode actions",
  );

  let failureProofStatus: string | null = null;
  await assert.rejects(
    attachApprovedWebChatFilesOnce({
      browser: buildBrowser({ fileInputMutationOk: false }),
      request: await buildRequest(dataDir, 2),
      context: {
        dataDir,
        onAttachmentUploadCompleted: async (proof) => {
          failureProofStatus = proof.status;
        },
      },
    }),
    /CHATGPT_DOCUMENT_FILE_INPUT_MUTATION_FAILED/u,
  );
  assert.equal(failureProofStatus, "review_required");

  await assert.rejects(
    attachApprovedWebChatFilesOnce({
      browser: buildBrowser({ invalidFileInputTopology: true }),
      request: await buildRequest(dataDir, 2),
      context: { dataDir },
    }),
    /CHATGPT_DOCUMENT_FILE_INPUT_AMBIGUOUS/u,
  );

  await assert.rejects(
    attachApprovedWebChatFilesOnce({
      browser: buildBrowser({ identityDriftAfterSelection: true }),
      request: await buildRequest(dataDir, 2),
      context: { dataDir },
    }),
    /WEB_CHAT_PROVIDER_IDENTITY_DRIFT/u,
  );

  await assert.rejects(
    attachApprovedWebChatFilesOnce({
      browser: buildBrowser({ conversationTurnLeakAfterSelection: true }),
      request: await buildRequest(dataDir, 2),
      context: { dataDir },
    }),
    /WEB_CHAT_COMPOSER_SCOPE_AMBIGUOUS/u,
  );

  const resetBrowser = new FixtureBrowserController({ pendingAtExactRead: 4 });
  const resetResult = await attachApprovedWebChatFilesOnce({
    browser: resetBrowser,
    request: await buildRequest(dataDir, 2),
    context: { dataDir },
  });
  assert.equal(resetResult.attachmentUploadProof.status, "attachments_stable");
  assert.notEqual(resetBrowser.lastPendingWaitCount, null, "fixture must force a late pending observation");
  const continuousStableWaits = resetBrowser.waitDurations.slice(resetBrowser.lastPendingWaitCount!);
  assert.deepEqual(
    continuousStableWaits,
    Array.from({ length: 15 }, () => 2_000),
    "a pending observation must reset the stability window before fifteen full two-second waits",
  );
  assert.equal(
    continuousStableWaits.reduce((total, durationMs) => total + durationMs, 0),
    ATTACHMENT_STABILITY_REQUIRED_DURATION_MS,
    "attachments_stable must require one continuous deterministic thirty-second window",
  );

  const childSource = await readFile(
    path.resolve("src/capabilities/ai-input-gateway/children/attach-approved-web-chat-files-once.ts"),
    "utf8",
  );
  assert.equal(childSource.includes("fallback"), false);
  assert.match(childSource, /stablePollCount = 0/u);
  assert.match(childSource, /expectedPageUrl/u);
  assert.equal(childSource.includes("native_picker"), false);
  assert.equal(childSource.includes("ordered_clipboard"), false);
  assert.equal(existsSync(path.resolve("src/capabilities/ai-input-gateway/providers/web-chat-native-picker-attachment.ts")), false);
  assert.equal(existsSync(path.resolve("src/capabilities/ai-input-gateway/providers/web-chat-ordered-clipboard-attachment.ts")), false);
  const clearSource = await readFile(
    path.resolve("src/capabilities/ai-input-gateway/providers/web-chat-page-action-scripts.ts"),
    "utf8",
  );
  assert.equal(clearSource.includes('document.querySelectorAll("button")'), false);
  assert.match(clearSource, /composerRoot\.querySelectorAll\("button"\)/u);
  const evaluationSource = await readFile(
    path.resolve("src/capabilities/ai-input-gateway/providers/web-chat-evaluation.ts"),
    "utf8",
  );
  assert.match(
    evaluationSource,
    /promptSuffixBoundToExpectedTurn/u,
  );
  assert.match(evaluationSource, /WEB_CHAT_FOREIGN_TURN_REBOUND/u);
  assert.match(evaluationSource, /visibleConversationBusy/u);
  assert.equal(
    evaluationSource.includes(
      "Boolean(document.querySelector('[aria-busy=\"true\"]'))",
    ),
    false,
  );
  const sharedSource = await readFile(
    path.resolve("src/capabilities/ai-input-gateway/providers/web-chat-shared.ts"),
    "utf8",
  );
  assert.ok(
    sharedSource.indexOf("const preSubmit = await readPreSubmitConversationState")
      < sharedSource.indexOf("const attachmentResult = await attachApprovedWebChatFilesOnce"),
    "continuation history must stabilize before any attachment upload",
  );
  const submittedAttachmentSource = await readFile(
    path.resolve("src/capabilities/ai-input-gateway/providers/web-chat-submitted-attachment-evaluation.ts"),
    "utf8",
  );
  assert.match(submittedAttachmentSource, /matchingUserMessages\.length !== 1/u);
  assert.match(submittedAttachmentSource, /internally marked submitted user message contains exact bound file attachment set/u);
  assert.equal(submittedAttachmentSource.includes("previousUserMessageCount"), false);
  assert.equal(existsSync(path.resolve("src/capabilities/ai-input-gateway/providers/web-chat-upload.ts")), false);
} finally {
  await rm(dataDir, { recursive: true, force: true });
}

process.stdout.write("[ACCEPTANCE] AI Input Gateway attachment child PASS\n");
