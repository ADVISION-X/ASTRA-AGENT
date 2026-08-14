import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
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
    maxFileBytes: 10_000,
    requestedBy: "acceptance-test",
    missionId: "attachment-acceptance",
    runId: `attachment-${fileCount}`,
    roundId: `attachment-${fileCount}:1`,
  });
};

type FixtureBrowserInput = {
  nativeSelectionOk?: boolean;
  reverseNativeSelectionOrder?: boolean;
  onNativePicker?: (directoryPath: string, names: string[]) => Promise<void>;
  identityDriftAfterSelection?: boolean;
  conversationTurnLeakAfterSelection?: boolean;
  pendingAtExactRead?: number;
  staleSearchDialog?: boolean;
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
  private searchDialogVisible: boolean;
  readonly actionLabels: string[] = [];
  readonly waitDurations: number[] = [];
  lastPendingWaitCount: number | null = null;

  constructor(private readonly input: FixtureBrowserInput) {
    this.searchDialogVisible = input.staleSearchDialog === true;
  }

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
    if (
      input.targetLabel
      === "close the uniquely identified ChatGPT chat-search dialog"
    ) {
      this.searchDialogVisible = false;
    }
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
    if (
      evaluation.description === "locate visible ChatGPT chat-search close action"
      || evaluation.description === "verify ChatGPT chat-search dialog closed"
    ) {
      return (
        this.searchDialogVisible
          ? {
              status: "close_located",
              message: "fixture search dialog close located",
              pageUrl: this.currentUrl,
              targetPoint: { x: 40, y: 40 },
            }
          : {
              status: "not_found",
              message: "fixture search dialog absent",
              pageUrl: this.currentUrl,
            }
      ) as T;
    }
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
    if (
      evaluation.description === "open ChatGPT attachment menu"
      && this.searchDialogVisible
    ) {
      return {
        status: "review_required",
        message: "fixture search dialog obscures attachment menu",
        pageUrl: this.currentUrl,
      } as T;
    }
    return {
      status: "success",
      message: "fixture DOM action",
      pageUrl: this.currentUrl,
      ...(evaluation.description === "choose ChatGPT local file upload action"
        ? { targetPoint: { x: 100, y: 100 } }
        : {}),
    } as T;
  }

  async setFileInputFiles() { return actionResult("file-input"); }
  async pasteFileFromSystemClipboard({ filePath }: Parameters<NonNullable<BrowserTargetSession["pasteFileFromSystemClipboard"]>>[0]) {
    const fileName = path.basename(filePath);
    this.actionLabels.push(`focus-lease clipboard ${fileName}`); this.currentNames = [...this.currentNames, fileName];
    return { ...actionResult("system-clipboard"), focusLeaseId: "fixture-focus-lease" };
  }

  async selectFilesInNativePicker({ stagingDirectoryPath, expectedFileNames }:
    Parameters<NonNullable<BrowserTargetSession["selectFilesInNativePicker"]>>[0]) {
    this.actionLabels.push("select the exact approved staged file set");
    await this.input.onNativePicker?.(stagingDirectoryPath, expectedFileNames);
    if (this.input.nativeSelectionOk === false) {
      return {
        browserActionId: "native-picker",
        ok: false,
        message: "NATIVE_SELECTION_UNPROVEN",
        createdAt: new Date().toISOString(),
        observedFileNames: [],
      };
    }
    const observedFileNames = this.input.reverseNativeSelectionOrder
      ? [...expectedFileNames].reverse()
      : [...expectedFileNames];
    this.currentNames = [...observedFileNames];
    if (this.input.identityDriftAfterSelection) {
      this.currentUrl = "https://chatgpt.com/c/identity-drift";
    }
    return {
      browserActionId: "native-picker",
      ok: true,
      message: "selected",
      createdAt: new Date().toISOString(),
      observedFileNames,
    };
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
    ["ordered_clipboard", "attachments_stable", 1],
  );

  for (const fileCount of [2, 17]) {
    let observedStagingDirectory: string | null = null;
    let callbackCount = 0;
    const result = await attachApprovedWebChatFilesOnce({
      browser: buildBrowser({
        onNativePicker: async (directoryPath, names) => {
          observedStagingDirectory = directoryPath;
          assert.deepEqual((await readdir(directoryPath)).sort(), [...names].sort());
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
    assert.equal(result.attachmentUploadProof.transportKind, "native_picker_batch");
    assert.equal(result.attachmentUploadProof.status, "attachments_stable");
    assert.equal(result.attachmentUploadProof.expectedFileCount, fileCount);
    assert.equal(result.attachmentUploadProof.detectedFileCount, fileCount);
    assert.equal(result.attachmentUploadProof.files.length, fileCount);
    assert.equal(new Set(result.attachmentUploadProof.files.map((file) => file.displayFileName)).size, fileCount);
    assert.match(result.attachmentUploadProof.stagingManifestHash ?? "", /^sha256:[a-f0-9]{64}$/u);
    assert.equal(callbackCount, 1);
    assert.equal(observedStagingDirectory === null ? true : existsSync(observedStagingDirectory), false);
  }

  const staleDialogBrowser = new FixtureBrowserController({
    staleSearchDialog: true,
  });
  const staleDialogResult = await attachApprovedWebChatFilesOnce({
    browser: staleDialogBrowser,
    request: await buildRequest(dataDir, 2),
    context: { dataDir },
  });
  assert.equal(staleDialogResult.attachmentUploadProof.status, "attachments_stable");
  assert.deepEqual(
    staleDialogBrowser.actionLabels.slice(0, 3),
    [
      "close the uniquely identified ChatGPT chat-search dialog",
      "uniquely located ChatGPT local file upload menu item",
      "select the exact approved staged file set",
    ],
    "a uniquely classified stale search dialog must close before the attachment picker opens",
  );

  let failureProofStatus: string | null = null;
  await assert.rejects(
    attachApprovedWebChatFilesOnce({
      browser: buildBrowser({ nativeSelectionOk: false }),
      request: await buildRequest(dataDir, 2),
      context: {
        dataDir,
        onAttachmentUploadCompleted: async (proof) => {
          failureProofStatus = proof.status;
        },
      },
    }),
    /NATIVE_SELECTION_UNPROVEN/u,
  );
  assert.equal(failureProofStatus, "review_required");

  await assert.rejects(
    attachApprovedWebChatFilesOnce({
      browser: buildBrowser({ reverseNativeSelectionOrder: true }),
      request: await buildRequest(dataDir, 2),
      context: { dataDir },
    }),
    /NATIVE_PICKER_SELECTION_ORDER_MISMATCH/u,
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
