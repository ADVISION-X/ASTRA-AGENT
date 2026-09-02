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
}>;
