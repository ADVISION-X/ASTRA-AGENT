import { join, resolve } from "node:path";

import { BrowserOwnerLock } from "../infrastructure/browser-owner-lock.js";
import { recoverBrowserProofJournal } from "./browser-proof-journal-recovery.js";

const argument = (name: string): string => {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error(`BROWSER_JOURNAL_RECOVERY_ARGUMENT_REQUIRED:${name}`);
  return value;
};

const dataDir = resolve(process.env.GRASSEYE_DATA_DIR?.trim() || ".grasseye-local");
const lock = new BrowserOwnerLock(join(dataDir, "browser", "owner.lock"));
await lock.acquire();
try {
  const result = recoverBrowserProofJournal({
    journalPath: join(dataDir, "browser", "proof-events.ndjson"),
    operatorId: argument("operator"),
    authorizationRef: argument("authorization"),
    reasonCode: argument("reason"),
    assertExclusiveOwner: () => lock.assertHeld(),
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
} finally {
  await lock.release();
}
