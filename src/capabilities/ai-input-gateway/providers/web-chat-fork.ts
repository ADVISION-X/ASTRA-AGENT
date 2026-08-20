import type { BrowserTargetLease } from "../../../lib/browser/browser-authority-api.js";
import type {
  AiProviderAdapterContext,
  WebChatForkActionProof,
} from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";

type ForkRuntimeInput = Readonly<{
  browser: BrowserTargetLease;
  context: AiProviderAdapterContext;
  request: AiFeedInput;
  waitForComposer: () => Promise<void>;
}>;

const assertGovernedParent = (request: AiFeedInput): void => {
  const fork = request.providerForkRef;
  if (!fork) throw new Error("review_required: provider fork reference is missing");
  const url = new URL(fork.providerPageUrl);
  if (request.providerKind !== "gpt-web-chat"
    || url.protocol !== "https:"
    || url.host !== "chatgpt.com"
    || !/^\/c\/(?!WEB:)[^/]+$/u.test(url.pathname)) {
    throw new Error("review_required: provider fork URL is not a governed ChatGPT conversation URL");
  }
};

/**
 * Forking needs a separately observed checkpoint action and child-conversation
 * materialization boundary. Neither is currently evidenced in real Chrome;
 * therefore the old generic evaluation route is physically removed and the
 * request stops for review rather than taking a guessed alternate path.
 */
export const openGovernedForkFromCheckpoint = async (
  input: ForkRuntimeInput,
): Promise<WebChatForkActionProof> => {
  assertGovernedParent(input.request);
  void input.browser;
  void input.context;
  void input.waitForComposer;
  throw new Error(
    "review_required: NOT_PRODUCTION_VERIFIED: ChatGPT fork checkpoint action and child-conversation DOM are not yet observed",
  );
};
