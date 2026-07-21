import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createAiInputGatewayAbilityGroup,
  type AiFeedInput,
  type AiProviderAdapter,
} from "../../src/capabilities/ai-input-gateway/index.js";

const delay = (durationMs: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, durationMs));

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

const waitForFile = async (filePath: string, timeoutMs: number): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await fileExists(filePath)) return;
    await delay(25);
  }
  throw new Error(`Timed out waiting for acceptance marker ${path.basename(filePath)}`);
};

const buildRequest = (role: string): AiFeedInput => ({
  providerKind: "gpt-web-chat",
  promptPackageId: `provider-lease-${role}`,
  promptContractId: "ai-input-gateway-provider-lease.acceptance",
  expectedOutputSchemaRef: null,
  textPrompt: `provider lease acceptance ${role}`,
  inputRefs: [],
  modelName: null,
  timeoutMs: 5_000,
  maxInputChars: 1_000,
  maxFileCount: 0,
  maxFileBytes: 1,
  requestedBy: "acceptance-test",
  missionId: null,
  runId: `provider-lease-${role}`,
  roundId: `provider-lease-${role}`,
});

const runWorker = async (dataDir: string, role: "first" | "second"): Promise<void> => {
  const enteredAdapterMarker = path.join(dataDir, `${role}-entered-adapter`);
  const releaseFirstMarker = path.join(dataDir, "release-first");
  const resultPath = path.join(dataDir, `${role}-result.json`);
  const adapter: AiProviderAdapter = {
    providerKind: "gpt-web-chat",
    async feed() {
      await writeFile(enteredAdapterMarker, role, "utf8");
      if (role === "first") await waitForFile(releaseFirstMarker, 4_000);
      return {
        rawText: `provider lease acceptance ${role}`,
        modelName: "acceptance-fixture",
        runtimeName: "acceptance-fixture",
        transport: "web-chat",
        webChatUrl: "https://chatgpt.com/",
        sourcePageUrlBeforeFeed: null,
        restoredSourcePage: null,
      };
    },
  };
  const gateway = createAiInputGatewayAbilityGroup({
    dataDir,
    adapters: { "gpt-web-chat": adapter },
  });
  const result = await gateway.execute(buildRequest(role));
  await writeFile(resultPath, JSON.stringify(result), "utf8");
  if (result.status !== "success") throw new Error(result.failureReason ?? "provider lease worker failed");
};

const workerArgs = process.argv.slice(2);
if (workerArgs[0] === "--worker") {
  const dataDir = workerArgs[1];
  const role = workerArgs[2];
  if (!dataDir || (role !== "first" && role !== "second")) throw new Error("invalid provider lease worker arguments");
  await runWorker(dataDir, role);
} else {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "grasseye-web-chat-lease-"));
  const scriptPath = fileURLToPath(import.meta.url);
  const spawnWorker = (role: "first" | "second") => spawn(
    process.execPath,
    ["--import", "tsx", scriptPath, "--worker", dataDir, role],
    { cwd: process.cwd(), stdio: "inherit" },
  );
  const waitForExit = (child: ReturnType<typeof spawnWorker>): Promise<void> => new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`provider lease worker exited code=${String(code)} signal=${String(signal)}`));
    });
  });

  try {
    const first = spawnWorker("first");
    await waitForFile(path.join(dataDir, "first-entered-adapter"), 4_000);
    const second = spawnWorker("second");
    await delay(300);
    assert.equal(
      await fileExists(path.join(dataDir, "second-entered-adapter")),
      false,
      "second web-chat provider must not enter its adapter while the first facade execution owns the lease",
    );
    await writeFile(path.join(dataDir, "release-first"), "release", "utf8");
    await Promise.all([waitForExit(first), waitForExit(second)]);
    assert.equal(await fileExists(path.join(dataDir, "second-entered-adapter")), true);
    const firstResult = JSON.parse(await readFile(path.join(dataDir, "first-result.json"), "utf8")) as { providerProof?: { providerLeaseId?: string } };
    const secondResult = JSON.parse(await readFile(path.join(dataDir, "second-result.json"), "utf8")) as { providerProof?: { providerLeaseId?: string } };
    assert.match(firstResult.providerProof?.providerLeaseId ?? "", /^web-chat-provider-lease:/u);
    assert.match(secondResult.providerProof?.providerLeaseId ?? "", /^web-chat-provider-lease:/u);
    assert.notEqual(firstResult.providerProof?.providerLeaseId, secondResult.providerProof?.providerLeaseId);
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }

  process.stdout.write("[ACCEPTANCE][ai-input-gateway-provider-lease] PASS\n");
}
