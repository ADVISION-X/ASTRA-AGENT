const typedCharacterKey = (character) => {
    if (/^[a-z]$/i.test(character)) {
        return {
            code: `Key${character.toUpperCase()}`,
            key: character,
            windowsVirtualKeyCode: character.toUpperCase().charCodeAt(0),
        };
    }
    if (/^[0-9]$/.test(character)) {
        return {
            code: `Digit${character}`,
            key: character,
            windowsVirtualKeyCode: character.charCodeAt(0),
        };
    }
    if (character === "-")
        return { code: "Minus", key: character, windowsVirtualKeyCode: 189 };
    if (character === " ")
        return { code: "Space", key: character, windowsVirtualKeyCode: 32 };
    return { code: "Unidentified", key: character, windowsVirtualKeyCode: 0 };
};
export const keyCode = (key) => {
    const known = {
        Enter: 13,
        Tab: 9,
        Escape: 27,
        Backspace: 8,
        Delete: 46,
        ArrowLeft: 37,
        ArrowUp: 38,
        ArrowRight: 39,
        ArrowDown: 40,
    };
    return {
        code: key,
        key,
        windowsVirtualKeyCode: known[key] ?? key.toUpperCase().charCodeAt(0),
    };
};
export const createServiceWorkerKeyboard = (sendCommand) => ({
    keyCode,
    dispatchTypedCharacter: async (tabId, character) => {
        const key = typedCharacterKey(character);
        await sendCommand(tabId, "Input.dispatchKeyEvent", { type: "rawKeyDown", ...key });
        await sendCommand(tabId, "Input.dispatchKeyEvent", {
            type: "char",
            ...key,
            text: character,
            unmodifiedText: character,
        });
        await sendCommand(tabId, "Input.dispatchKeyEvent", { type: "keyUp", ...key });
    },
});
