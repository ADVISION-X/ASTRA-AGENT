export type SessionWorkspaceBindingV6 = Readonly<{
  schemaVersion: "grasseye.session-workspace-binding.v6";
  workspaceRef: string;
  authorityRef: string;
  authorityEpoch: number;
  connectionGeneration: number;
  profileHash: `sha256:${string}`;
  extensionId: string;
  releaseBuildId: string;
  directoryHash: `sha256:${string}`;
  sitePolicyHash: `sha256:${string}`;
  establishedAt: string;
}>;

export class BrowserSessionWorkspace {
  private revoked = false;

  public constructor(private readonly binding: SessionWorkspaceBindingV6) {
    if (binding.schemaVersion !== "grasseye.session-workspace-binding.v6"
      || !binding.workspaceRef || !binding.authorityRef || binding.authorityEpoch < 1
      || binding.connectionGeneration < 1 || !binding.extensionId || !binding.releaseBuildId
      || !/^sha256:[a-f0-9]{64}$/u.test(binding.profileHash)
      || !/^sha256:[a-f0-9]{64}$/u.test(binding.directoryHash)
      || !/^sha256:[a-f0-9]{64}$/u.test(binding.sitePolicyHash)
      || !Number.isFinite(Date.parse(binding.establishedAt))) {
      throw new Error("BROWSER_SESSION_WORKSPACE_INVALID");
    }
  }

  public ref(): string { return this.binding.workspaceRef; }

  public belongsTo(authorityRef: string, authorityEpoch: number, connectionGeneration: number): boolean {
    return this.binding.authorityRef === authorityRef
      && this.binding.authorityEpoch === authorityEpoch
      && this.binding.connectionGeneration === connectionGeneration;
  }

  public assertCurrent(): void {
    if (this.revoked) throw new Error("BROWSER_SESSION_WORKSPACE_REVOKED");
  }

  public revoke(): void { this.revoked = true; }
}
