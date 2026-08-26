import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";

import { readBrowserProofJournal } from "../../src/lib/browser/exact-target/browser-proof-journal.js";
import { recoverBrowserProofJournal } from "../../src/lib/browser/exact-target/browser-proof-journal-recovery.js";
import { BrowserOwnerLock } from "../../src/lib/browser/infrastructure/browser-owner-lock.js";

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  assert.ok(value, `${name} is required for an authorized recovery`);
  return value;
};
assert.equal(process.env.GRASSEYE_BROWSER_JOURNAL_RECOVERY_AUTHORIZED, "1");
const root = resolve(required("GRASSEYE_DATA_DIR"));
const journalPath = join(root, "browser", "proof-events.ndjson");
const lock = new BrowserOwnerLock(join(root, "browser", "owner.lock"));

await lock.acquire();
try {
  const input = {
    journalPath,
    operatorId: required("GRASSEYE_BROWSER_JOURNAL_RECOVERY_OPERATOR"),
    authorizationRef: required("GRASSEYE_BROWSER_JOURNAL_RECOVERY_AUTHORIZATION_REF"),
    reasonCode: required("GRASSEYE_BROWSER_JOURNAL_RECOVERY_REASON"),
    assertExclusiveOwner: () => lock.assertHeld(),
  };
  const recovered = recoverBrowserProofJournal(input);
  assert.equal(recovered.status, "RECOVERED");
  assert.equal((await stat(recovered.archivePath)).mode & 0o777, 0o400);
  assert.equal((await stat(recovered.recoveryReceiptPath)).mode & 0o777, 0o400);
  assert.ok((await readFile(recovered.archivePath, "utf8")).includes('"corrupt"'));
  const journal = readBrowserProofJournal(journalPath);
  assert.equal(journal.length, 1);
  assert.equal(journal[0]!.event.eventType, "RECOVERY");
  assert.equal(recoverBrowserProofJournal(input).status, "ALREADY_RECOVERED");
  process.stdout.write(`${JSON.stringify({
    status: "RECOVERY_VERIFIED",
    recoveryId: recovered.recoveryId,
    firstInvalidLine: recovered.firstInvalidLine,
    dataRoot: root,
  })}\n`);
  emitQualityProofObservation({ passed: true, findings: [], lawId: "LAW-LOCAL-BROWSER-SESSION-004-V8", evidenceMode: "dynamic.recovery", clauses: ["forbidden:12","forbidden:13","forbidden:14","forbidden:15","summary"],
    locator: recovered.recoveryReceiptPath, receipt: recovered.recoveryId.slice("sha256:".length),
    observedValue: `recoveryId=${recovered.recoveryId};firstInvalidLine=${recovered.firstInvalidLine}` });
} finally {
  await lock.release();
}
