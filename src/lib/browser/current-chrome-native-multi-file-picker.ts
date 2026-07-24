import { resolve } from "node:path";

import type {
  BrowserController,
  BrowserNativeMultiFilePickerResult,
} from "./browser-controller.js";
import { createCurrentChromeBrowserActionResult } from "./current-chrome-browser-action-result.js";
import { escapeAppleScriptText } from "./current-chrome-browser-controller-primitives.js";
import { runAppleScript } from "./current-chrome-window-control.js";

type NativePickerInput = Parameters<NonNullable<BrowserController["selectFilesInNativePicker"]>>[0];

const appleScriptList = (values: readonly string[]): string =>
  `{${values.map((value) => `"${escapeAppleScriptText(value)}"`).join(", ")}}`;

const buildPickerOpenScript = (input: {
  stagingDirectoryPath: string;
  expectedFileNames: readonly string[];
}): string => `
set expectedNames to ${appleScriptList(input.expectedFileNames)}
set expectedCount to count of expectedNames
set observedNames to {}

tell application "Google Chrome" to activate
tell application "System Events"
  tell process "Google Chrome"
    set frontmost to true
    if (count of windows) is 0 then return "FAILED" & linefeed & "NATIVE_PICKER_CHROME_WINDOW_MISSING"

    set pickerSheetReady to false
    repeat with pollIndex from 1 to 50
      set pickerSheetCount to count of sheets of window 1
      if pickerSheetCount is greater than 1 then return "FAILED" & linefeed & "NATIVE_PICKER_AMBIGUOUS"
      if pickerSheetCount is 1 then
        set pickerSheetReady to true
        exit repeat
      end if
      delay 0.1
    end repeat
    if pickerSheetReady is false then return "FAILED" & linefeed & "NATIVE_PICKER_NOT_READY"

    set targetSheet to sheet 1 of window 1
    keystroke "g" using {command down, shift down}

    set folderFieldReady to false
    repeat with pollIndex from 1 to 50
      try
        set focusedElement to value of attribute "AXFocusedUIElement"
        set focusedRole to role of focusedElement
        if focusedRole is "AXTextField" or focusedRole is "AXComboBox" then
          set folderFieldReady to true
          exit repeat
        end if
      end try
      delay 0.1
    end repeat
    if folderFieldReady is false then return "FAILED" & linefeed & "NATIVE_FOLDER_FIELD_NOT_FOCUSED"

    set the clipboard to "${escapeAppleScriptText(resolve(input.stagingDirectoryPath))}"
    keystroke "v" using command down
    key code 36
    keystroke "2" using command down
`;

const buildPickerFileListProofScript = (): string => `
    set fileListReady to false
    repeat with pollIndex from 1 to 100
      set observedNames to {}
      try
        set mainSplitGroup to UI element 1 of targetSheet
        if role of mainSplitGroup is not "AXSplitGroup" then error "main split group missing"
        set contentSplitGroup to UI element 3 of mainSplitGroup
        if role of contentSplitGroup is not "AXSplitGroup" then error "content split group missing"
        set contentScrollArea to UI element 1 of contentSplitGroup
        if role of contentScrollArea is not "AXScrollArea" then error "content scroll area missing"
        set fileOutline to UI element 1 of contentScrollArea
        if role of fileOutline is not "AXOutline" then error "file outline missing"
        set dataRowCount to (count of rows of fileOutline) - 1
        if dataRowCount is expectedCount then
          repeat with rowIndex from 2 to count of rows of fileOutline
            set fileCell to UI element 1 of row rowIndex of fileOutline
            set fileNameField to UI element 2 of fileCell
            set observedName to value of fileNameField as text
            set end of observedNames to observedName
          end repeat
        end if
      end try
      if (count of observedNames) is expectedCount then
        set exactMembership to true
        repeat with expectedName in expectedNames
          set expectedText to expectedName as text
          if observedNames does not contain expectedText then set exactMembership to false
        end repeat
        if exactMembership is true then
          set fileListReady to true
          exit repeat
        end if
      end if
      delay 0.1
    end repeat
    if fileListReady is false then return "FAILED" & linefeed & "NATIVE_FILE_LIST_MISMATCH" & linefeed & (observedNames as text)
`;

const buildPickerSelectionScript = (): string => `
    try
      set selected of row 2 of fileOutline to true
      set focused of fileOutline to true
    on error
      return "FAILED" & linefeed & "NATIVE_FILE_LIST_NOT_FOCUSED"
    end try

    keystroke "a" using command down

    set openButton to missing value
    set openButtonCount to 0
    repeat with elementIndex from 1 to count of UI elements of mainSplitGroup
      set candidate to UI element elementIndex of mainSplitGroup
      try
        if role of candidate is "AXButton" then
          set candidateName to name of candidate as text
          if candidateName is "Open" or candidateName is "打开" then
            set openButton to candidate
            set openButtonCount to openButtonCount + 1
          end if
        end if
      end try
    end repeat
    if openButtonCount is not 1 then return "FAILED" & linefeed & "NATIVE_OPEN_BUTTON_AMBIGUOUS"

    set openReady to false
    repeat with pollIndex from 1 to 30
      try
        if enabled of openButton is true then
          set openReady to true
          exit repeat
        end if
      end try
      delay 0.1
    end repeat
    if openReady is false then return "FAILED" & linefeed & "NATIVE_SELECTION_UNPROVEN"

    perform action "AXPress" of openButton

    set pickerClosed to false
    repeat with pollIndex from 1 to 100
      if (count of sheets of window 1) is 0 then
        set pickerClosed to true
        exit repeat
      end if
      delay 0.1
    end repeat
    if pickerClosed is false then return "FAILED" & linefeed & "NATIVE_PICKER_DID_NOT_CLOSE"
  end tell
end tell

set AppleScript's text item delimiters to linefeed
return "SUCCESS" & linefeed & (observedNames as text)
`;

const buildNativePickerScript = (input: {
  stagingDirectoryPath: string;
  expectedFileNames: readonly string[];
}): string => [
  buildPickerOpenScript(input),
  buildPickerFileListProofScript(),
  buildPickerSelectionScript(),
].join("\n");

const failureResult = (message: string): BrowserNativeMultiFilePickerResult => ({
  ...createCurrentChromeBrowserActionResult({ ok: false, message }),
  observedFileNames: [],
});

export const parseNativeMultiFilePickerOutput = (
  output: string,
): BrowserNativeMultiFilePickerResult => {
  const [status = "FAILED", ...details] = output.trim().split(/\r?\n/u);
  if (status !== "SUCCESS") {
    return failureResult(details[0] ?? "NATIVE_PICKER_UNKNOWN_RESULT");
  }
  const observedFileNames = details;
  return {
    ...createCurrentChromeBrowserActionResult({
      message: `selected ${observedFileNames.length} approved files through the native picker`,
    }),
    observedFileNames,
  };
};

export const runNativeMultiFilePickerSelection = async (
  input: NativePickerInput,
): Promise<BrowserNativeMultiFilePickerResult> => {
  if (input.expectedFileNames.length < 2) {
    return failureResult("NATIVE_MULTI_FILE_PICKER_REQUIRES_MULTIPLE_FILES");
  }
  if (new Set(input.expectedFileNames).size !== input.expectedFileNames.length) {
    return failureResult("NATIVE_MULTI_FILE_PICKER_DUPLICATE_FILE_NAMES");
  }
  const output = await runAppleScript(
    buildNativePickerScript({
      stagingDirectoryPath: input.stagingDirectoryPath,
      expectedFileNames: input.expectedFileNames,
    }),
    input.abortSignal ? { signal: input.abortSignal } : undefined,
  );
  return parseNativeMultiFilePickerOutput(output);
};
