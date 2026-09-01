import nativeAssert from "node:assert/strict";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, lstatSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { inspect } from "node:util";

type AssertionMethod = keyof typeof nativeAssert;
type AssertionTrace = Readonly<{
  schema_version: "governance-exam-assertion.v1";
  proof_run_id: string;
  candidate: string;
  producer_script: string;
  process_id: number;
  sequence: number;
  method: string;
  source_path: string;
  source_line: number;
  source_column: number;
  source_digest: string;
  source_line_digest: string;
  argument_digest: string;
}>;

const tracedMethods = new Set<AssertionMethod>([
  "deepEqual", "deepStrictEqual", "doesNotMatch", "doesNotReject", "doesNotThrow", "equal",
  "ifError", "match", "notDeepEqual", "notDeepStrictEqual", "notEqual", "notStrictEqual", "ok",
  "partialDeepStrictEqual", "rejects", "strictEqual", "throws",
]);
const helperPath = resolve(new URL(import.meta.url).pathname);
let sequence = 0;

const sha = (value: string): string => createHash("sha256").update(value).digest("hex");
const exactExamContext = (): Readonly<{
  proofRunId: string; candidate: string; producerScript: string; receiptRoot: string;
}> | null => {
  if (process.env.GOVERNANCE_PROOF_KIND !== "exam") return null;
  const proofRunId = process.env.GOVERNANCE_PROOF_RUN_ID?.trim() ?? "";
  const candidate = process.env.GOVERNANCE_PROOF_CANDIDATE?.trim() ?? "";
  const producerScript = process.env.GOVERNANCE_PROOF_SCRIPT?.trim() ?? "";
  const receiptRoot = resolve(process.env.GOVERNANCE_PROOF_RECEIPT_DIR?.trim() ?? "");
  if (!/^[a-f0-9]{64}$/u.test(proofRunId) || !/^[a-f0-9]{40}$/u.test(candidate)
    || !producerScript || !receiptRoot || !existsSync(receiptRoot)) return null;
  const stat = lstatSync(receiptRoot);
  return stat.isDirectory() && !stat.isSymbolicLink()
    ? { proofRunId, candidate, producerScript, receiptRoot } : null;
};

const callSite = (): Readonly<{
  sourcePath: string; line: number; column: number; source: string; sourceLine: string;
}> | null => {
  const stack = new Error().stack?.split("\n").slice(2) ?? [];
  for (const frame of stack) {
    const match = /(?:file:\/\/)?(\/[^():]+\.(?:ts|tsx|js|mjs)):(\d+):(\d+)\)?$/u.exec(frame.trim());
    if (!match) continue;
    const sourcePath = resolve(decodeURIComponent(match[1]!));
    if (sourcePath === helperPath || !existsSync(sourcePath)) continue;
    const stat = lstatSync(sourcePath);
    if (!stat.isFile() || stat.isSymbolicLink()) return null;
    const line = Number(match[2]);
    const column = Number(match[3]);
    const source = readFileSync(sourcePath, "utf8");
    const sourceLine = source.split("\n")[line - 1] ?? "";
    return sourceLine.trim() ? { sourcePath, line, column, source, sourceLine } : null;
  }
  return null;
};

const recordAssertion = (method: string, args: readonly unknown[]): void => {
  const context = exactExamContext();
  if (!context) return;
  const site = callSite();
  if (!site) throw new Error("GOVERNANCE_EXAM_ASSERTION_SITE_INVALID");
  const trace: AssertionTrace = {
    schema_version: "governance-exam-assertion.v1",
    proof_run_id: context.proofRunId,
    candidate: context.candidate,
    producer_script: context.producerScript,
    process_id: process.pid,
    sequence: sequence += 1,
    method,
    source_path: site.sourcePath,
    source_line: site.line,
    source_column: site.column,
    source_digest: sha(site.source),
    source_line_digest: sha(site.sourceLine),
    argument_digest: sha(inspect(args, { depth: 6, maxArrayLength: 100, sorted: true })),
  };
  appendFileSync(resolve(context.receiptRoot, `exam-assertions-${process.pid}.jsonl`), `${JSON.stringify(trace)}\n`, {
    encoding: "utf8", mode: 0o600,
  });
};

const wrappedMethods = new Map<PropertyKey, unknown>();
const governanceAssert: typeof nativeAssert = new Proxy(nativeAssert, {
  apply(target, thisArg, args: unknown[]) {
    Reflect.apply(target, thisArg, args);
    recordAssertion("ok", args);
  },
  get(target, property, receiver) {
    const value = Reflect.get(target, property, receiver) as unknown;
    if (!tracedMethods.has(property as AssertionMethod) || typeof value !== "function") return value;
    if (wrappedMethods.has(property)) return wrappedMethods.get(property);
    const wrapped = (...args: unknown[]): unknown => {
      const result = Reflect.apply(value, target, args) as unknown;
      if (result && typeof result === "object" && "then" in result) {
        return Promise.resolve(result).then((resolved) => {
          recordAssertion(String(property), args);
          return resolved;
        });
      }
      recordAssertion(String(property), args);
      return result;
    };
    wrappedMethods.set(property, wrapped);
    return wrapped;
  },
}) as typeof nativeAssert;

export default governanceAssert;
