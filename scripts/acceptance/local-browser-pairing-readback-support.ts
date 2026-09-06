import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import {
  GRASSEYE_PAIRING_URL,
  GRASSEYE_TOOL_EXTENSION_ID,
  GRASSEYE_TOOL_EXTENSION_ID_HEADER,
  readWorkbenchPairingState,
} from "../../src/lib/browser/chrome-extension/pairing-auto-bootstrap.js";
import { GPT_WEB_START_URL, requireGptWebPolicyForUrl } from
  "../../src/lib/browser/exact-target/browser-site-policy-registry.js";

export const exercisePairingReadback = async (
  secret: string,
  currentBuild: string,
): Promise<void> => {
  assert.equal(GPT_WEB_START_URL, "https://chatgpt.com/");
  assert.equal(requireGptWebPolicyForUrl("https://chatgpt.com/c/exact").siteId, "gpt-web");
  for (const rejectedUrl of ["https://www.amazon.com/", "https://evil.chatgpt.com/", "http://chatgpt.com/"]) {
    assert.throws(() => requireGptWebPolicyForUrl(rejectedUrl), /BROWSER_ORIGIN_REJECTED/u,
      `job-bound target policy must reject ${rejectedUrl}`);
  }
  let observedInput = "";
  let observedInit: RequestInit | undefined;
  const state = await readWorkbenchPairingState((async (input: string | URL | Request, init?: RequestInit) => {
    observedInput = String(input);
    observedInit = init;
    return new Response(JSON.stringify({ authority: "absent", pairingSecret: secret, releaseBuildId: currentBuild }), {
      status: 200, headers: { "content-type": "application/json" },
    });
  }) as typeof globalThis.fetch);
  assert.deepEqual(state, { authority: "absent", pairingSecret: secret, releaseBuildId: currentBuild });
  assert.equal(observedInput, GRASSEYE_PAIRING_URL);
  assert.deepEqual(observedInit, {
    method: "GET", cache: "no-store", credentials: "omit",
    headers: { [GRASSEYE_TOOL_EXTENSION_ID_HEADER]: GRASSEYE_TOOL_EXTENSION_ID },
    redirect: "error", referrerPolicy: "no-referrer",
  });
  await assert.rejects(readWorkbenchPairingState((async () => new Response(JSON.stringify({
    authority: "absent", pairingSecret: "invalid", releaseBuildId: currentBuild,
  }), { status: 200 })) as typeof globalThis.fetch), /BROWSER_PAIRING_RESPONSE_INVALID/u);
  await assert.rejects(readWorkbenchPairingState((async () => new Response(JSON.stringify({
    authority: "absent", pairingSecret: secret, releaseBuildId: "invalid",
  }), { status: 200 })) as typeof globalThis.fetch), /BROWSER_PAIRING_RESPONSE_INVALID/u);
  await assert.rejects(readWorkbenchPairingState(
    (async () => new Response("{}", { status: 403 })) as typeof globalThis.fetch,
  ), /BROWSER_PAIRING_ORIGIN_REJECTED/u);
};
