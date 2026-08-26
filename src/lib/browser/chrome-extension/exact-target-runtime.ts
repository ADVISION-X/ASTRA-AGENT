export type ExtensionExactTarget = Readonly<{
  targetRef: string;
  documentRef: string;
  tabId: number;
  navigationEpoch: number;
}>;

/** The fixed extension emits this only for its preauthorized exact target policy. */
export type ExtensionOperatorTargetClaim = Readonly<{
  targetRef: string;
  documentRef: string;
  navigationEpoch: number;
  url: string;
  title: string;
}>;

export const assertExactTarget = (target: ExtensionExactTarget): void => {
  if (!target.targetRef || !target.documentRef || !Number.isInteger(target.tabId)) throw new Error("BROWSER_TARGET_INVALID");
};

/** The fixed extension policy is the sole source of a tab claim; no page-order fallback exists. */
export class ExtensionExactTargetRegistry {
  private readonly targets = new Map<string, ExtensionExactTarget>();

  public claimOperatorTarget(tabId: number): ExtensionExactTarget {
    if (!Number.isInteger(tabId) || tabId < 0) throw new Error("BROWSER_TARGET_INVALID");
    const target: ExtensionExactTarget = {
      targetRef: `target-${newRef()}`,
      documentRef: `document-${newRef()}`,
      tabId,
      navigationEpoch: 0,
    };
    this.targets.set(target.targetRef, target);
    return target;
  }

  public describeOperatorClaim(
    target: ExtensionExactTarget,
    input: Readonly<{ url?: string; title?: string }>,
  ): ExtensionOperatorTargetClaim {
    assertExactTarget(target);
    if (typeof input.url !== "string" || !isHttpsUrl(input.url)) {
      throw new Error("BROWSER_ORIGIN_REJECTED");
    }
    return {
      targetRef: target.targetRef,
      documentRef: target.documentRef,
      navigationEpoch: target.navigationEpoch,
      url: input.url,
      title: typeof input.title === "string" ? input.title.slice(0, 512) : "",
    };
  }

  public resolve(targetRef: string, documentRef: string): ExtensionExactTarget {
    const target = this.targets.get(targetRef);
    if (!target) throw new Error("BROWSER_TARGET_INVALID");
    if (target.documentRef !== documentRef) throw new Error("BROWSER_DOCUMENT_INVALID");
    return target;
  }

  public advanceDocument(targetRef: string): ExtensionExactTarget {
    const current = this.targets.get(targetRef);
    if (!current) throw new Error("BROWSER_TARGET_INVALID");
    const next = {
      ...current,
      documentRef: `document-${newRef()}`,
      navigationEpoch: current.navigationEpoch + 1,
    };
    this.targets.set(targetRef, next);
    return next;
  }

  public remove(targetRef: string): void {
    this.targets.delete(targetRef);
  }

  public clear(): void {
    this.targets.clear();
  }

  public invalidateTab(tabId: number): void {
    for (const [targetRef, target] of this.targets) if (target.tabId === tabId) this.targets.delete(targetRef);
  }
}

const newRef = (): string => globalThis.crypto.randomUUID();
const isHttpsUrl = (value: string): boolean => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};
