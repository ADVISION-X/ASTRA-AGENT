import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";

import type { ExtensionTargetAuthority } from
  "../../src/lib/browser/chrome-extension/extension-target-authority.js";
import type { ExtensionChromeApi } from
  "../../src/lib/browser/chrome-extension/extension-runtime-types.js";
import { BrowserAuthorityBroker } from
  "../../src/lib/browser/infrastructure/browser-authority-broker.js";
import { BrowserAuthorityIssuer } from
  "../../src/lib/browser/infrastructure/browser-authority-issuer.js";

type TargetFrame = Readonly<{
  kind: "TARGET_CLAIM" | "TARGET_REVOKE";
  body: Record<string, unknown>;
}>;
type TabUpdatedListener = Parameters<ExtensionChromeApi["tabs"]["onUpdated"]["addListener"]>[0];

const closeRotatedTargets = async (input: Readonly<{
  authority: ExtensionTargetAuthority;
  hashes: readonly `sha256:${string}`[];
  targetRefs: readonly string[];
  targetFrames: TargetFrame[];
  removedTabs: number[];
  setRemoveFailureTabId(value: number | null): void;
}>): Promise<void> => {
  input.setRemoveFailureTabId(7);
  await assert.rejects(input.authority.releaseJobBoundChatGptTarget(input.hashes[0]!),
    /BROWSER_TARGET_CLEANUP_FAILED/u,
    "an unproven tab removal must retain the exact binding for a governed retry");
  await input.authority.acquireJobBoundChatGptTarget("bound-observation", input.hashes[0]!);
  assert.equal(input.targetFrames.at(-1)?.body.targetRef, input.targetRefs[0]);
  await input.authority.parkActiveTarget();
  await input.authority.releaseJobBoundChatGptTarget(input.hashes[0]!);
  assert.equal(input.removedTabs.at(-1), 7, "business closure must remove only the exact job-owned Tab");
  await input.authority.acquireJobBoundChatGptTarget("bound-observation", input.hashes[1]!);
  assert.equal(input.targetFrames.at(-1)?.body.targetRef, input.targetRefs[1],
    "closing job A must preserve job B's exact bound Tab");
  await input.authority.parkActiveTarget();
  await input.authority.releaseJobBoundChatGptTarget(input.hashes[1]!);
  await input.authority.releaseJobBoundChatGptTarget(input.hashes[2]!);
};

export const exerciseTargetRotation = async (input: Readonly<{
  authority: ExtensionTargetAuthority;
  waitForCreatedTab(tabId: number): Promise<void>;
  targetTabUpdated: TabUpdatedListener;
  targetFrames: TargetFrame[];
  debuggerMethods: string[];
  activatedTabs: number[];
  removedTabs: number[];
  setRemoveFailureTabId(value: number | null): void;
}>): Promise<readonly `sha256:${string}`[]> => {
  const hashes = ["b", "c", "d"].map(
    (value) => `sha256:${value.repeat(64)}` as `sha256:${string}`,
  );
  const targetRefs: string[] = [];
  for (const [index, hash] of hashes.entries()) {
    const acquisition = input.authority.acquireJobBoundChatGptTarget("fresh", hash);
    const tabId = 7 + index;
    await input.waitForCreatedTab(tabId);
    input.targetTabUpdated(tabId, { status: "complete" }, {
      id: tabId, url: "https://chatgpt.com/", title: "ChatGPT",
    });
    await acquisition;
    targetRefs.push(String(input.targetFrames.at(-1)?.body.targetRef));
    await input.authority.parkActiveTarget();
  }
  const navigationBaseline = input.debuggerMethods.filter((method) => method === "Page.navigate").length;
  for (const index of [0, 1, 2, 0]) {
    await input.authority.acquireJobBoundChatGptTarget("bound-observation", hashes[index]!);
    assert.equal(input.targetFrames.at(-1)?.body.targetRef, targetRefs[index]);
    await input.authority.parkActiveTarget();
  }
  assert.deepEqual(input.activatedTabs.slice(-4), [7, 8, 9, 7],
    "three job-owned Tabs must rotate A/B/C/A through exact Chrome activation");
  assert.equal(input.debuggerMethods.filter((method) => method === "Page.navigate").length,
    navigationBaseline, "normal bound observation must switch Tabs with zero navigation");
  await closeRotatedTargets({
    authority: input.authority, hashes, targetRefs, targetFrames: input.targetFrames,
    removedTabs: input.removedTabs, setRemoveFailureTabId: input.setRemoveFailureTabId,
  });
  return hashes;
};

export const exerciseAuthorizedContinuation = async (input: Readonly<{
  authority: ExtensionTargetAuthority;
  nextCreatedTabId: number;
  waitForCreatedTab(tabId: number): Promise<void>;
  targetTabUpdated: TabUpdatedListener;
  targetFrames: TargetFrame[];
  debuggerMethods: string[];
  mainFrameUrlByTab: Map<number, string>;
}>): Promise<void> => {
  const hash = `sha256:${"e".repeat(64)}` as const;
  const url = "https://chatgpt.com/c/article-a";
  const navigationBaseline = input.debuggerMethods.filter((method) => method === "Page.navigate").length;
  const frameBaseline = input.targetFrames.length;
  const acquisition = input.authority.acquireJobBoundChatGptTarget(
    "authorized-continuation", hash, url,
  );
  await input.waitForCreatedTab(input.nextCreatedTabId);
  input.targetTabUpdated(input.nextCreatedTabId, { status: "complete" }, {
    id: input.nextCreatedTabId, url: "https://chatgpt.com/", title: "ChatGPT",
  });
  await acquisition;
  assert.equal(input.mainFrameUrlByTab.get(input.nextCreatedTabId), url,
    "authorized continuation must navigate the new current-job Target to the exact parent WAL URL");
  assert.equal(input.debuggerMethods.filter((method) => method === "Page.navigate").length,
    navigationBaseline + 1,
    "authorized continuation must navigate exactly once before publishing its Target claim");
  assert.equal(input.targetFrames.length, frameBaseline + 1);
  assert.equal(input.targetFrames.at(-1)?.kind, "TARGET_CLAIM");
  assert.deepEqual(Object.keys(input.targetFrames.at(-1)?.body ?? {}).sort(),
    ["claimOrigin", "documentRef", "jobRefHash", "navigationEpoch", "targetRef"],
    "the parent conversation URL must remain absent from Target claim transport");
  await input.authority.parkActiveTarget();
  const parkedBaseline = input.debuggerMethods.filter((method) => method === "Page.navigate").length;
  await input.authority.acquireJobBoundChatGptTarget("authorized-continuation", hash, url);
  assert.equal(input.debuggerMethods.filter((method) => method === "Page.navigate").length,
    parkedBaseline, "a parked current-job Target must be revalidated without re-navigation");
  await input.authority.parkActiveTarget();
  input.mainFrameUrlByTab.set(input.nextCreatedTabId, "https://chatgpt.com/c/article-b");
  await assert.rejects(input.authority.acquireJobBoundChatGptTarget("authorized-continuation", hash, url),
    /BROWSER_POSTCONDITION_FAILED/u,
    "a parked Target from article B must fail before article A can claim it");
  assert.equal(input.debuggerMethods.filter((method) => method === "Page.navigate").length,
    parkedBaseline, "mismatched parked continuation must fail without navigation");
  await input.authority.releaseJobBoundChatGptTarget(hash);
};

export const exerciseClaimBroker = async (input: Readonly<{
  hashes: readonly `sha256:${string}`[];
  activatedTabs: number[];
  removedTabs: number[];
}>): Promise<void> => {
  const issuer = new BrowserAuthorityIssuer();
  Reflect.set(issuer, "slot", {
    kind: "PRESENT", authority: { authorityEpoch: 7, authorityRef: "authority-7" },
  });
  const broker = new BrowserAuthorityBroker(issuer, () => undefined,
    () => { throw new Error("target lease factory is outside this claim-only acceptance"); });
  const initialClaim = {
    authorityEpoch: 7, targetRef: "target-1", documentRef: "document-1", navigationEpoch: 0,
    claimOrigin: "https://chatgpt.com", jobRefHash: input.hashes[0]!,
  } as const;
  broker.registerOperatorTargetClaim(initialClaim);
  broker.registerOperatorTargetClaim({ ...initialClaim, documentRef: "document-2", navigationEpoch: 1 });
  assert.throws(() => broker.registerOperatorTargetClaim({ ...initialClaim, targetRef: "target-2" }),
    /BROWSER_TARGET_INVALID/u, "an authenticated connection must not replace its claimed target without revoke");
  assert.throws(() => broker.registerOperatorTargetClaim({
    ...initialClaim, documentRef: "document-4", navigationEpoch: 3,
  }), /BROWSER_TARGET_INVALID/u, "Document claims must advance by exactly one navigation epoch");
  assert.throws(() => broker.registerOperatorTargetClaim({
    ...initialClaim, documentRef: "document-3", navigationEpoch: 2, jobRefHash: input.hashes[1]!,
  }), /BROWSER_TARGET_INVALID/u, "a live claim may never change its exact job identity");
  await assert.rejects(broker.acquireOperatorClaimedTargetLease({
    jobRefHash: input.hashes[1]!,
  } as never, "wrong-job"), /BROWSER_TARGET_INVALID/u,
  "an old claimed Tab must never be wrapped as a lease for a different job");
  assert.equal(new Set<number>(input.activatedTabs).has(99), false,
    "the interaction gate must never activate an operator Tab");
  assert.equal(new Set<number>(input.removedTabs).has(99), false,
    "the production owner must never remove an operator Tab");
};
