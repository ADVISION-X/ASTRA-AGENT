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
import type { BrowserSessionWorkspace, SessionWorkspaceBindingV6 } from "./browser-session-workspace.js";
import type { BrowserOutcomeResolutionReceipt } from "./browser-outcome-resolver.js";
export type { SessionWorkspaceBindingV6 } from "./browser-session-workspace.js";

export type BrowserExactTargetAcquisition = Readonly<{
  target: BrowserControlledTarget;
  ownerId: string;
}>;

export type BrowserCommandPermitSigner = Readonly<{
  signCurrentCommandPermit(permit: BrowserUnsignedCommandPermit): `sha256:${string}`;
}>;

type LeaseState = {
  current: BrowserControlledTarget;
  closed: boolean;
  sequence: number;
  pendingMutationCommandIds: string[];
};

type LeaseCommand = (
  capabilityId: BrowserCapabilityId,
  value: Parameters<BrowserCommandActor["execute"]>[1],
) => Promise<unknown>;

export class BrowserTargetLeaseManager {
  public constructor(
    private readonly certificate: BrowserAuthorityCertificateV1,
    private readonly executionBinding: BrowserExecutionBinding,
    private readonly commandActor: BrowserCommandActor,
    private readonly permitSigner: BrowserCommandPermitSigner,
    private readonly workspace: BrowserSessionWorkspace | undefined,
    private readonly resolveCurrentTarget: () => BrowserControlledTarget | null,
    private readonly resolveGrantPaths: (
      grants: readonly BrowserFileArtifactGrantV1[],
    ) => Promise<readonly string[]>,
  ) {}

  public acquire(input: BrowserExactTargetAcquisition): BrowserTargetLease {
    this.assertAcquisition(input);
    const state: LeaseState = {
      current: input.target,
      closed: false,
      sequence: 0,
      pendingMutationCommandIds: [...this.commandActor.pendingMutationCommandIds(this.executionBinding)],
    };
    const leaseRef = `target-lease-${randomUUID()}`;
    const command = this.createLeaseCommand(input, state, leaseRef);
    return this.createTargetLease(input, state, leaseRef, command);
  }

  private assertAcquisition(input: BrowserExactTargetAcquisition): void {
    if (!this.workspace) throw new Error("BROWSER_SESSION_WORKSPACE_REQUIRED");
    this.workspace.assertCurrent();
    if (!Number.isInteger(this.executionBinding.commandTtlMs)
      || this.executionBinding.commandTtlMs < 1
      || this.executionBinding.commandTtlMs > 3_600_000) {
      throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
    }
    if (
      input.target.target.authorityEpoch !== this.certificate.authorityEpoch
      || input.target.target.executionBindingHash !== this.executionBinding.executionRefHash
      || input.target.document.targetRef !== input.target.target.targetRef
    ) {
      throw new Error("BROWSER_TARGET_INVALID");
    }
  }

  private createLeaseCommand(
    input: BrowserExactTargetAcquisition,
    state: LeaseState,
    leaseRef: string,
  ): LeaseCommand {
    return async (capabilityId, value) => {
      if (state.closed) throw new Error("BROWSER_TARGET_INVALID");
      if (this.mutationClass(value) === "mutation" && state.pendingMutationCommandIds.length > 0) {
        throw new Error("BROWSER_OUTCOME_UNKNOWN");
      }
      this.workspace?.assertCurrent();
      const currentTarget = this.resolveCurrentTarget();
      if (!currentTarget
        || currentTarget.target.targetRef !== input.target.target.targetRef
        || currentTarget.target.authorityEpoch !== input.target.target.authorityEpoch
        || currentTarget.target.executionBindingHash !== this.executionBinding.executionRefHash
        || currentTarget.document.targetRef !== currentTarget.target.targetRef
        || currentTarget.document.navigationEpoch < state.current.document.navigationEpoch) {
        throw new Error("BROWSER_DOCUMENT_INVALID");
      }
      state.current = currentTarget;
      const permit = this.permit({
        leaseRef,
        sequence: ++state.sequence,
        targetRef: input.target.target.targetRef,
        documentRef: state.current.document.documentRef,
        capabilityId,
        mutationClass: this.mutationClass(value),
      });
      try {
        const result = await this.commandActor.execute(permit, value);
        if (this.mutationClass(value) === "mutation") state.pendingMutationCommandIds.push(permit.commandId);
        return result;
      } catch (error) {
        if (this.commandActor.hasUnknownMutation(permit.commandId)) state.pendingMutationCommandIds.push(permit.commandId);
        throw error;
      }
    };
  }

  private createTargetLease(
    input: BrowserExactTargetAcquisition,
    state: LeaseState,
    leaseRef: string,
    command: LeaseCommand,
  ): BrowserTargetLease {
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
      get document() { return state.current.document; },
      navigate: ({ url, title }) => this.navigate(input, state, command, url, title),
      executeDomIntent: async (intent: BrowserDomIntent) => command(this.capabilityForIntent(intent), { kind: "dom-intent", intent }),
      observeCapability: async ({ capabilityId }) => command(capabilityId, { kind: "observe", capabilityId }),
      captureScreenshot: ({ regionLabel }) => this.captureScreenshot(command, regionLabel),
      attachFile: ({ selector, grants }) => this.attachFile(command, selector, grants),
      registerFileArtifact: async () => {
        throw new Error("BROWSER_FILE_GRANT_INVALID");
      },
      issueFileArtifactGrant: async () => {
        throw new Error("BROWSER_FILE_GRANT_INVALID");
      },
      wait: async ({ durationMs }) => { await command("browser.wait.v1", { kind: "wait", durationMs }); },
      close: async ({ reason }) => { await command("browser.close-target.v1", { kind: "close-target", reason }); state.closed = true; },
      resolvePendingMutation: (receipt) => this.resolvePendingMutation(state, receipt),
      assertNoPendingMutations: () => {
        if (state.pendingMutationCommandIds.length > 0) throw new Error("BROWSER_OUTCOME_UNKNOWN");
      },
    };
  }

  private async navigate(
    input: BrowserExactTargetAcquisition,
    state: LeaseState,
    command: LeaseCommand,
    url: string,
    title: string,
  ): Promise<BrowserDocumentRef> {
    const result = await command("browser.navigate.v1", { kind: "navigate", url, title });
    const document = result as BrowserDocumentRef;
    if (!document || typeof document.documentRef !== "string"
      || document.targetRef !== input.target.target.targetRef
      || !Number.isInteger(document.navigationEpoch)
      || document.navigationEpoch <= state.current.document.navigationEpoch) {
      throw new Error("BROWSER_DOCUMENT_INVALID");
    }
    state.current = { ...state.current, document, url, title };
    return document;
  }

  private async captureScreenshot(command: LeaseCommand, regionLabel: string): Promise<Readonly<{
    artifactRef: string;
    contentHash: `sha256:${string}`;
  }>> {
    const result = await command("browser.screenshot.v1", { kind: "screenshot", regionLabel });
    const artifact = result as { artifactRef?: unknown; contentHash?: unknown };
    if (typeof artifact.artifactRef !== "string" || typeof artifact.contentHash !== "string") {
      throw new Error("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
    }
    return { artifactRef: artifact.artifactRef, contentHash: artifact.contentHash as `sha256:${string}` };
  }

  private async attachFile(
    command: LeaseCommand,
    selector: string,
    grants: readonly BrowserFileArtifactGrantV1[],
  ): Promise<void> {
    if (grants.length === 0 || grants.length > 20 || new Set(grants.map((grant) => grant.grantRef)).size !== grants.length) {
      throw new Error("BROWSER_FILE_GRANT_INVALID");
    }
    if (grants.some((grant) => grant.authorityEpoch !== this.certificate.authorityEpoch
      || grant.executionBindingHash !== this.executionBinding.executionRefHash)) {
      throw new Error("BROWSER_FILE_GRANT_INVALID");
    }
    const resolvedFilePaths = await this.resolveGrantPaths(grants);
    await command("browser.file-input.v1", {
      kind: "file-input",
      selector,
      grantRefs: grants.map((grant) => grant.grantRef),
      resolvedFilePaths,
    });
  }

  private async resolvePendingMutation(
    state: LeaseState,
    receipt: Omit<BrowserOutcomeResolutionReceipt, "commandId">,
  ): Promise<number> {
    const commandIds = [...state.pendingMutationCommandIds];
    const commandId = commandIds[0];
    if (commandIds.length !== 1 || commandId === undefined) throw new Error("BROWSER_OUTCOME_UNKNOWN");
    await this.commandActor.resolveUnknownMutation({ ...receipt, commandId });
    state.pendingMutationCommandIds.splice(state.pendingMutationCommandIds.indexOf(commandId), 1);
    return 1;
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
      writerFenceHash: this.executionBinding.writerFenceHash,
      candidateHash: this.executionBinding.candidateHash,
      contractManifestHash: this.executionBinding.contractManifestHash,
      ownerPluginId: this.executionBinding.ownerPluginId,
      jobId: this.executionBinding.jobId,
      attemptId: this.executionBinding.attemptId,
      deviceId: this.executionBinding.deviceId,
      leaseVersion: this.executionBinding.leaseVersion,
      localOrderId: this.executionBinding.localOrderId,
      targetLeaseRef: input.leaseRef,
      targetRef: input.targetRef,
      documentRef: input.documentRef,
      capabilityId: input.capabilityId,
      commandId,
      sequence: input.sequence,
      mutationClass: input.mutationClass,
      workspaceRef: this.workspace?.ref() ?? "",
      commandTtlMs: this.executionBinding.commandTtlMs,
      replyChannelToken,
    };
    return {
      ...unsigned,
      commandFrameMac: this.permitSigner.signCurrentCommandPermit(unsigned),
    };
  }

  private mutationClass(command: Parameters<BrowserCommandActor["execute"]>[1]): BrowserCommandPermit["mutationClass"] {
    if (command.kind === "navigate" || command.kind === "close-target") return "lifecycle";
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
