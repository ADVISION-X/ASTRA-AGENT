import { requireGptWebClaimOrigin } from "../exact-target/browser-site-policy-registry.js";

export type ExtensionExactTarget = Readonly<{
  targetRef: string;
  documentRef: string;
  tabId: number;
  chromeTargetId: string;
  navigationEpoch: number;
  jobRefHash: `sha256:${string}`;
  loaderId: string;
}>;

/** The fixed extension emits this only for its preauthorized exact target policy. */
export type ExtensionOperatorTargetClaim = Readonly<{
  targetRef: string;
  documentRef: string;
  navigationEpoch: number;
  claimOrigin: "https://chatgpt.com";
  jobRefHash: `sha256:${string}`;
}>;

export const assertExactTarget = (target: ExtensionExactTarget): void => {
  if (!target.targetRef || !target.documentRef || !Number.isInteger(target.tabId)
    || !/^sha256:[a-f0-9]{64}$/u.test(target.jobRefHash) || !target.loaderId
    || !target.chromeTargetId) {
    throw new Error("BROWSER_TARGET_INVALID");
  }
};

/** The fixed extension policy is the sole source of a tab claim; no page-order fallback exists. */
export class ExtensionExactTargetRegistry {
  private readonly targets = new Map<string, ExtensionExactTarget>();

  public claimOperatorTarget(tabId: number, jobRefHash: `sha256:${string}`,
    loaderId: string, chromeTargetId: string): ExtensionExactTarget {
    if (!Number.isInteger(tabId) || tabId < 0 || !/^sha256:[a-f0-9]{64}$/u.test(jobRefHash)
      || !loaderId || !chromeTargetId || this.findByJobRefHash(jobRefHash)) throw new Error("BROWSER_TARGET_INVALID");
    const target: ExtensionExactTarget = {
      targetRef: `target-tab-${tabId}`,
      documentRef: `document-${newRef()}`,
      tabId,
      chromeTargetId,
      navigationEpoch: 0,
      jobRefHash,
      loaderId,
    };
    this.targets.set(target.targetRef, target);
    return target;
  }

  public describeOperatorClaim(
    target: ExtensionExactTarget,
    input: Readonly<{ claimOrigin?: string }>,
  ): ExtensionOperatorTargetClaim {
    assertExactTarget(target);
    if (typeof input.claimOrigin !== "string") {
      throw new Error("BROWSER_ORIGIN_REJECTED");
    }
    return {
      targetRef: target.targetRef,
      documentRef: target.documentRef,
      navigationEpoch: target.navigationEpoch,
      claimOrigin: requireGptWebClaimOrigin(input.claimOrigin),
      jobRefHash: target.jobRefHash,
    };
  }

  public resolve(targetRef: string, documentRef: string): ExtensionExactTarget {
    const target = this.targets.get(targetRef);
    if (!target) throw new Error("BROWSER_TARGET_INVALID");
    if (target.documentRef !== documentRef) throw new Error("BROWSER_DOCUMENT_INVALID");
    return target;
  }

  public read(targetRef: string): ExtensionExactTarget {
    const target = this.targets.get(targetRef);
    if (!target) throw new Error("BROWSER_TARGET_INVALID");
    return target;
  }

  public advanceDocument(targetRef: string, loaderId: string): ExtensionExactTarget {
    const current = this.targets.get(targetRef);
    if (!current) throw new Error("BROWSER_TARGET_INVALID");
    const next = {
      ...current,
      documentRef: `document-${newRef()}`,
      navigationEpoch: current.navigationEpoch + 1,
      loaderId,
    };
    this.targets.set(targetRef, next);
    return next;
  }

  public remove(targetRef: string): void {
    this.targets.delete(targetRef);
  }

  public restore(target: ExtensionExactTarget): void {
    assertExactTarget(target);
    if (this.targets.has(target.targetRef)
      || this.findByJobRefHash(target.jobRefHash)
      || this.findByTabId(target.tabId)) {
      throw new Error("BROWSER_TARGET_INVALID");
    }
    this.targets.set(target.targetRef, target);
  }

  public clear(): void {
    this.targets.clear();
  }

  public invalidateTab(tabId: number): void {
    for (const [targetRef, target] of this.targets) if (target.tabId === tabId) this.targets.delete(targetRef);
  }

  public findByJobRefHash(jobRefHash: string): ExtensionExactTarget | null {
    const matches = [...this.targets.values()].filter((target) => target.jobRefHash === jobRefHash);
    if (matches.length > 1) throw new Error("BROWSER_TARGET_INVALID");
    return matches[0] ?? null;
  }

  public findByTabId(tabId: number): ExtensionExactTarget | null {
    const matches = [...this.targets.values()].filter((target) => target.tabId === tabId);
    if (matches.length > 1) throw new Error("BROWSER_TARGET_INVALID");
    return matches[0] ?? null;
  }
}

const newRef = (): string => globalThis.crypto.randomUUID();
