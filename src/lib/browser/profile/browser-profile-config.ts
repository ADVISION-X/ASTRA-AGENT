import {
  readBrowserProfileEnrollment,
  type BrowserProfileEnrollment,
} from "./browser-profile-enrollment.js";

export const resolveProductionBrowserProfileEnrollment = (
  input: Readonly<{
    platform: string;
  }>,
): BrowserProfileEnrollment => {
  return readBrowserProfileEnrollment({ platform: input.platform });
};
