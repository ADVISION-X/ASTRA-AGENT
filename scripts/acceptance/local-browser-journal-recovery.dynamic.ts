import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readBrowserProofJournal } from "../../src/lib/browser/exact-target/browser-proof-journal.js";
import { recoverBrowserProofJournal } from "../../src/lib/browser/exact-target/browser-proof-journal-recovery.js";

const root = await mkdtemp(join(tmpdir(), "grasseye-browser-recovery-proof-"));
const journalPath = join(root, "proof-events.ndjson");
const previousAuthorization = process.env.GRASSEYE_BROWSER_JOURNAL_RECOVERY_AUTHORIZED;

try {
  await writeFile(journalPath, '{"schemaVersion":"corrupt"}\n', { mode: 0o600 });
  await chmod(journalPath, 0o600);
  process.env.GRASSEYE_BROWSER_JOURNAL_RECOVERY_AUTHORIZED = "1";
  const input = {
    journalPath,
    operatorId: "ci-release-dynamic-proof",
    authorizationRef: "temporary-owned-fixture",
    reasonCode: "DYNAMIC_RECOVERY_PROOF",
    recoveredAt: new Date().toISOString(),
    assertExclusiveOwner: () => undefined,
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
    fixtureOwnership: "temporary-owned",
  })}\n`);
} finally {
  if (previousAuthorization === undefined) delete process.env.GRASSEYE_BROWSER_JOURNAL_RECOVERY_AUTHORIZED;
  else process.env.GRASSEYE_BROWSER_JOURNAL_RECOVERY_AUTHORIZED = previousAuthorization;
  await rm(root, { recursive: true, force: true });
}
