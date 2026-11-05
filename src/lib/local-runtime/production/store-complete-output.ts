import { randomUUID } from "node:crypto";
import { closeSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync,
  readdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { ProductPluginOutput } from "../../../mediator/product-plugin-contract.js";
import { executionFailure, typedExecutionFailure } from "../../execution-failure.js";
import { hashCanonical, sha256, type WebsiteAgentTask } from "./contracts.js";
import { UploadedResultReceiptSchema, type UploadedResultReceipt } from "./transport-protocol.js";
import { productionRuntimeTaskPath } from "./runtime-storage-inventory.js";

const hash = z.string().regex(/^sha256:[a-f0-9]{64}$/u)
  .transform((value): `sha256:${string}` => value as `sha256:${string}`);
const completeOutputSchema = z.object({
  job_id: z.string().min(1), attempt_id: z.string().min(1), request_hash: hash,
  product_id: z.string().min(1), action_id: z.string().min(1),
  payload_json: z.string(), evidence_refs: z.array(z.string()),
  artifact_receipts: z.array(UploadedResultReceiptSchema), execution_receipt_hash: hash,
}).strict();
export type CompleteProductionOutput = Readonly<z.infer<typeof completeOutputSchema>>;

const receiptHash = (value: Omit<CompleteProductionOutput, "execution_receipt_hash">) => hashCanonical({
  job_id: value.job_id, attempt_id: value.attempt_id, request_hash: value.request_hash,
  product_id: value.product_id, action_id: value.action_id,
  payload_hash: sha256(Buffer.from(value.payload_json, "utf8")), evidence_refs: value.evidence_refs,
});

export const createCompleteOutput = (task: WebsiteAgentTask, attemptId: string,
  output: ProductPluginOutput, receipts: readonly UploadedResultReceipt[]): CompleteProductionOutput => {
  const body = { job_id: task.job_id, attempt_id: attemptId, request_hash: task.request_hash,
    product_id: task.product_id, action_id: task.action_id,
    payload_json: JSON.stringify(output.payload), evidence_refs: [...output.evidence_refs],
    artifact_receipts: [...receipts] };
  return completeOutputSchema.parse({ ...body, execution_receipt_hash: receiptHash(body) });
};

const missing = (error: unknown): boolean => error !== null && typeof error === "object"
  && "code" in error && error.code === "ENOENT";
const fail = (code: string): never => { throw executionFailure("failed", code); };

/** Walk the existing task-owned path without following symlinks; reads never create directories. */
const outputDirectory = (dataDir: string, jobId: string, attemptId: string, create: boolean): string | null => {
  const directory = path.join(productionRuntimeTaskPath(dataDir, jobId), "results",
    hashCanonical({ attempt_id: attemptId }).slice(7, 23));
  let current = path.resolve(dataDir);
  const base = lstatSync(current);
  if (base.isSymbolicLink() || !base.isDirectory()) return fail("PRODUCTION_COMPLETE_OUTPUT_PATH_INVALID");
  for (const part of path.relative(current, directory).split(path.sep)) {
    current = path.join(current, part);
    try {
      const stat = lstatSync(current);
      if (stat.isSymbolicLink() || !stat.isDirectory()) return fail("PRODUCTION_COMPLETE_OUTPUT_PATH_INVALID");
    } catch (error) {
      if (!missing(error)) throw error;
      if (!create) return null;
      mkdirSync(current, { mode: 0o700 });
      const parent = openSync(path.dirname(current), "r");
      try { fsyncSync(parent); } finally { closeSync(parent); }
    }
  }
  return directory;
};

const validateOutput = (bytes: Buffer, task: WebsiteAgentTask, attemptId: string): CompleteProductionOutput => {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const output = completeOutputSchema.parse(JSON.parse(text));
  JSON.parse(output.payload_json);
  if (output.job_id !== task.job_id || output.attempt_id !== attemptId
    || output.request_hash !== task.request_hash || output.product_id !== task.product_id
    || output.action_id !== task.action_id || receiptHash(output) !== output.execution_receipt_hash) {
    return fail("PRODUCTION_COMPLETE_OUTPUT_IDENTITY_MISMATCH");
  }
  return output;
};

export const readCompleteOutputFile = (dataDir: string, task: WebsiteAgentTask,
  attemptId: string): CompleteProductionOutput | null => {
  try {
    const directory = outputDirectory(dataDir, task.job_id, attemptId, false);
    if (directory === null) return null;
    const file = path.join(directory, "complete-output.json");
    let stat;
    try { stat = lstatSync(file); }
    catch (error) {
      if (!missing(error)) throw error;
      if (readdirSync(directory).length) return fail("PRODUCTION_COMPLETE_OUTPUT_INCOMPLETE");
      return null;
    }
    if (stat.isSymbolicLink() || !stat.isFile() || stat.nlink !== 1 || (stat.mode & 0o077) !== 0) {
      return fail("PRODUCTION_COMPLETE_OUTPUT_PATH_INVALID");
    }
    return validateOutput(readFileSync(file), task, attemptId);
  } catch (cause) {
    if (typedExecutionFailure(cause)) throw cause;
    throw executionFailure("failed", "PRODUCTION_COMPLETE_OUTPUT_UNREADABLE", { cause });
  }
};

/** Called only while the original Store holds its immediate SQLite writer transaction. */
export const writeCompleteOutputFile = (dataDir: string, task: WebsiteAgentTask,
  output: CompleteProductionOutput): CompleteProductionOutput => {
  const prior = readCompleteOutputFile(dataDir, task, output.attempt_id);
  if (prior) {
    if (JSON.stringify(prior) !== JSON.stringify(output)) return fail("PRODUCTION_COMPLETE_OUTPUT_CONFLICT");
    return prior;
  }
  try {
    const directory = outputDirectory(dataDir, task.job_id, output.attempt_id, true)!;
    const temporary = path.join(directory, `.complete-output-${randomUUID()}.tmp`);
    const descriptor = openSync(temporary, "wx", 0o600);
    try { writeFileSync(descriptor, JSON.stringify(output), "utf8"); fsyncSync(descriptor); }
    finally { closeSync(descriptor); }
    renameSync(temporary, path.join(directory, "complete-output.json"));
    const parent = openSync(directory, "r");
    try { fsyncSync(parent); } finally { closeSync(parent); }
    return readCompleteOutputFile(dataDir, task, output.attempt_id)!;
  } catch (cause) {
    if (typedExecutionFailure(cause)) throw cause;
    throw executionFailure("failed", "PRODUCTION_COMPLETE_OUTPUT_WRITE_FAILED", { cause });
  }
};
