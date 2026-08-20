import { randomUUID } from "node:crypto";

import { BrowserTerminalError } from "./browser-command-contract.js";
import type {
  BrowserDocumentRef,
  BrowserTargetRef,
  ControlledBrowserTarget,
} from "./browser-target-ref.js";
import type { BrowserWireTargetDescriptor } from "../protocol/generated/browser-protocol.js";

interface RegistryEntry {
  readonly authorityRef: string;
  readonly ownerId: string;
  readonly targetRef: BrowserTargetRef;
  documentRef: BrowserDocumentRef;
  descriptor: BrowserWireTargetDescriptor;
  readonly allowedOrigin: string;
  readonly acquiredAt: string;
  lifecycle: "attached" | "detached" | "closed";
}

const opaque = <T extends string>(prefix: string): T =>
  `${prefix}_${randomUUID().replaceAll("-", "")}` as T;

const originOf = (value: string): string => {
  try { return new URL(value).origin; } catch { return "null"; }
};

export class BrowserTargetRegistry {
  private readonly entries = new Map<BrowserTargetRef, RegistryEntry>();

  constructor(private readonly authorityRef: string) {}

  register(
    ownerId: string,
    descriptor: BrowserWireTargetDescriptor,
    allowedOrigin = originOf(descriptor.url),
  ): ControlledBrowserTarget {
    if (!Number.isInteger(descriptor.tabId)) {
      throw new BrowserTerminalError("TARGET_NOT_FOUND", "target descriptor has no raw Chrome tab identity");
    }
    const conflict = [...this.entries.values()].find((entry) =>
      entry.lifecycle === "attached" && entry.descriptor.tabId === descriptor.tabId,
    );
    if (conflict) {
      throw new BrowserTerminalError(
        "TARGET_AMBIGUOUS",
        `Chrome target is already leased by ${conflict.ownerId}`,
      );
    }
    this.assertAllowedOrigin(allowedOrigin, descriptor.url);
    const entry: RegistryEntry = {
      authorityRef: this.authorityRef,
      ownerId,
      targetRef: opaque<BrowserTargetRef>("bt"),
      documentRef: opaque<BrowserDocumentRef>("bd"),
      descriptor,
      allowedOrigin,
      acquiredAt: new Date().toISOString(),
      lifecycle: "attached",
    };
    this.entries.set(entry.targetRef, entry);
    return this.publicTarget(entry);
  }

  resolve(targetRef: BrowserTargetRef, documentRef?: BrowserDocumentRef): RegistryEntry {
    const entry = this.entries.get(targetRef);
    if (!entry || entry.authorityRef !== this.authorityRef) {
      throw new BrowserTerminalError(
        "TARGET_FOREIGN_AUTHORITY",
        "target ref is unknown to the current browser authority",
      );
    }
    if (entry.lifecycle !== "attached") {
      throw new BrowserTerminalError("TARGET_CLOSED", "target is no longer attached");
    }
    if (documentRef && entry.documentRef !== documentRef) {
      throw new BrowserTerminalError(
        "DOCUMENT_STALE",
        "document ref does not match the target current generation",
      );
    }
    return entry;
  }

  updateDocument(targetRef: BrowserTargetRef, descriptor: BrowserWireTargetDescriptor): ControlledBrowserTarget {
    const entry = this.resolve(targetRef);
    this.assertAllowedOrigin(entry.allowedOrigin, descriptor.url);
    if (descriptor.loaderId !== entry.descriptor.loaderId) {
      entry.documentRef = opaque<BrowserDocumentRef>("bd");
    }
    entry.descriptor = descriptor;
    return this.publicTarget(entry);
  }

  close(targetRef: BrowserTargetRef): void {
    const entry = this.entries.get(targetRef);
    if (entry) entry.lifecycle = "closed";
  }

  release(targetRef: BrowserTargetRef): void {
    const entry = this.resolve(targetRef);
    entry.lifecycle = "detached";
  }

  invalidateAll(): void {
    for (const entry of this.entries.values()) entry.lifecycle = "detached";
  }

  occupiedTabIds(): number[] {
    return [...this.entries.values()]
      .filter((entry) => entry.lifecycle === "attached")
      .map((entry) => entry.descriptor.tabId);
  }

  assertNavigationOrigin(targetRef: BrowserTargetRef, requestedUrl: string): void {
    const entry = this.resolve(targetRef);
    this.assertAllowedOrigin(entry.allowedOrigin, requestedUrl);
  }

  private assertAllowedOrigin(allowedOrigin: string, observedUrl: string): void {
    const observedOrigin = originOf(observedUrl);
    if (allowedOrigin !== "null" && observedOrigin !== allowedOrigin) {
      throw new BrowserTerminalError(
        "TARGET_ORIGIN_MISMATCH",
        `expected ${allowedOrigin}, observed ${observedOrigin}`,
      );
    }
  }

  private publicTarget(entry: RegistryEntry): ControlledBrowserTarget {
    return {
      targetRef: entry.targetRef,
      documentRef: entry.documentRef,
      url: entry.descriptor.url,
      title: entry.descriptor.title,
      origin: entry.allowedOrigin,
      lifecycle: entry.lifecycle,
      acquiredAt: entry.acquiredAt,
    };
  }
}
