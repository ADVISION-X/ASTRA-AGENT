import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

type WorkdayReceipt = {
  candidateId: string;
  baselineTaskIds: string[];
  candidateTaskIds: string[];
  baseline: { focusSteals: number; focusSeconds: number; keyboardInterruptions: number; wrongTargetActions: number };
  candidate: { focusSteals: number; ordinaryFocusSeconds: number; approvedLeaseSeconds: number; keyboardInterruptions: number; wrongTargetActions: number };
  interventions: Array<{ pluginId: string; action: "pause" | "cancel" | "takeover"; requestedAt: string; ackAt: string; withinBudget: boolean; replayedMutation: boolean }>;
};

const receiptPath = process.argv[process.argv.indexOf("--receipt") + 1];
if (!receiptPath) {
  process.stderr.write(`${JSON.stringify({ status: "BUSINESS_OBJECTIVE_NOT_PROVEN", reason: "--receipt is required; a static test cannot manufacture a one-workday baseline" })}\n`);
  process.exit(2);
}
const receipt = JSON.parse(await readFile(receiptPath, "utf8")) as WorkdayReceipt;
assert.ok(receipt.candidateId.trim());
assert.ok(receipt.baselineTaskIds.length > 0 && receipt.candidateTaskIds.length > 0);
assert.equal(receipt.candidate.focusSteals, 0, "ordinary actions must steal focus zero times");
assert.equal(receipt.candidate.ordinaryFocusSeconds, 0, "ordinary actions must occupy focus for zero seconds");
assert.equal(receipt.candidate.keyboardInterruptions, 0, "operator keyboard interruptions must be zero");
assert.equal(receipt.candidate.wrongTargetActions, 0, "wrong-target actions must be zero");
const plugins = new Map<string, Set<string>>();
for (const item of receipt.interventions) {
  assert.equal(item.withinBudget, true, `${item.pluginId}:${item.action} exceeded its response budget`);
  assert.equal(item.replayedMutation, false, `${item.pluginId}:${item.action} replayed a mutation`);
  const actions = plugins.get(item.pluginId) ?? new Set<string>();
  actions.add(item.action);
  plugins.set(item.pluginId, actions);
}
assert.equal(plugins.size, 11, "all eleven browser-owning plugins require workday intervention evidence");
for (const [pluginId, actions] of plugins) assert.deepEqual([...actions].sort(), ["cancel", "pause", "takeover"], `${pluginId} lacks an intervention action`);
process.stdout.write(`${JSON.stringify({
  status: "BUSINESS_OBJECTIVE_PROVEN",
  candidateId: receipt.candidateId,
  baselineFocusSeconds: receipt.baseline.focusSeconds,
  approvedLeaseSeconds: receipt.candidate.approvedLeaseSeconds,
  pluginCount: plugins.size,
})}\n`);
