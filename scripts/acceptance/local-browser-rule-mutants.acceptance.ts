import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BROWSER_ERROR_CODES } from "../../src/lib/browser/protocol/generated/browser-protocol.generated.js";
import { BrowserOwnerLock } from "../../src/lib/browser/infrastructure/browser-owner-lock.js";
import { readBrowserProofJournal } from "../../src/lib/browser/exact-target/browser-proof-journal.js";
import { recoverBrowserProofJournal } from "../../src/lib/browser/exact-target/browser-proof-journal-recovery.js";

const expected = [
  "BROWSER_INSTALL_INVALID", "BROWSER_HOST_UNAVAILABLE", "BROWSER_ORIGIN_REJECTED", "BROWSER_EXTENSION_UNVERIFIED",
  "BROWSER_ACTIVATION_TUPLE_INVALID", "BROWSER_AUTH_TRANSCRIPT_INVALID", "BROWSER_CAPABILITY_REJECTED", "BROWSER_PROFILE_UNVERIFIED",
  "BROWSER_PROCESS_UNVERIFIED", "BROWSER_POLICY_UNVERIFIED", "BROWSER_LIVENESS_EXPIRED", "BROWSER_WORKER_FENCE_INVALID",
  "BROWSER_DUAL_ACTIVE_WORKER", "BROWSER_BACKPRESSURE", "BROWSER_FILE_GRANT_INVALID", "BROWSER_ROLLBACK_REJECTED",
  "BROWSER_REVOCATION_REJECTED", "BROWSER_COMMAND_PERMIT_INVALID", "BROWSER_TARGET_INVALID", "BROWSER_DOCUMENT_INVALID",
  "BROWSER_DEVTOOLS_CONFLICT", "BROWSER_OUTCOME_UNKNOWN", "BROWSER_REPAIR_REQUIRED",
] as const satisfies readonly (typeof BROWSER_ERROR_CODES)[number][];
assert.equal(BROWSER_ERROR_CODES.length, expected.length);
for (const code of expected) assert.equal(BROWSER_ERROR_CODES.includes(code), true, `missing mutant target ${code}`);
const recovery = readFileSync("src/lib/browser/exact-target/browser-proof-journal-recovery.ts", "utf8");
const journal = readFileSync("src/lib/browser/exact-target/browser-proof-journal.ts", "utf8");
assert.match(recovery, /process\.env\[RECOVERY_AUTHORIZATION_ENV\] !== "1"/u, "mutant removing explicit human recovery authorization must fail");
assert.match(recovery, /input\.assertExclusiveOwner\(\)/u, "mutant removing exclusive Owner proof must fail");
assert.match(recovery, /ensureExactSealedFile\(archivePath, original\)/u, "mutant skipping byte-exact legacy archive must fail");
assert.match(recovery, /sha256\(readFileSync\(archivePath\)\) !== originalJournalSha256/u, "mutant skipping archive hash verification must fail");
assert.match(recovery, /BROWSER_JOURNAL_RECOVERY_SOURCE_DRIFT/u, "mutant accepting source drift before atomic commit must fail");
assert.match(recovery, /renameSync\(temporaryPath, journalPath\)/u, "mutant replacing the canonical journal non-atomically must fail");
assert.match(journal, /recoveryCount > 1/u, "mutant allowing a second recovery genesis must fail");

const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === "object" ? Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, canonical(item)])) : value;
const hash = (value: unknown): `sha256:${string}` => `sha256:${createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex")}`;
const fixture = await mkdtemp(join(tmpdir(), "browser-proof-journal-recovery-"));
const journalPath = join(fixture, "browser", "proof-events.ndjson");
const lock = new BrowserOwnerLock(join(fixture, "browser", "owner.lock"));
const priorAuthorization = process.env.GRASSEYE_BROWSER_JOURNAL_RECOVERY_AUTHORIZED;
try {
  await mkdir(join(fixture, "browser"), { recursive: true });
  const firstCore = {
    schemaVersion: "grasseye.browser-proof-journal.v1", sequence: 1,
    previousEntryHash: `sha256:${"0".repeat(64)}`,
    event: { eventType: "LIFECYCLE", phase: "AUTHENTICATED", candidateHash: `sha256:${"1".repeat(64)}`,
      extensionId: "emkmbecadncngofidjgocmifhbonifgm", releaseBuildId: "first-release",
      recordedAt: "2026-08-24T00:00:00.000Z", authorityRefHash: `sha256:${"5".repeat(64)}` },
  } as const;
  const competingCore = { ...firstCore, event: { ...firstCore.event,
    candidateHash: `sha256:${"2".repeat(64)}`, releaseBuildId: "competing-release" } } as const;
  const corrupted = Buffer.from(`${JSON.stringify({ ...firstCore, entryHash: hash(firstCore) })}\n${JSON.stringify({ ...competingCore, entryHash: hash(competingCore) })}\n`);
  await writeFile(journalPath, corrupted, { mode: 0o600 });
  await lock.acquire();
  const input = { journalPath, operatorId: "operator:test", authorizationRef: "human-authorization:test",
    reasonCode: "FORKED_SEQUENCE", assertExclusiveOwner: () => lock.assertHeld(), recoveredAt: "2026-08-25T00:00:00.000Z" } as const;
  delete process.env.GRASSEYE_BROWSER_JOURNAL_RECOVERY_AUTHORIZED;
  assert.throws(() => recoverBrowserProofJournal(input), /BROWSER_JOURNAL_RECOVERY_NOT_AUTHORIZED/u);
  process.env.GRASSEYE_BROWSER_JOURNAL_RECOVERY_AUTHORIZED = "1";
  const recovered = recoverBrowserProofJournal(input);
  assert.equal(recovered.status, "RECOVERED");
  assert.equal(recovered.firstInvalidLine, 2);
  assert.deepEqual(await readFile(recovered.archivePath), corrupted);
  assert.equal(existsSync(recovered.recoveryReceiptPath), true);
  assert.deepEqual(readBrowserProofJournal(journalPath).map(({ event }) => event.eventType), ["RECOVERY"]);
  assert.equal(recoverBrowserProofJournal(input).status, "ALREADY_RECOVERED");
  assert.throws(() => recoverBrowserProofJournal({ ...input, authorizationRef: "different-authorization" }),
    /BROWSER_JOURNAL_RECOVERY_RECEIPT_CONFLICT/u);
} finally {
  if (priorAuthorization === undefined) delete process.env.GRASSEYE_BROWSER_JOURNAL_RECOVERY_AUTHORIZED;
  else process.env.GRASSEYE_BROWSER_JOURNAL_RECOVERY_AUTHORIZED = priorAuthorization;
  await lock.release().catch(() => undefined);
  await rm(fixture, { recursive: true, force: true });
}
console.log("LOCAL_BROWSER_RULE_MUTANTS_ACCEPTANCE_PASS");
