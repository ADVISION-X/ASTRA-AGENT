import assert from "node:assert/strict";

import { PhysicalFocusLease } from "../../src/lib/browser/exact-target/physical-focus-lease.js";

const lease = new PhysicalFocusLease();
let release!: () => void;
const holding = lease.run({
  reason: "native_file_picker",
  targetRef: "bt_fixture" as never,
  documentRef: "bd_fixture" as never,
  focus: async () => undefined,
  action: () => new Promise<string>((resolve) => { release = () => resolve("done"); }),
});
await new Promise((resolve) => setTimeout(resolve, 5));
await assert.rejects(
  lease.run({ reason: "os_keyboard_action", targetRef: "bt_other" as never, documentRef: "bd_other" as never, focus: async () => undefined, action: async () => "never" }),
  /FOCUS_LEASE_DENIED/u,
);
release();
assert.equal((await holding).value, "done");
let abortedActionSettled = false;
await assert.rejects(
  lease.run({
    reason: "native_file_picker",
    targetRef: "bt_timeout" as never,
    documentRef: "bd_timeout" as never,
    timeoutMs: 5,
    focus: async () => undefined,
    action: (abortSignal) => new Promise<string>((_resolve, reject) => {
      abortSignal.addEventListener("abort", () => {
        abortedActionSettled = true;
        reject(abortSignal.reason);
      }, { once: true });
    }),
  }),
  /OPERATOR_INTERRUPTED|exceeded/u,
);
assert.equal(abortedActionSettled, true, "focus timeout must abort and await the physical action");
let interruptedActionRan = false;
await assert.rejects(
  lease.run({
    reason: "os_keyboard_action",
    targetRef: "bt_operator_interrupt" as never,
    documentRef: "bd_operator_interrupt" as never,
    focus: async () => undefined,
    verifyFocus: async () => false,
    action: async () => { interruptedActionRan = true; return "never"; },
  }),
  /OPERATOR_INTERRUPTED|changed focus/u,
);
assert.equal(interruptedActionRan, false, "operator focus change must stop the OS action without reacquiring focus");
process.stdout.write("[local-browser-focus-lease] PASS\n");
