export type BrowserHash = `sha256:${string}`;

export type BrowserTargetRef = Readonly<{
  targetRef: string;
  authorityEpoch: number;
  executionBindingHash: BrowserHash;
}>;

export type BrowserDocumentRef = Readonly<{
  documentRef: string;
  targetRef: string;
  navigationEpoch: number;
}>;

export type BrowserControlledTarget = Readonly<{
  target: BrowserTargetRef;
  document: BrowserDocumentRef;
  url: string;
  title: string;
}>;

export const assertCurrentDocument = (
  target: BrowserControlledTarget,
  candidate: BrowserDocumentRef,
): void => {
  if (target.document.documentRef !== candidate.documentRef || target.document.targetRef !== candidate.targetRef) {
    throw new Error("BROWSER_DOCUMENT_INVALID");
  }
};
