import { emitQualityProofObservation } from "../../../../scripts/audit/shared/proof-observation.js";

await import("./gpt-production-browser-wait.acceptance-support.js");
await import("./gpt-production-browser-mismatch.acceptance-support.js");
await import("./gpt-production-artifact-recovery.acceptance-support.js");
await import("./gpt-settled-conversation-rename.acceptance.js");

emitQualityProofObservation({
  lawId: "LAW-GPT-002-V12", evidenceMode: "exam.property",
  clauses: ["forbidden:1", "forbidden:2", "forbidden:4", "forbidden:6"],
  locator: "acceptance:gpt:frozen-submit-properties",
  observedValue: "attachment identity preconditions and provider-effect safety mutants fail closed",
});
emitQualityProofObservation({
  lawId: "LAW-GPT-002-V12", evidenceMode: "exam.state-machine",
  clauses: ["forbidden:0", "forbidden:3", "forbidden:5", "summary"],
  locator: "acceptance:gpt:confirmed-readback-state-machine",
  observedValue: "pending holds one lease and confirmed recovery performs zero submit before settlement",
});
