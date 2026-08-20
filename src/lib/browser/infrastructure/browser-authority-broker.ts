import { createHash } from "node:crypto";
import type {
  AuthenticatedBrowserAuthorityLease,
  BrowserAuthorityBroker,
  BrowserAuthorityStatus,
  BrowserExecutionBinding,
} from "../browser-authority-api.js";
import type { TransportActor } from "../transport/transport-actor.js";
import { AuthenticatedBrowserAuthorityLeaseImpl } from "./authenticated-browser-authority-lease.js";
const hash = (v: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(v).digest("hex")}`;
export type BrowserExecutionFenceValidator = {
  assertCurrent(binding: BrowserExecutionBinding): void;
};
export class BrowserAuthorityBrokerImpl implements BrowserAuthorityBroker {
  private readonly leases = new Set<AuthenticatedBrowserAuthorityLeaseImpl>();
  constructor(
    private readonly input: {
      dataDir: string;
      transport: TransportActor;
      approvedArtifactRoots: readonly string[];
      fenceValidator: BrowserExecutionFenceValidator;
    },
  ) {}
  currentStatus(): BrowserAuthorityStatus {
    const slot = this.input.transport.authoritySlot();
    return slot.kind === "PRESENT"
      ? {
          kind: "AVAILABLE",
          authorityRefHash: hash(slot.authority.certificate.authorityRef),
          certificateHash: slot.authority.certificate.certificateHash,
          activationTupleHash: slot.authority.certificate.activationTupleHash,
        }
      : { kind: "UNAVAILABLE", reasonCode: slot.reasonCode };
  }
  async acquireForExecution(
    binding: BrowserExecutionBinding,
  ): Promise<AuthenticatedBrowserAuthorityLease> {
    this.input.fenceValidator.assertCurrent(binding);
    const slot = this.input.transport.authoritySlot();
    if (slot.kind !== "PRESENT")
      throw new Error(`BROWSER_INFRASTRUCTURE_UNAVAILABLE:${slot.reasonCode}`);
    const lease = new AuthenticatedBrowserAuthorityLeaseImpl(
      slot.authority,
      binding,
      {
        dataDir: this.input.dataDir,
        transport: this.input.transport,
        approvedArtifactRoots: this.input.approvedArtifactRoots,
        assertFenceCurrent: (candidate) =>
          this.input.fenceValidator.assertCurrent(candidate),
      },
    );
    this.leases.add(lease);
    return lease;
  }
  invalidateAll(): void {
    for (const lease of this.leases) lease.invalidate();
    this.leases.clear();
  }
}
