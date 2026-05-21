import { runAppleScript } from "../../lib/browser/current-chrome-window-control.js";

const escapeAppleScriptText = (value: string): string =>
  value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');

export const focusExistingFacebookVideoTab = async (input: {
  preferredUrl: string | null;
  abortSignal?: AbortSignal;
}): Promise<boolean> => {
  const preferredUrl = input.preferredUrl ?? "";
  const result = await runAppleScript(`
tell application "Google Chrome" to activate
tell application "Google Chrome"
  if (count of windows) = 0 then return "not_found"
  repeat with w in windows
    set tIndex to 1
    repeat with t in tabs of w
      set tabUrl to URL of t
      if tabUrl contains "facebook.com/reel" or tabUrl contains "facebook.com/reels" then
        if "${escapeAppleScriptText(preferredUrl)}" is "" or tabUrl is "${escapeAppleScriptText(preferredUrl)}" or tabUrl contains "facebook.com/reel" then
          set active tab index of w to tIndex
          set index of w to 1
          return "focused"
        end if
      end if
      set tIndex to tIndex + 1
    end repeat
  end repeat
  return "not_found"
end tell
`, input.abortSignal ? { signal: input.abortSignal } : undefined);
  return result.trim() === "focused";
};
