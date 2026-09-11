import type { BrowserTargetLease } from "../exact-target/browser-target-lease.js";

export type AuthenticatedMediaValue = Awaited<ReturnType<BrowserTargetLease["readAuthenticatedMedia"]>>;
