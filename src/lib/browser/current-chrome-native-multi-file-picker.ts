import { resolve } from "node:path";

import type {
  BrowserController,
  BrowserNativeMultiFilePickerResult,
} from "./browser-controller.js";
import { createCurrentChromeBrowserActionResult } from "./current-chrome-browser-action-result.js";
import { escapeAppleScriptText } from "./current-chrome-browser-controller-primitives.js";
import { runAppleScript } from "./current-chrome-window-control.js";

type NativePickerInput = Parameters<NonNullable<BrowserController["selectFilesInNativePicker"]>>[0];

const NATIVE_PICKER_PROCESS_TIMEOUT_MS = 35_000;
const NATIVE_PICKER_CLEANUP_TIMEOUT_MS = 5_000;

const appleScriptList = (values: readonly string[]): string =>
  `{${values.map((value) => `"${escapeAppleScriptText(value)}"`).join(", ")}}`;

const PICKER_FAILURE_HANDLER = `
on failAndClose(reasonCode, observedNames)
  tell application "System Events"
    tell process "Google Chrome"
      if (count of windows) is greater than 0 then
        if (count of sheets of window 1) is 1 then key code 53
      end if
    end tell
  end tell
  set AppleScript's text item delimiters to linefeed
  if (count of observedNames) is 0 then return "FAILED" & linefeed & reasonCode
  return "FAILED" & linefeed & reasonCode & linefeed & (observedNames as text)
end failAndClose
`;

const buildPickerInputContract = (input: {
  stagingDirectoryPath: string;
  expectedFileNames: readonly string[];
}): string => `
set expectedNames to ${appleScriptList(input.expectedFileNames)}
set reversedNames to ${appleScriptList([...input.expectedFileNames].reverse())}
set expectedCount to count of expectedNames
set observedNames to {}
set stagingDirectoryPath to "${escapeAppleScriptText(resolve(input.stagingDirectoryPath))}"
`;

const PICKER_NAVIGATION_SCRIPT = `
with timeout of 25 seconds
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
      if folderFieldReady is false then return my failAndClose("NATIVE_FOLDER_FIELD_NOT_FOCUSED", {})

      set the clipboard to stagingDirectoryPath
      keystroke "v" using command down
      key code 36
      delay 0.4
      keystroke "2" using command down

      set fileOutline to missing value
      repeat with pollIndex from 1 to 50
        try
          set mainSplitGroup to UI element 1 of targetSheet
          set contentSplitGroup to UI element 3 of mainSplitGroup
          set contentScrollArea to UI element 1 of contentSplitGroup
          set candidateOutline to UI element 1 of contentScrollArea
          if role of candidateOutline is "AXOutline" then
            if ((count of rows of candidateOutline) - 1) is expectedCount then
              set fileOutline to candidateOutline
              exit repeat
            end if
          end if
        end try
        delay 0.1
      end repeat
      if fileOutline is missing value then return my failAndClose("NATIVE_FILE_LIST_COUNT_MISMATCH", {})
`;

const PICKER_ORDER_NORMALIZATION_SCRIPT = `
      set observedNames to {}
      repeat with rowIndex from 2 to count of rows of fileOutline
        set fileCell to UI element 1 of row rowIndex of fileOutline
        set fileNameField to UI element 2 of fileCell
        set end of observedNames to (value of fileNameField as text)
      end repeat

      set exactOrder to true
      set reverseOrder to true
      repeat with nameIndex from 1 to expectedCount
        if (item nameIndex of observedNames as text) is not (item nameIndex of expectedNames as text) then set exactOrder to false
        if (item nameIndex of observedNames as text) is not (item nameIndex of reversedNames as text) then set reverseOrder to false
      end repeat

      if exactOrder is false then
        if reverseOrder is false then return my failAndClose("NATIVE_FILE_LIST_MISMATCH", observedNames)
        set headerGroups to every UI element of fileOutline whose role is "AXGroup"
        if (count of headerGroups) is not 1 then return my failAndClose("NATIVE_FILE_SORT_HEADER_MISSING", observedNames)
        set headerGroup to item 1 of headerGroups
        if (count of UI elements of headerGroup) is less than 1 then return my failAndClose("NATIVE_FILE_SORT_HEADER_MISSING", observedNames)
        set nameSortButton to UI element 1 of headerGroup
        if role of nameSortButton is not "AXButton" then return my failAndClose("NATIVE_FILE_SORT_CONTROL_MISSING", observedNames)
        perform action "AXPress" of nameSortButton

        set firstRowSorted to false
        repeat with pollIndex from 1 to 30
          try
            set firstCell to UI element 1 of row 2 of fileOutline
            set firstNameField to UI element 2 of firstCell
            if (value of firstNameField as text) is (item 1 of expectedNames as text) then
              set firstRowSorted to true
              exit repeat
            end if
          end try
          delay 0.1
        end repeat
        if firstRowSorted is false then return my failAndClose("NATIVE_FILE_SORT_DID_NOT_NORMALIZE", observedNames)

        set observedNames to {}
        repeat with rowIndex from 2 to count of rows of fileOutline
          set fileCell to UI element 1 of row rowIndex of fileOutline
          set fileNameField to UI element 2 of fileCell
          set end of observedNames to (value of fileNameField as text)
        end repeat
        repeat with nameIndex from 1 to expectedCount
          if (item nameIndex of observedNames as text) is not (item nameIndex of expectedNames as text) then
            return my failAndClose("NATIVE_FILE_SORTED_LIST_MISMATCH", observedNames)
          end if
        end repeat
      end if
`;

const PICKER_SELECTION_SCRIPT = `
      try
        set selected of row 2 of fileOutline to true
        set focused of fileOutline to true
      on error
        return my failAndClose("NATIVE_FILE_LIST_NOT_FOCUSED", observedNames)
      end try
      keystroke "a" using command down

      set exactSelectionReady to false
      repeat with pollIndex from 1 to 30
        try
          set selectedRows to every row of fileOutline whose selected is true
          if (count of selectedRows) is expectedCount then
            set exactSelectionReady to true
            exit repeat
          end if
        end try
        delay 0.1
      end repeat
      if exactSelectionReady is false then return my failAndClose("NATIVE_SELECTION_UNPROVEN", observedNames)

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
      if openButtonCount is not 1 then return my failAndClose("NATIVE_OPEN_BUTTON_AMBIGUOUS", observedNames)

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
      if openReady is false then return my failAndClose("NATIVE_OPEN_BUTTON_DISABLED", observedNames)

      perform action "AXPress" of openButton

      set pickerClosed to false
      repeat with pollIndex from 1 to 100
        if (count of sheets of window 1) is 0 then
          set pickerClosed to true
          exit repeat
        end if
        delay 0.1
      end repeat
      if pickerClosed is false then return my failAndClose("NATIVE_PICKER_DID_NOT_CLOSE", observedNames)
    end tell
  end tell
end timeout

set AppleScript's text item delimiters to linefeed
return "SUCCESS" & linefeed & (observedNames as text)
`;

const buildNativePickerScript = (input: {
  stagingDirectoryPath: string;
  expectedFileNames: readonly string[];
}): string => [
  PICKER_FAILURE_HANDLER,
  buildPickerInputContract(input),
  PICKER_NAVIGATION_SCRIPT,
  PICKER_ORDER_NORMALIZATION_SCRIPT,
  PICKER_SELECTION_SCRIPT,
].join("\n");

const buildNativePickerCleanupScript = (): string => `
with timeout of 3 seconds
  tell application "System Events"
    tell process "Google Chrome"
      if (count of windows) is greater than 0 then
        if (count of sheets of window 1) is 1 then key code 53
      end if
    end tell
  end tell
end timeout
return "CLEANED"
`;

const failureResult = (message: string): BrowserNativeMultiFilePickerResult => ({
  ...createCurrentChromeBrowserActionResult({ ok: false, message }),
  observedFileNames: [],
});

export const parseNativeMultiFilePickerOutput = (
  output: string,
): BrowserNativeMultiFilePickerResult => {
  const [status = "FAILED", ...details] = output.trim().split(/\r?\n/u);
  if (status !== "SUCCESS") {
    return failureResult(details.length > 0
      ? details.join("; observed=")
      : "NATIVE_PICKER_UNKNOWN_RESULT");
  }
  const observedFileNames = details;
  return {
    ...createCurrentChromeBrowserActionResult({
      message: `selected ${observedFileNames.length} approved files through the native picker`,
    }),
    observedFileNames,
  };
};

const closeOrphanedNativePicker = async (): Promise<void> => {
  await runAppleScript(buildNativePickerCleanupScript(), {
    signal: AbortSignal.timeout(NATIVE_PICKER_CLEANUP_TIMEOUT_MS),
  }).catch(() => undefined);
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
  const processTimeout = AbortSignal.timeout(NATIVE_PICKER_PROCESS_TIMEOUT_MS);
  const signal = input.abortSignal
    ? AbortSignal.any([input.abortSignal, processTimeout])
    : processTimeout;
  try {
    const output = await runAppleScript(
      buildNativePickerScript({
        stagingDirectoryPath: input.stagingDirectoryPath,
        expectedFileNames: input.expectedFileNames,
      }),
      { signal },
    );
    return parseNativeMultiFilePickerOutput(output);
  } catch (error) {
    await closeOrphanedNativePicker();
    if (input.abortSignal?.aborted) {
      return failureResult("NATIVE_PICKER_ABORTED");
    }
    if (processTimeout.aborted) {
      return failureResult("NATIVE_PICKER_TIMEOUT");
    }
    const message = error instanceof Error ? error.message : String(error);
    return failureResult(
      `NATIVE_PICKER_AUTOMATION_FAILED:${message.replace(/\s+/gu, " ").slice(0, 500)}`,
    );
  }
};
