import path from "node:path";

import { resolveStoredBrowserMutationAuthority } from "../../src/lib/browser/exact-target/browser-mutation-authority.js";
import { resolveStoredProductionAuthority } from "../../src/lib/local-runtime/production/store.js";
import { diagnoseRuntimeLog, discoverRuntimeLogScope } from "../../src/lib/runtime-logs/index.js";

const args = process.argv.slice(2);
let jobId: string | null = null;
const sources: string[] = [];
for (let index = 0; index < args.length; index += 1) {
  const key = args[index];
  const value = args[index + 1];
  if (key === "--job" && value) { jobId = value; index += 1; continue; }
  if (key === "--source" && value) { sources.push(value); index += 1; continue; }
  throw new Error(`LOGS_INSPECT_ARGUMENT_INVALID:${key ?? "missing"}`);
}
if (sources.length === 0) throw new Error("LOGS_INSPECT_SOURCE_REQUIRED");

if (!jobId) {
  const scope = discoverRuntimeLogScope({ sources });
  if (scope.status !== "SELECTED") {
    process.stdout.write(`${JSON.stringify(scope, null, 2)}\n`);
    process.exitCode = scope.status === "NO_ACTIVE_SCOPE" ? 0 : 2;
  } else {
    jobId = scope.selectedTraceId;
  }
}

const dataDirForSource = (source: string): string | null => {
  let cursor = path.resolve(source);
  while (path.dirname(cursor) !== cursor) {
    if (path.basename(cursor) === "runtime-logs") return path.dirname(cursor);
    cursor = path.dirname(cursor);
  }
  return null;
};
const dataDirs = [...new Set(sources.map(dataDirForSource).filter((value): value is string => value !== null))];

const diagnosis = jobId ? diagnoseRuntimeLog({
  traceId: jobId,
  sources,
  authorityResolver: (authorityRef, authorityHash) => {
    for (const dataDir of dataDirs) {
      const production = resolveStoredProductionAuthority(dataDir, authorityRef, authorityHash);
      if (production !== "missing") return production;
      const browser = resolveStoredBrowserMutationAuthority(dataDir, authorityRef, authorityHash);
      if (browser !== "missing") return browser;
    }
    return "missing";
  },
}) : null;
if (diagnosis) {
  process.stdout.write(`${JSON.stringify(diagnosis, null, 2)}\n`);
  process.exitCode = diagnosis.status === "DIAGNOSIS_COMPLETE" ? 0 : 2;
}
