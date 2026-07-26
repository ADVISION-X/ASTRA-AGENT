import { runAppleScript } from "../../../lib/browser/current-chrome-window-control.js";

export type SingleProviderTabFocus =
  | "focused"
  | "not_found"
  | "ambiguous";

const providerOrigin = (
  providerKind: "gpt-web-chat" | "gemini-web-chat",
): string => providerKind === "gpt-web-chat"
  ? "https://chatgpt.com"
  : "https://gemini.google.com";

const escapeAppleScriptText = (value: string): string =>
  value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');

export const focusSingleProviderTab = async (input: {
  providerKind: "gpt-web-chat" | "gemini-web-chat";
  signal?: AbortSignal;
}): Promise<SingleProviderTabFocus> => {
  const origin = escapeAppleScriptText(providerOrigin(input.providerKind));
  const result = await runAppleScript(`
tell application "Google Chrome" to activate
tell application "Google Chrome"
  if (count of windows) = 0 then return "not_found"
  set matchCount to 0
  set targetWindow to missing value
  set targetTabIndex to 0
  repeat with w in windows
    set tIndex to 1
    repeat with t in tabs of w
      set tabUrl to URL of t
      if tabUrl is "${origin}" or tabUrl starts with "${origin}/" then
        set matchCount to matchCount + 1
        set targetWindow to w
        set targetTabIndex to tIndex
      end if
      set tIndex to tIndex + 1
    end repeat
  end repeat
  if matchCount is 0 then return "not_found"
  if matchCount is greater than 1 then return "ambiguous"
  set active tab index of targetWindow to targetTabIndex
  set index of targetWindow to 1
  return "focused"
end tell
`, input.signal ? { signal: input.signal } : undefined);
  if (result === "focused" || result === "not_found" || result === "ambiguous") {
    return result;
  }
  throw new Error(`review_required: unexpected provider tab focus result; result=${result}`);
};
