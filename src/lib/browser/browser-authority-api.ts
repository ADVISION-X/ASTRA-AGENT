export type { BrowserTargetLease } from "./exact-target/browser-target-lease.js";
export type { BrowserDomIntent, BrowserDomField, BrowserDomReadScope, BrowserSemanticLocator } from "./exact-target/browser-dom-intent.js";
export type { BrowserFileArtifactGrantV1 } from "./exact-target/browser-file-artifact-grant.js";
export type { BrowserExecutionBinding, BrowserAuthorityStatus, AuthenticatedBrowserAuthorityLease } from "./infrastructure/browser-authority-broker.js";
export { BrowserAuthorityBroker } from "./infrastructure/browser-authority-broker.js";

export type BrowserDomElementIdentity = Readonly<{
  tagName?: string;
  type?: string;
  role?: string;
  ariaLabel?: string;
  labelText?: string;
  placeholder?: string;
  name?: string;
  id?: string;
  visibleText?: string;
  testId?: string;
}>;
