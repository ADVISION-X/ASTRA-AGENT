import { randomUUID } from "node:crypto";
import type {
  BrowserExecutionBinding,
  BrowserTargetLease,
} from "../browser-authority-api.js";
import type { AuthenticatedBrowserAuthority } from "../infrastructure/browser-authority-certificate.js";
import type { BrowserCommandActor } from "./browser-command-actor.js";
import { BrowserTargetRegistry } from "./browser-target-registry.js";
import type { BrowserFileArtifactGrantManager } from "./browser-file-artifact-grant.js";
import {
  browserTargetLeaseFacade,
  ExactBrowserTargetLease,
} from "./browser-target-lease.js";
export class BrowserTargetLeaseManager {
  readonly registry: BrowserTargetRegistry;
  private readonly leases = new Map<string, ExactBrowserTargetLease>();
  private valid = true;
  constructor(
    readonly authority: AuthenticatedBrowserAuthority,
    readonly executionBinding: BrowserExecutionBinding,
    readonly commands: BrowserCommandActor,
    readonly fileGrants: BrowserFileArtifactGrantManager,
  ) {
    this.registry = new BrowserTargetRegistry(
      authority.certificate.authorityRef,
    );
  }
  acquire(ownerId: string): BrowserTargetLease {
    this.assertValid();
    if (!ownerId.trim()) throw new Error("BROWSER_TARGET_LEASE_OWNER_REQUIRED");
    const existing = this.leases.get(ownerId);
    if (existing) {
      existing.assertValid();
      return browserTargetLeaseFacade(existing);
    }
    const lease = new ExactBrowserTargetLease(
      this,
      `browser-target-lease:${randomUUID()}`,
      ownerId,
    );
    this.leases.set(ownerId, lease);
    return browserTargetLeaseFacade(lease);
  }
  assertValid(): void {
    if (!this.valid) throw new Error("BROWSER_TARGET_LEASE_STALE");
  }
  invalidate(): void {
    if (!this.valid) return;
    this.valid = false;
    this.registry.invalidateAll();
    for (const lease of this.leases.values()) lease.invalidate();
    this.leases.clear();
  }
  targetCount(): number {
    return this.registry.occupiedTabIds().length;
  }
}
