declare const browserTargetRefBrand: unique symbol;
declare const browserDocumentRefBrand: unique symbol;

export type BrowserTargetRef = string & {
  readonly [browserTargetRefBrand]: "BrowserTargetRef";
};

export type BrowserDocumentRef = string & {
  readonly [browserDocumentRefBrand]: "BrowserDocumentRef";
};
