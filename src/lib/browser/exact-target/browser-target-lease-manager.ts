import { randomUUID } from "node:crypto";
import type { BrowserAuthorityCertificateV1 } from "../infrastructure/browser-authority-certificate.js";
import { hashBrowserAuthorityCertificate } from "../infrastructure/browser-authority-certificate.js";
import type { BrowserCommandActor } from "./browser-command-actor.js";
import type { BrowserCapabilityId } from "../protocol/generated/browser-protocol.generated.js";
import type { BrowserCommandPermit, BrowserUnsignedCommandPermit } from "../transport/command-permit.js";
import type { BrowserTargetLease } from "./browser-target-lease.js";
import type { BrowserControlledTarget, BrowserDocumentRef } from "./browser-target-ref.js";
import type { BrowserDomIntent } from "./browser-dom-intent.js";
import type { BrowserFileArtifactGrantV1 } from "./browser-file-artifact-grant.js";
import type { BrowserExecutionBinding } from "../infrastructure/browser-authority-broker.js";

export type BrowserExactTargetAcquisition = Readonly<{
  target: BrowserControlledTarget;
  ownerId: string;
}>;

export type BrowserCommandPermitSigner = Readonly<{
  signCurrentCommandPermit(permit: BrowserUnsignedCommandPermit): `sha256:${string}`;
}>;

export class BrowserTargetLeaseManager {
  public constructor(
    private readonly certificate: BrowserAuthorityCertificateV1,
    private readonly executionBinding: BrowserExecutionBinding,
    private readonly commandActor: BrowserCommandActor,
    private readonly permitSigner: BrowserCommandPermitSigner,
  ) {}

  public acquire(input: BrowserExactTargetAcquisition): BrowserTargetLease {
    if (
      input.target.target.authorityEpoch !== this.certificate.authorityEpoch
      || input.target.target.executionBindingHash !== this.executionBinding.executionRefHash
      || input.target.document.targetRef !== input.target.target.targetRef
    ) {
      throw new Error("BROWSER_TARGET_INVALID");
    }
    let current = input.target;
    let closed = false;
    const leaseRef = `target-lease-${randomUUID()}`;
    let sequence = 0;
    const command = async (capabilityId: BrowserCapabilityId, value: Parameters<BrowserCommandActor["execute"]>[1]): Promise<unknown> => {
      if (closed) throw new Error("BROWSER_TARGET_INVALID");
      const permit = this.permit({
        leaseRef,
        sequence: ++sequence,
        targetRef: input.target.target.targetRef,
        documentRef: current.document.documentRef,
        capabilityId,
        mutationClass: this.mutationClass(value),
      });
      return this.commandActor.execute(permit, value);
    };
    return {
      leaseRef,
      authorityRef: this.certificate.authorityRef,
      authorityEpoch: this.certificate.authorityEpoch,
      executionBindingHash: this.executionBinding.executionRefHash,
      ownerId: input.ownerId,
      agentJobRefHash: this.executionBinding.jobRefHash,
      agentExecutionRefHash: this.executionBinding.executionRefHash,
      writerLeaseEpoch: this.executionBinding.writerLeaseEpoch,
      writerFenceHash: this.executionBinding.writerFenceHash,
      target: input.target.target,
      get document() { return current.document; },
      navigate: async ({ url, title }) => {
        const result = await command("browser.navigate.v1", { kind: "navigate", url, title });
        const document = result as BrowserDocumentRef;
        if (
          !document
          || typeof document.documentRef !== "string"
          || document.targetRef !== input.target.target.targetRef
          || !Number.isInteger(document.navigationEpoch)
          || document.navigationEpoch <= current.document.navigationEpoch
        ) {
          throw new Error("BROWSER_DOCUMENT_INVALID");
        }
        current = { ...current, document, url, title };
        return document;
      },
      executeDomIntent: async (intent: BrowserDomIntent) => command(this.capabilityForIntent(intent), { kind: "dom-intent", intent }),
      observeCapability: async ({ capabilityId }) => command(capabilityId, { kind: "observe", capabilityId }),
      captureScreenshot: async ({ regionLabel }) => {
        const result = await command("browser.screenshot.v1", { kind: "screenshot", regionLabel });
        const artifact = result as { artifactRef?: unknown; contentHash?: unknown };
        if (typeof artifact.artifactRef !== "string" || typeof artifact.contentHash !== "string") throw new Error("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
        return { artifactRef: artifact.artifactRef, contentHash: artifact.contentHash as `sha256:${string}` };
      },
      attachFile: async ({ selector, grants }: { selector: string; grants: readonly BrowserFileArtifactGrantV1[] }) => {
        if (grants.length === 0 || grants.length > 20 || new Set(grants.map((grant) => grant.grantRef)).size !== grants.length) {
          throw new Error("BROWSER_FILE_GRANT_INVALID");
        }
        for (const grant of grants) {
          if (grant.authorityEpoch !== this.certificate.authorityEpoch || grant.executionBindingHash !== this.executionBinding.executionRefHash) {
            throw new Error("BROWSER_FILE_GRANT_INVALID");
          }
        }
        await command("browser.file-input.v1", { kind: "file-input", selector, grantRefs: grants.map((grant) => grant.grantRef) });
      },
      wait: async ({ durationMs }) => { await command("browser.wait.v1", { kind: "wait", durationMs }); },
      close: async ({ reason }) => { await command("browser.close-target.v1", { kind: "close-target", reason }); closed = true; },
    };
  }

  private permit(input: Readonly<{
    leaseRef: string;
    sequence: number;
    targetRef: string;
    documentRef: string;
    capabilityId: BrowserCapabilityId;
    mutationClass: BrowserCommandPermit["mutationClass"];
  }>): BrowserCommandPermit {
    const commandId = randomUUID();
    const replyChannelToken = randomUUID();
    const certificateHash = hashBrowserAuthorityCertificate(this.certificate);
    const unsigned: BrowserUnsignedCommandPermit = {
      permitRef: randomUUID(),
      authorityRef: this.certificate.authorityRef,
      authorityEpoch: this.certificate.authorityEpoch,
      certificateHash,
      channelSessionHash: this.certificate.channelSessionHash,
      executionBindingHash: this.executionBinding.executionRefHash,
      targetLeaseRef: input.leaseRef,
      targetRef: input.targetRef,
      documentRef: input.documentRef,
      capabilityId: input.capabilityId,
      commandId,
      sequence: input.sequence,
      mutationClass: input.mutationClass,
      deadlineAt: new Date(Date.now() + 30_000).toISOString(),
      replyChannelToken,
    };
    return {
      ...unsigned,
      commandFrameMac: this.permitSigner.signCurrentCommandPermit(unsigned),
    };
  }

  private mutationClass(command: Parameters<BrowserCommandActor["execute"]>[1]): BrowserCommandPermit["mutationClass"] {
    if (command.kind === "close-target") return "lifecycle";
    if (command.kind === "file-input") return "mutation";
    if (command.kind === "dom-intent" && (command.intent.kind === "click" || command.intent.kind === "fill")) return "mutation";
    return "observation";
  }

  private capabilityForIntent(intent: BrowserDomIntent): BrowserCapabilityId {
    switch (intent.kind) {
      case "document":
      case "inspect": return "browser.dom.inspect.v1";
      case "find": return "browser.dom.find.v1";
      case "readText": return "browser.dom.read-text.v1";
      case "readAttribute": return "browser.dom.read-attribute.v1";
      case "click": return "browser.dom.click.v1";
      case "fill": return "browser.dom.fill.v1";
    }
  }
}
