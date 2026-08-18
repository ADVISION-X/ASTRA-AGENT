const INFO = new TextEncoder().encode("grasseye-browser-command-frame-v2");
const toBase64 = (value) => {
    const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
    let binary = "";
    for (const byte of bytes)
        binary += String.fromCharCode(byte);
    return btoa(binary);
};
const fromBase64 = (value) => {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1)
        bytes[index] = binary.charCodeAt(index);
    return bytes.buffer;
};
const aad = (input) => new TextEncoder().encode(`${input.authorityId}:${input.connectionGeneration}:${input.nativePortEpoch}:${input.sequence}`).buffer;
export const createExtensionEphemeralSession = async (input) => {
    const keyPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
    const controllerKey = await crypto.subtle.importKey("raw", fromBase64(input.controllerPublicKeyBase64), { name: "ECDH", namedCurve: "P-256" }, false, []);
    const sharedBits = await crypto.subtle.deriveBits({ name: "ECDH", public: controllerKey }, keyPair.privateKey, 256);
    const hkdfKey = await crypto.subtle.importKey("raw", sharedBits, "HKDF", false, ["deriveBits"]);
    const derivedBits = await crypto.subtle.deriveBits({
        name: "HKDF",
        hash: "SHA-256",
        salt: fromBase64(input.nonceBase64),
        info: INFO,
    }, hkdfKey, 256);
    const [frameKey, hmacKey, publicKey] = await Promise.all([
        crypto.subtle.importKey("raw", derivedBits, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]),
        crypto.subtle.importKey("raw", derivedBits, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]),
        crypto.subtle.exportKey("raw", keyPair.publicKey),
    ]);
    return Object.freeze({ publicKeyBase64: toBase64(publicKey), frameKey, hmacKey });
};
export const signExtensionTranscript = async (key, transcript) => toBase64(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(transcript)));
export const verifyControllerProof = async (key, transcript, proofBase64) => crypto.subtle.verify("HMAC", key, fromBase64(proofBase64), new TextEncoder().encode(transcript));
export const encryptExtensionFrame = async (key, binding, value) => {
    const iv = crypto.getRandomValues(new Uint8Array(12)).buffer;
    const plaintext = new TextEncoder().encode(JSON.stringify(value)).buffer;
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: aad(binding), tagLength: 128 }, key, plaintext);
    return Object.freeze({ iv: toBase64(iv), ciphertext: toBase64(ciphertext) });
};
export const decryptExtensionFrame = async (key, binding, input) => {
    const plaintext = await crypto.subtle.decrypt({
        name: "AES-GCM",
        iv: fromBase64(input.iv),
        additionalData: aad(binding),
        tagLength: 128,
    }, key, fromBase64(input.ciphertext));
    return JSON.parse(new TextDecoder().decode(plaintext));
};
