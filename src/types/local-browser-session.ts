import { z } from "zod";

export const BrowserModeSchema = z.enum(["real_chrome_persistent", "fixture", "unsupported"]);

export const BrowserProfileProvisioningSchema = z.enum(["operator_supplied", "managed_default"]);

export const BrowserProfileVerificationStatusSchema = z.enum(["operator_verified", "default_unverified"]);

export const BrowserProfileStatusSchema = z.enum([
  "profile_ready",
  "profile_missing",
  "profile_locked",
  "profile_unavailable",
  "login_required",
  "logged_in",
  "unknown",
]);

export const BrowserLoginStateSchema = z.enum(["unknown", "login_required", "logged_in", "review_required"]);

export const LocalBrowserSessionConfigSchema = z.object({
  browserMode: BrowserModeSchema,
  platform: z.string().min(1),
  chromeExecutablePath: z.string().min(1).nullable().default(null),
  profileRef: z.string().min(1),
  userDataDir: z.string().min(1),
  profileDirectory: z.string().min(1),
  profileProvisioning: BrowserProfileProvisioningSchema,
  profileVerificationStatus: BrowserProfileVerificationStatusSchema,
  profileVerificationReason: z.string().min(1).nullable().default(null),
  headlessAllowed: z.literal(false).default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const LocalBrowserSessionStateSchema = z.object({
  browserMode: BrowserModeSchema,
  browserProfileRef: z.string().min(1),
  browserExecutablePath: z.string().min(1).nullable().default(null),
  profileStatus: BrowserProfileStatusSchema,
  profileDirectory: z.string().min(1),
  profileProvisioning: BrowserProfileProvisioningSchema,
  profileVerificationStatus: BrowserProfileVerificationStatusSchema,
  profileVerificationReason: z.string().min(1).nullable().default(null),
  loginState: BrowserLoginStateSchema,
  currentUrl: z.string().min(1),
  lastLoginCheckAt: z.string().datetime().nullable().default(null),
  loginRequiredReason: z.string().min(1).nullable().default(null),
  reviewRequiredReason: z.string().min(1).nullable().default(null),
});

export type BrowserMode = z.infer<typeof BrowserModeSchema>;
export type BrowserProfileProvisioning = z.infer<typeof BrowserProfileProvisioningSchema>;
export type BrowserProfileVerificationStatus = z.infer<typeof BrowserProfileVerificationStatusSchema>;
export type BrowserProfileStatus = z.infer<typeof BrowserProfileStatusSchema>;
export type BrowserLoginState = z.infer<typeof BrowserLoginStateSchema>;
export type LocalBrowserSessionConfig = z.infer<typeof LocalBrowserSessionConfigSchema>;
export type LocalBrowserSessionState = z.infer<typeof LocalBrowserSessionStateSchema>;