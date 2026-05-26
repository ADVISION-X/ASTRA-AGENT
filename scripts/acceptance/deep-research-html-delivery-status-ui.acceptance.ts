import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const decode = (value: string): string => Buffer.from(value, "base64").toString("utf8");

const deliverySections = readFileSync("src/app/workbench-deep-research-client-delivery-sections.ts", "utf8");

assert(deliverySections.includes("sourceKind"), "HTML delivery status must expose sourceKind.");
assert(deliverySections.includes("fileHash"), "HTML delivery status must expose fileHash.");
assert(deliverySections.includes("fileSizeBytes"), "HTML delivery status must expose fileSizeBytes.");
assert(deliverySections.includes("failureReason") || deliverySections.includes("reviewReason"), "HTML delivery status must expose failureReason or reviewReason.");
for (const forbidden of [
  decode("UFBU"),
  decode("RGVjaw=="),
  decode("T3B0aW9uYWwgUHJlc2VudGF0aW9u"),
  decode("T3BlbiBQUFQ="),
  decode("RG93bmxvYWQgUFBU"),
]) {
  assert(!deliverySections.includes(forbidden), "HTML delivery status must not expose forbidden final-presentation vocabulary.");
}

process.stdout.write("[ACCEPTANCE][deep-research-html-delivery-status-ui] PASS\n");