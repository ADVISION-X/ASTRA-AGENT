import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { createGptAbilityGroup } from "../../src/capabilities/gpt/index.js";
import { createForensicsPersistenceAbilityGroupFromStorage } from "../../src/capabilities/forensics-persistence/index.js";
import { startProductionRuntime } from "../../src/lib/local-runtime/production/runtime.js";
import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import { createGrassEyeFileStorage } from "../../src/lib/storage/index.js";
import { HASH_A } from "./agent-production-runtime-fixtures.js";

const temporary = await mkdtemp(path.join(tmpdir(), "agent-production-startup-"));
const previousCredentialPath = process.env.AGENT_PRODUCTION_CREDENTIAL_FILE;
process.env.AGENT_PRODUCTION_CREDENTIAL_FILE = path.join(temporary, "missing-credential.json");
try {
  const browserAuthority = {
    readProductionRuntimeState: () => ({
      browserAuthorityState: "absent" as const,
      browserTargetState: "absent" as const,
    }),
  };
  const blockedShellDirectory = path.join(temporary, "blocked-shell");
  const crashOrphanDirectory = path.join(blockedShellDirectory, "generated-images", "crash-orphan-mutant");
  await mkdir(crashOrphanDirectory, { recursive: true });
  await writeFile(path.join(crashOrphanDirectory, "orphan.original"), "orphan", { mode: 0o600 });
  const blocked = await startProductionRuntime({
    dataDir: blockedShellDirectory,
    sourceHash: HASH_A,
    gpt: createGptAbilityGroup(),
    evidenceStore: createForensicsPersistenceAbilityGroupFromStorage(createGrassEyeFileStorage(blockedShellDirectory)),
    browserAuthority: browserAuthority as never,
    runtimeLogger: createRuntimeLogger({
      producer: "agent-acceptance", owner: "app-shell", component: "production-runtime-acceptance",
      terminalEnabled: false, fileSink: { directoryPath: path.join(temporary, "runtime-logs") },
    }),
  });
  await assert.rejects(access(crashOrphanDirectory), { code: "ENOENT" });
  assert.equal(blocked.readHealth().shellState, "ready");
  assert.equal(blocked.readHealth().cloudState, "contract_blocked");
  assert.equal(blocked.readHealth().executionState, "blocked");
  await blocked.close();
} finally {
  if (previousCredentialPath === undefined) delete process.env.AGENT_PRODUCTION_CREDENTIAL_FILE;
  else process.env.AGENT_PRODUCTION_CREDENTIAL_FILE = previousCredentialPath;
  await rm(temporary, { recursive: true, force: true });
}

export const agentProductionStartupAcceptancePassed = true;
