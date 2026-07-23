import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  attachApprovedWebChatFilesOnce,
  resolveWebChatAttachmentTransportKind,
} from "../children/attach-approved-web-chat-files-once.js";
import { AiFeedInputSchema } from "../schema.js";
import type {
  BrowserController,
  BrowserStateSnapshot,
} from "../../../lib/browser/browser-controller.js";
import { parseNativeMultiFilePickerOutput } from "../../../lib/browser/current-chrome-native-multi-file-picker.js";

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
  onNativePicker?: (directoryPath: string, names: string[]) => Promise<void>;
};

const actionResult = (browserActionId: string) => ({
  browserActionId,
  ok: true,
  message: "ok",
  createdAt: new Date().toISOString(),
});

class FixtureBrowserController implements BrowserController {
  private currentNames: string[] = [];

  constructor(private readonly input: FixtureBrowserInput) {}

  getHealth() {
    return { ok: true, detail: "fixture" };
  }

  getSessionState(): BrowserStateSnapshot {
    return {
      open: true,
      currentUrl: "https://chatgpt.com/",
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

  async click() {
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

  async evaluateActiveTab<T>(evaluation: { script: string; description: string }): Promise<T> {
    if (evaluation.description === "wait for exact web chat attachment count") {
      const namesMatch = evaluation.script.match(/const expectedFileNames = (\[[^\n]+\]);/u);
      const expectedNames = namesMatch ? JSON.parse(namesMatch[1]!) as string[] : [];
      return {
        status: this.currentNames.length === expectedNames.length ? "success" : "pending",
        message: "fixture attachment count",
        pageUrl: "https://chatgpt.com/",
        attachmentCount: this.currentNames.length,
        attachmentNames: this.currentNames,
        attachmentScope: "input",
      } as T;
    }
    return {
      status: "success",
      message: "fixture DOM action",
      pageUrl: "https://chatgpt.com/",
      ...(evaluation.description === "choose ChatGPT local file upload action"
        ? { targetPoint: { x: 100, y: 100 } }
        : {}),
    } as T;
  }

  async setFileInputFiles() {
    return actionResult("file-input");
  }

  async selectFilesInNativePicker({
      stagingDirectoryPath,
      expectedFileNames,
    }: Parameters<NonNullable<BrowserController["selectFilesInNativePicker"]>>[0]) {
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
    this.currentNames = [...expectedFileNames];
    return {
      browserActionId: "native-picker",
      ok: true,
      message: "selected",
      createdAt: new Date().toISOString(),
      observedFileNames: [...expectedFileNames],
    };
  }

  async wait() {
    return actionResult("wait");
  }

  async closeActiveTab() {
    return actionResult("close-tab");
  }

  async close() {
    return actionResult("close");
  }
}

const buildBrowser = (input: FixtureBrowserInput = {}): BrowserController =>
  new FixtureBrowserController(input);

assert.equal(resolveWebChatAttachmentTransportKind({ providerKind: "gpt-web-chat", fileCount: 0 }), "skipped");
assert.equal(resolveWebChatAttachmentTransportKind({ providerKind: "gpt-web-chat", fileCount: 1 }), "ordered_clipboard");
assert.equal(resolveWebChatAttachmentTransportKind({ providerKind: "gpt-web-chat", fileCount: 2 }), "native_picker_batch");
assert.equal(resolveWebChatAttachmentTransportKind({ providerKind: "gemini-web-chat", fileCount: 17 }), "ordered_clipboard");
assert.deepEqual(
  parseNativeMultiFilePickerOutput("SUCCESS\n001.json\n002.json\n003.json").observedFileNames,
  ["001.json", "002.json", "003.json"],
);
assert.equal(
  parseNativeMultiFilePickerOutput("FAILED\nNATIVE_FILE_LIST_MISMATCH").message,
  "NATIVE_FILE_LIST_MISMATCH",
);
const schemaDirectory = await mkdtemp(path.join(tmpdir(), "attachment-schema-"));
const schemaBaseRequest = await buildRequest(schemaDirectory, 0);
assert.throws(() => AiFeedInputSchema.parse({
  ...schemaBaseRequest,
  transportKind: "native_picker_batch",
}), /unrecognized/i);
await rm(schemaDirectory, { recursive: true, force: true });

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

  const childSource = await readFile(
    path.resolve("src/capabilities/ai-input-gateway/children/attach-approved-web-chat-files-once.ts"),
    "utf8",
  );
  assert.equal(childSource.includes("fallback"), false);
  assert.equal(existsSync(path.resolve("src/capabilities/ai-input-gateway/providers/web-chat-upload.ts")), false);
} finally {
  await rm(dataDir, { recursive: true, force: true });
}

process.stdout.write("[ACCEPTANCE] AI Input Gateway attachment child PASS\n");
