import { readFileSync } from "node:fs";
import process from "node:process";
import {
  ContractError,
  parseJson,
  validateReceipt,
  validateRequest,
  validateStatus,
} from "./handoff-contract-core.mjs";

const readRequestContext = (path) => {
  if (typeof path !== "string" || path.trim() === "") {
    throw new ContractError(
      "status and receipt validation require the original request JSON path",
    );
  }
  try {
    return validateRequest(parseJson(readFileSync(path, "utf8"), "request context"));
  } catch (error) {
    if (error instanceof ContractError) throw error;
    throw new ContractError(
      `cannot read request context: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

try {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const record = parseJson(chunks.join(""), "payload");
  const kind = process.argv[2];
  if (kind === "request") validateRequest(record);
  else if (kind === "status") {
    validateStatus(record, readRequestContext(process.argv[3]));
  } else if (kind === "receipt") {
    validateReceipt(record, readRequestContext(process.argv[3]));
  } else {
    throw new ContractError(
      "usage: node validate-handoff.mjs request | status <request.json> | receipt <request.json>",
    );
  }
  process.stdout.write(JSON.stringify({
    status: "PASS",
    kind,
    request_id: record.request_id,
  }) + "\n");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`HANDOFF_CONTRACT_FAIL: ${message}\n`);
  process.exit(1);
}
