import { z } from "zod";

import {
  BrowserLoginStateSchema,
  BrowserModeSchema,
  BrowserProfileVerificationStatusSchema,
  nullableString,
} from "./schema-base.js";

export const BrowserOpenOutputSchema = z.object({
  targetProfileRef: z.string().min(1),
  targetUrl: z.string().url(),
  openedUrl: z.string().url(),
  redirectChain: z.array(z.string().url()).default([]),
  pageTitleAfter: nullableString,
  browserSessionRef: z.string().min(1),
  browserProfileRef: z.string().min(1),
  browserMode: BrowserModeSchema,
  profileVerificationStatus: BrowserProfileVerificationStatusSchema,
  loginStateBefore: BrowserLoginStateSchema,
  loginStateAfter: BrowserLoginStateSchema,
  sourceRef: z.string().min(1),
  openAttemptRef: z.string().min(1),
  pageStateHandoffRef: z.string().min(1),
  pageStateHandoffRequired: z.literal(true),
}).strict();

export const LocalProgramOpenOutputSchema = z.object({
  targetProfileRef: z.string().min(1),
  appName: z.string().min(1),
  bundleId: nullableString,
  appPath: nullableString,
  allowedLaunchMethod: z.literal("macos-open-application"),
  sourceRef: z.string().min(1),
  openAttemptRef: z.string().min(1),
  localProgramOpenAttemptRef: z.string().min(1),
  appLaunchAttemptRef: z.string().min(1),
  windowHandoffRef: z.string().min(1),
  localAppStateHandoffRef: z.string().min(1),
  pageStateHandoffRef: z.string().min(1),
  pageStateHandoffRequired: z.literal(true),
  localAppStateHandoffRequired: z.literal(true),
}).strict();

export const OpenOutputSchema = z.union([
  BrowserOpenOutputSchema,
  LocalProgramOpenOutputSchema,
]);
