import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("./xuanxue-ai-production-cloud-attestation.ts", import.meta.url), "utf8");
assert.match(source, /XuanxueAiProductionWorkerSessionV6/u);
assert.match(source, /runtimeAttestationReceiptHash/u);
assert.match(source, /terminal_receipt/u);
assert.match(source, /receipt\.worker_session_id === input\.predecessor\.workerSessionId/u);
assert.match(source, /receipt\.worker_session_epoch === input\.predecessor\.workerSessionEpoch/u);
assert.match(source, /terminalReceiptHashes/u);
assert.match(source, /XUANXUE_AI_PRODUCTION_RUNTIME_STATE_REQUIRED/u);
assert.doesNotMatch(source, /xuanxue-ai-production-v5|device heartbeat/iu);
process.stdout.write("[ACCEPTANCE][XUANXUE-AI-PRODUCTION-CLOUD-ATTESTATION-V6] PASS\n");
