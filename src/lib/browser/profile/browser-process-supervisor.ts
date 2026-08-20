import { randomUUID } from "node:crypto";
import type { BrowserProfileConfig } from "./browser-profile-config.js";
import type { BrowserProfileProcessAttestation } from "./browser-profile-process-attestation.js";
import type { BrowserProfileState } from "./browser-profile-state.js";
import { attestBrowserProcess } from "./browser-profile-process-attestation.js";

export class BrowserProcessSupervisor {
  private processAttestation: BrowserProfileProcessAttestation | null = null;

  public constructor(
    private readonly config: BrowserProfileConfig,
    private readonly enrolledProfile: BrowserProfileState,
  ) {}

  public startManagedProcess(): BrowserProfileProcessAttestation {
    if (this.enrolledProfile.profileRef !== this.config.profileRef) throw new Error("BROWSER_PROCESS_UNVERIFIED");
    this.processAttestation = attestBrowserProcess(this.enrolledProfile, randomUUID());
    return this.processAttestation;
  }

  public currentAttestation(): BrowserProfileProcessAttestation | null {
    return this.processAttestation;
  }

  public stop(): void {
    this.processAttestation = null;
  }
}
