import assert from "node:assert/strict";

import { parseArguments, readExecutionManifest, readJson, resolveDeliverable } from "./local-browser-plan-harness.self-test.js";

type WorkOrderReceipt = Readonly<{
  readonly workOrderId: string;
  readonly candidate: string;
  readonly status: "PASS" | "FAIL" | "BLOCKED";
}>;

const args = parseArguments(process.argv.slice(2));
const requiredArgument = (name: string): string => {
  const value = args.get(name);
  if (typeof value !== "string") throw new Error(`${name} is required.`);
  return value;
};
const workOrderId = requiredArgument("--work-order");
const receiptUri = requiredArgument("--receipt");

const manifest = readExecutionManifest();
assert.ok(manifest.work_orders.some((workOrder) => workOrder.work_order_id === workOrderId), `Unknown work order: ${workOrderId}`);
const receipt = readJson<WorkOrderReceipt>(receiptUri);
assert.equal(receipt.workOrderId, workOrderId, "Receipt must name the consuming work order.");
assert.equal(typeof receipt.candidate, "string", "Receipt candidate is required.");
assert.ok(["PASS", "FAIL", "BLOCKED"].includes(receipt.status), "Receipt status is invalid.");

process.stdout.write(`${JSON.stringify({
  status: "PASS",
  workOrderId,
  receiptPath: resolveDeliverable(receiptUri),
  receiptStatus: receipt.status,
})}\n`);
