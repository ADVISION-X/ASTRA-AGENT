export type BrowserProfileState = Readonly<{
  profileRef: string;
  enrollmentHash: `sha256:${string}`;
  policyHash: `sha256:${string}`;
  extensionTreeHash: `sha256:${string}`;
  enrolledAt: string;
}>;
