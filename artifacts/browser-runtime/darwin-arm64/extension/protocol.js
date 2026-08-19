export const GRASSEYE_BROWSER_PROTOCOL_VERSION = "grasseye-browser-v2";
export const GRASSEYE_BROWSER_RELEASE_IDENTITY = "grasseye-browser-runtime-2026-08-18-v2";
export const GRASSEYE_BROWSER_EXTENSION_ID = "mepfnlhndaiihhfejbbhfehegpbdnipl";
export const GRASSEYE_BROWSER_EXTENSION_VERSION = "2.0.0";
export const GRASSEYE_NATIVE_HOST_NAME = "com.grasseye.browser";
export const GRASSEYE_BROWSER_HOST_TO_EXTENSION_MAX_BYTES = 256 * 1024;
export const GRASSEYE_BROWSER_EXTENSION_TO_HOST_MAX_BYTES = 48 * 1024 * 1024;
const isNonEmptyString = (value, max = 8_192) => typeof value === "string" && value.length > 0 && value.length <= max;
const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);
const isPositiveSafeInteger = (value) => Number.isSafeInteger(value) && value > 0;
const isBase64 = (value, max = GRASSEYE_BROWSER_EXTENSION_TO_HOST_MAX_BYTES * 2) => isNonEmptyString(value, max) && /^[A-Za-z0-9+/]+={0,2}$/u.test(value);
const hasWireIdentity = (record) => record.protocolVersion === GRASSEYE_BROWSER_PROTOCOL_VERSION
    && record.releaseIdentity === GRASSEYE_BROWSER_RELEASE_IDENTITY;
const isBrowserWireCommandPermit = (value) => {
    if (!value || typeof value !== "object")
        return false;
    const record = value;
    return isNonEmptyString(record.authorityId)
        && isNonEmptyString(record.authorityCertificateHash)
        && isPositiveSafeInteger(record.connectionGeneration)
        && isPositiveSafeInteger(record.nativePortEpoch)
        && isNonEmptyString(record.commandId)
        && isPositiveSafeInteger(record.sequence)
        && isFiniteNumber(record.deadlineAt)
        && isNonEmptyString(record.permitHash);
};
const wireValidators = {
    extension_hello: (record) => [
        record.extensionId === GRASSEYE_BROWSER_EXTENSION_ID,
        record.extensionVersion === GRASSEYE_BROWSER_EXTENSION_VERSION,
        isNonEmptyString(record.extensionInstanceId),
        isPositiveSafeInteger(record.nativePortEpoch),
    ].every(Boolean),
    controller_challenge: (record) => [
        isNonEmptyString(record.controllerSessionId),
        isPositiveSafeInteger(record.connectionGeneration),
        isPositiveSafeInteger(record.nativePortEpoch),
        isNonEmptyString(record.challengeId),
        isBase64(record.nonce, 256),
        isBase64(record.controllerPublicKey, 512),
    ].every(Boolean),
    extension_authenticated: (record) => [
        isNonEmptyString(record.extensionInstanceId),
        isPositiveSafeInteger(record.nativePortEpoch),
        isNonEmptyString(record.challengeId),
        isBase64(record.nonce, 256),
        isBase64(record.extensionPublicKey, 512),
        isBase64(record.transcriptProof, 512),
    ].every(Boolean),
    authority_grant: (record) => validateAuthorityGrant(record, record.grantProof),
    authority_grant_ack: (record) => validateAuthorityGrant(record, record.ackProof),
    heartbeat: (record) => [
        isNonEmptyString(record.authorityId),
        isPositiveSafeInteger(record.connectionGeneration),
        isPositiveSafeInteger(record.nativePortEpoch),
        isFiniteNumber(record.monotonicMs),
        isBase64(record.proof, 512),
    ].every(Boolean),
    command_frame: (record) => [
        isBrowserWireCommandPermit(record.permit),
        isBase64(record.iv, 128),
        isBase64(record.ciphertext, GRASSEYE_BROWSER_HOST_TO_EXTENSION_MAX_BYTES * 2),
    ].every(Boolean),
    response_frame: (record) => [
        isNonEmptyString(record.permitHash),
        isNonEmptyString(record.authorityId),
        isPositiveSafeInteger(record.connectionGeneration),
        isPositiveSafeInteger(record.nativePortEpoch),
        isPositiveSafeInteger(record.sequence),
        isBase64(record.iv, 128),
        isBase64(record.ciphertext, GRASSEYE_BROWSER_EXTENSION_TO_HOST_MAX_BYTES * 2),
    ].every(Boolean),
};
function validateAuthorityGrant(record, proof) {
    return [
        isNonEmptyString(record.authorityId),
        isNonEmptyString(record.authorityCertificateHash),
        isPositiveSafeInteger(record.connectionGeneration),
        isPositiveSafeInteger(record.nativePortEpoch),
        isNonEmptyString(record.challengeId),
        isBase64(proof, 512),
    ].every(Boolean);
}
export const isBrowserWireMessage = (value) => {
    if (!value || typeof value !== "object")
        return false;
    const record = value;
    if (!hasWireIdentity(record) || typeof record.type !== "string")
        return false;
    return wireValidators[record.type]?.(record) ?? false;
};
