const EXACT_ACCESSIBILITY_WINDOW_STABILIZATION_ATTEMPTS = 30;
const EXACT_ACCESSIBILITY_WINDOW_STABILIZATION_DELAY_SECONDS = 0.025;

export const buildExactChromeAccessibilityWindowRaiseScript = (input: {
  chromeWindowVariable: string;
  boundsVariable: string;
  mismatchReason: string;
}): string => `
const exactChromeSystemEvents = Application("System Events");
const exactChromeProcesses = exactChromeSystemEvents.applicationProcesses.whose({name: {_equals: "Google Chrome"}})();
if (exactChromeProcesses.length === 0) {
  throw new Error("Google Chrome accessibility process is unavailable");
}
const exactChromeProcess = exactChromeProcesses[0];
let exactChromeMatchingWindows = [];
for (
  let exactChromeMatchAttempt = 1;
  exactChromeMatchAttempt <= ${EXACT_ACCESSIBILITY_WINDOW_STABILIZATION_ATTEMPTS};
  exactChromeMatchAttempt += 1
) {
  exactChromeMatchingWindows = exactChromeProcess.windows().filter((candidate) => {
    const position = candidate.position();
    const size = candidate.size();
    return position[0] === ${input.boundsVariable}.x
      && position[1] === ${input.boundsVariable}.y
      && size[0] === ${input.boundsVariable}.width
      && size[1] === ${input.boundsVariable}.height;
  });
  if (exactChromeMatchingWindows.length === 1) break;
  if (exactChromeMatchingWindows.length > 1) break;
  delay(${EXACT_ACCESSIBILITY_WINDOW_STABILIZATION_DELAY_SECONDS});
}
if (exactChromeMatchingWindows.length !== 1) {
  throw new Error(${JSON.stringify(input.mismatchReason)} + "; count=" + exactChromeMatchingWindows.length);
}
${input.chromeWindowVariable}.index = 1;
exactChromeProcess.frontmost = true;
exactChromeMatchingWindows[0].actions.byName("AXRaise").perform();
delay(0.05);
`;
